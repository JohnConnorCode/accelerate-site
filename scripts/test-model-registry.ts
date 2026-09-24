import assert from "node:assert/strict";
import {
  DEFAULT_SITE_MODEL,
  SITE_STUDIO_MODELS,
  SITE_MODEL_RECOMMENDATIONS,
} from "../src/lib/site-studio/models";
import {
  AI_JOBS,
  getModelRegistration,
  recordModelCall,
  registerModel,
  resolveModelForJob,
  recordModelEvalEvidence,
} from "../src/lib/ai/model-registry";
import { DEFAULT_OPENROUTER_MODEL, getOpenRouterModel } from "../src/lib/ai/openrouter-models";
import { MemorySupabase } from "./lib/memory-supabase";
import {
  currentEvalEvidence,
  EVAL_MAX_AGE_DAYS,
  JOB_CONTRACT_FINGERPRINTS,
} from "../src/lib/ai/eval-contract";

const TENANT = "tenant-a";
const FOREIGN = "tenant-b";

async function main() {
  // 1. Registry completeness: every job names a default that satisfies its
  // own requirements, so the out-of-box path can never refuse itself.
  for (const job of AI_JOBS) {
    assert.ok(job.defaultModel, `${job.key} must name a default model`);
    assert.ok(job.minContextWindow > 0, `${job.key} must declare a context floor`);
  }
  assert.equal(DEFAULT_OPENROUTER_MODEL, "deepseek/deepseek-v4.1-flash");
  const previousOverride = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_MODEL = "operator/selected-model";
  assert.equal(getOpenRouterModel(), "operator/selected-model");
  assert.equal(getOpenRouterModel("request/selected-model"), "request/selected-model");
  if (previousOverride === undefined) delete process.env.OPENROUTER_MODEL;
  else process.env.OPENROUTER_MODEL = previousOverride;
  assert.ok(
    AI_JOBS.filter((job) => job.key !== "site-page-draft").every(
      (job) => job.defaultModel === DEFAULT_OPENROUTER_MODEL,
    ),
  );

  const mem = new MemorySupabase({ admin_settings: [], activities: [] });
  const db = mem.client as never;

  const siteDb = new MemorySupabase({ admin_settings: [], activities: [] }).client as never;
  assert.equal(
    (await resolveModelForJob(siteDb, TENANT, "site-page-draft")).resolved,
    DEFAULT_SITE_MODEL,
  );
  for (const choice of SITE_STUDIO_MODELS.filter((model) =>
    SITE_MODEL_RECOMMENDATIONS.includes(model.id),
  )) {
    assert.equal(
      (await resolveModelForJob(siteDb, TENANT, "site-page-draft", choice.id)).resolved,
      choice.id,
    );
    if (choice.id === DEFAULT_OPENROUTER_MODEL) continue;
    await assert.rejects(
      () => resolveModelForJob(siteDb, TENANT, "copilot-answer", choice.id),
      /not registered/,
    );
  }
  await registerModel(siteDb, {
    tenantId: TENANT,
    id: DEFAULT_SITE_MODEL,
    label: "Locally restricted DeepSeek",
    supportsJson: false,
    actorEmail: "founder@example.test",
  });
  await assert.rejects(
    () => resolveModelForJob(siteDb, TENANT, "site-page-draft"),
    /needs JSON mode/,
  );

  // 2. Registration is idempotent and tenant-scoped.
  await registerModel(db, {
    tenantId: TENANT,
    id: "openai/gpt-4.1-mini",
    label: "Mini",
    costTier: "low",
    supportsTools: true,
    supportsJson: true,
    contextWindow: 1_000_000,
    actorEmail: "founder@example.com",
  });
  await registerModel(db, {
    tenantId: TENANT,
    id: "openai/gpt-4.1-mini",
    label: "Mini (renamed)",
    actorEmail: "founder@example.com",
  });
  assert.equal(
    mem.rows("admin_settings").filter((r) => String(r.key).startsWith("ai-model:")).length,
    1,
    "re-registration must upsert, not duplicate",
  );
  assert.equal(
    (await getModelRegistration(db, TENANT, "openai/gpt-4.1-mini"))?.label,
    "Mini (renamed)",
  );
  // The built-in default resolves from static catalog facts (no tenant
  // data), so even a foreign tenant sees it — unevaluated, which still
  // blocks consequential use. Tenant-registered rows must never cross.
  const foreignBuiltin = await getModelRegistration(db, FOREIGN, DEFAULT_OPENROUTER_MODEL);
  assert.equal(foreignBuiltin?.label, "DeepSeek V4.1 Flash (default)");
  assert.equal(foreignBuiltin?.evalPassed, false);

  // 3. Resolution matrix. The default is low-cost and unevaluated, so even
  // the default path refuses consequential jobs pre-eval — that is the gate
  // working, and the reason eval passage unlocks the install.
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "copilot-answer", null),
    /until its eval set passes/,
  );
  const pubDefault = await resolveModelForJob(db, TENANT, "public-chat", null);
  assert.equal(pubDefault.requested, pubDefault.resolved);
  await assert.rejects(() => resolveModelForJob(db, TENANT, "no-such-job", null), /Unknown AI job/);
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "copilot-answer", "unregistered/model"),
    /not registered/,
  );
  // Unevaluated low-cost model on a consequential job refuses.
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "copilot-answer", "openai/gpt-4.1-mini"),
    /until its eval set passes/,
  );
  // Same model on a non-consequential job passes.
  const pub = await resolveModelForJob(db, TENANT, "public-chat", "openai/gpt-4.1-mini");
  assert.equal(pub.resolved, "openai/gpt-4.1-mini");
  // Capability mismatch refuses: register a tool-less model for a tools job.
  await registerModel(db, {
    tenantId: TENANT,
    id: "text-only/v1",
    costTier: "free",
    supportsTools: false,
    supportsJson: true,
    contextWindow: 200_000,
    actorEmail: "founder@example.com",
  });
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "copilot-answer", "text-only/v1"),
    /tool calling/,
  );
  assert.equal(
    await getModelRegistration(db, FOREIGN, "text-only/v1"),
    null,
    "tenant-registered models must never resolve cross-tenant",
  );

  // 4a. A bare "passed" flag is not evidence: legacy rows stay locked.
  await registerModel(db, {
    tenantId: TENANT,
    id: "legacy/flagged",
    costTier: "low",
    contextWindow: 200_000,
    actorEmail: "founder@example.com",
  });
  const legacyRow = mem
    .rows("admin_settings")
    .find((row) => row.key === "ai-model:legacy/flagged")!;
  legacyRow.value = JSON.stringify({ ...JSON.parse(String(legacyRow.value)), evalPassed: true });
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "copilot-answer", "legacy/flagged"),
    /unevaluated/,
    "an unsupported pass flag must not qualify a model",
  );

  // 4b. Current evidence unlocks only the jobs it covers.
  await recordModelEvalEvidence(db, {
    tenantId: TENANT,
    modelId: "openai/gpt-4.1-mini",
    evidence: currentEvalEvidence(["copilot-answer"]),
    actorEmail: "founder@example.com",
  });
  assert.equal(
    (await resolveModelForJob(db, TENANT, "copilot-answer", "openai/gpt-4.1-mini")).resolved,
    "openai/gpt-4.1-mini",
  );
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "responder-draft", "openai/gpt-4.1-mini"),
    /unevaluated/,
    "a job without evidence stays locked",
  );

  // 4c. Evidence fails closed when stale, off-contract, or not fully passing.
  const stale = new Date(Date.now() - (EVAL_MAX_AGE_DAYS + 1) * 86_400_000).toISOString();
  for (const [label, evidence] of [
    ["aged out", currentEvalEvidence(["proposal-draft"], stale)],
    [
      "contract changed",
      {
        "proposal-draft": {
          ...currentEvalEvidence(["proposal-draft"])["proposal-draft"]!,
          fingerprint: "0000000000000000",
        },
      },
    ],
    [
      "a run failed",
      {
        "proposal-draft": {
          ...currentEvalEvidence(["proposal-draft"])["proposal-draft"]!,
          runs: 3,
          passes: 2,
        },
      },
    ],
  ] as const) {
    await recordModelEvalEvidence(db, {
      tenantId: TENANT,
      modelId: "openai/gpt-4.1-mini",
      evidence,
      actorEmail: "founder@example.com",
    });
    await assert.rejects(
      () => resolveModelForJob(db, TENANT, "proposal-draft", "openai/gpt-4.1-mini"),
      /unevaluated/,
      `evidence that is ${label} must not qualify`,
    );
  }

  // 4d. Full current evidence qualifies every covered job, with provenance.
  const evaluated = await recordModelEvalEvidence(db, {
    tenantId: TENANT,
    modelId: "openai/gpt-4.1-mini",
    evidence: currentEvalEvidence(Object.keys(JOB_CONTRACT_FINGERPRINTS)),
    actorEmail: "founder@example.com",
    notes: "eval set green",
  });
  assert.equal(evaluated.evalPassed, true);
  assert.equal(evaluated.evaluatedBy, "founder@example.com");
  const after = await resolveModelForJob(db, TENANT, "copilot-answer", "openai/gpt-4.1-mini");
  assert.equal(after.resolved, "openai/gpt-4.1-mini");

  // 5. Recording: requested vs resolved with fallback flag and tenant.
  const receipt = await recordModelCall(db, {
    job: "copilot-answer",
    requested: "openai/gpt-4.1-mini",
    resolved: "openai/gpt-4.1",
    tenantId: TENANT,
    actorEmail: "founder@example.com",
  });
  assert.ok(receipt.id);
  const stored = mem.rows("activities").find((r) => r.id === receipt.id);
  assert.equal((stored?.metadata as Record<string, unknown>)?.fallback, true);
  assert.equal(stored?.tenant_id, TENANT);
  await assert.rejects(
    () =>
      recordModelCall(db, {
        job: "",
        requested: "x",
        resolved: "y",
        tenantId: TENANT,
      }),
    /job key is required/,
  );

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "registry-completeness",
        "registration-idempotency",
        "resolution-matrix",
        "eval-gate",
        "call-receipts",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
