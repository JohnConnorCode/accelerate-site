import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import { getFirstUseProgress } from "../src/lib/revenue-os/first-use";
import { getWorkKindHandler } from "../src/lib/revenue-os/work-executor";
import {
  listLearningSignals,
  recordCorrectionSignal,
  registerLearningSignalHandlers,
  scheduleLearningSignals,
} from "../src/lib/revenue-os/learning-signals";

async function main() {
  const tenant = randomUUID(),
    conversation = randomUUID();
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, name: "Fixture", status: "active" }],
    conversations: [{ id: conversation, tenant_id: tenant }],
    learning_signals: [],
  });
  mem.idFactory = () => randomUUID();
  const db = bindTenantDatabase(mem.client as never, tenant, true);
  const correction = {
    kind: "explicit_correction",
    rule: "Ask about timing",
    sourceKind: "conversation",
    sourceId: conversation,
  };
  mem.fail("learning_proposals", { message: "temporary failure" });
  await assert.rejects(recordCorrectionSignal(db, correction, "fixture@example.test"));
  mem.recover("learning_proposals");
  const original = mem.rows("learning_signals")[0]!;
  original.created_at = "2000-01-01";
  mem.tables.conversations = [];
  const outcome = () => ({
    id: randomUUID(),
    tenant_id: tenant,
    kind: "verified_outcome",
    source_kind: "action",
    source_id: randomUUID(),
    details: "Executed fixture action",
    processed_at: null,
    created_at: "2026-09-20",
  });
  mem.tables.learning_signals!.push(...Array.from({ length: 60 }, outcome));
  registerLearningSignalHandlers();
  const handler = getWorkKindHandler("review_learning_signals")!;
  const first = await handler(db, {} as never);
  assert.equal(first.status, "partial");
  assert.equal(original.category, "recovery_required");
  assert(original.processed_at);
  assert.equal(mem.rows("learning_signals").filter((r) => r.category === "outcome").length, 49);
  const visible = await listLearningSignals(db);
  assert.equal(
    visible[0]?.id,
    original.id,
    "older failures remain visible ahead of recent successful evidence",
  );
  assert.equal(visible[0]?.rule, correction.rule);
  assert.equal(visible.length, 50);
  assert.equal(new Set(visible.map((r) => r.id)).size, visible.length);
  const recordedFailure = original.processed_at;
  await handler(db, {} as never);
  assert.equal(mem.rows("learning_signals").filter((r) => r.category === "outcome").length, 60);
  assert.equal(original.processed_at, recordedFailure, "cooldown prevents immediate retries");
  mem.rpc("collect_learning_signals", () => 0);
  await scheduleLearningSignals(db);
  assert.equal(mem.rows("work_items").length, 0, "cooling failures do not queue repeated work");
  original.processed_at = "2000-01-01T00:00:00Z";
  mem.tables.conversations!.push({ id: conversation, tenant_id: tenant });
  await scheduleLearningSignals(db);
  assert.equal(mem.rows("work_items").length, 1, "due recovery is scheduled without new evidence");
  assert.equal((await handler(db, {} as never)).status, "completed");
  assert.equal(original.category, "guidance");
  assert.equal(mem.rows("learning_proposals").length, 1);
  assert.equal(mem.rows("learned_policies").length, 0);
  await handler(db, {} as never);
  assert.equal(mem.rows("learning_proposals").length, 1, "successful evidence is not reprocessed");

  // Even a larger broken backlog reserves capacity for fresh evidence and rotates retries.
  mem.tables.learning_signals = [
    ...Array.from({ length: 30 }, () => ({
      id: randomUUID(),
      tenant_id: tenant,
      kind: "explicit_correction",
      category: "recovery_required",
      processed_at: "2000-01-01T00:00:00Z",
      correction_input: { ...correction, sourceId: randomUUID() },
      actor_email: "fixture@example.test",
    })),
    ...Array.from({ length: 60 }, outcome),
  ];
  await handler(db, {} as never);
  assert.equal(mem.rows("learning_signals").filter((r) => r.category === "outcome").length, 25);
  assert.equal(
    mem.rows("learning_signals").filter((r) => r.processed_at === "2000-01-01T00:00:00Z").length,
    5,
  );
  await handler(db, {} as never);
  assert.equal(mem.rows("learning_signals").filter((r) => r.category === "outcome").length, 60);
  assert.equal(
    mem.rows("learning_signals").filter((r) => r.processed_at === "2000-01-01T00:00:00Z").length,
    0,
  );
  mem.tables.learning_signals = [
    {
      id: randomUUID(),
      tenant_id: tenant,
      kind: "explicit_correction",
      correction_input: null,
      processed_at: null,
    },
  ];
  const manual = mem.rows("learning_signals")[0]!;
  assert.equal((await handler(db, {} as never)).status, "completed");
  assert.equal(manual.category, "manual_review");
  const classifiedAt = manual.processed_at;
  await handler(db, {} as never);
  assert.equal(manual.processed_at, classifiedAt, "invalid original input is not retried forever");
  assert.equal((await listLearningSignals(db))[0]?.category, "manual_review");
  mem.tables.learning_signals = [outcome()];
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(handler(db, {} as never, cancelled.signal));
  assert.equal(mem.rows("learning_signals")[0]!.processed_at, null);
  mem.fail("learning_signals", { message: "offline" });
  await assert.rejects(handler(db, {} as never), /could not be read/);
  mem.recover("learning_signals");

  const savedKey = process.env.OPENROUTER_API_KEY;
  try {
    process.env.OPENROUTER_API_KEY = "fixture-platform-key";
    const progress = await getFirstUseProgress(db);
    assert.equal(
      progress.readiness.find((r) => r.label === "AI connection")?.state,
      "optional",
      "client tenants cannot inherit the platform key",
    );
    const bootstrap = new AuthorizedMemorySupabase({
      tenants: [{ id: ACCELERATE_TENANT_ID, name: "Self-hosted fixture", status: "active" }],
    });
    const bootstrapDb = bindTenantDatabase(bootstrap.client as never, ACCELERATE_TENANT_ID, true);
    assert.equal(
      (await getFirstUseProgress(bootstrapDb)).readiness.find((r) => r.label === "AI connection")
        ?.state,
      "connected",
    );
    mem.tables.integration_connections = [
      { tenant_id: tenant, provider: "openrouter", status: "connected", encrypted_credentials: {} },
    ];
    const broken = await getFirstUseProgress(db);
    assert.equal(
      broken.readiness.find((r) => r.label === "AI connection")?.state,
      "needs attention",
    );
    assert.equal(broken.steps.find((s) => s.id === "workspace")?.complete, true);
    assert(!JSON.stringify(broken).includes("fixture-platform-key"));
  } finally {
    if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedKey;
  }
  console.log(
    "Learning recovery: partial batches, cooldown, scheduling, replay, fairness, cancellation, database failure and credential readiness passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
