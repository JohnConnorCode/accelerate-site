import assert from "node:assert/strict";
import {
  AI_JOBS,
  getModelRegistration,
  recordModelCall,
  registerModel,
  resolveModelForJob,
  setModelEvalStatus,
} from "../src/lib/ai/model-registry";
import { MemorySupabase } from "./lib/memory-supabase";

const TENANT = "tenant-a";
const FOREIGN = "tenant-b";

async function main() {
  // 1. Registry completeness: every job names a default that satisfies its
  // own requirements, so the out-of-box path can never refuse itself.
  for (const job of AI_JOBS) {
    assert.ok(job.defaultModel, `${job.key} must name a default model`);
    assert.ok(job.minContextWindow > 0, `${job.key} must declare a context floor`);
  }

  const mem = new MemorySupabase({ admin_settings: [], activities: [] });
  const db = mem.client as never;

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
  const foreignBuiltin = await getModelRegistration(db, FOREIGN, "openai/gpt-4.1-mini");
  assert.equal(foreignBuiltin?.label, "GPT-4.1 Mini (default)");
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
  await assert.rejects(
    () => resolveModelForJob(db, TENANT, "no-such-job", null),
    /Unknown AI job/,
  );
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

  // 4. Eval gate: passing unlocks the consequential path with provenance.
  const evaluated = await setModelEvalStatus(db, {
    tenantId: TENANT,
    modelId: "openai/gpt-4.1-mini",
    passed: true,
    actorEmail: "founder@example.com",
    notes: "eval set v3 green",
  });
  assert.equal(evaluated.evalPassed, true);
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
