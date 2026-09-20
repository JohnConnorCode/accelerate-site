import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { getFirstUseProgress } from "../src/lib/revenue-os/first-use";
import {
  recordCorrectionSignal,
  registerLearningSignalHandlers,
} from "../src/lib/revenue-os/learning-signals";
import { getWorkKindHandler } from "../src/lib/revenue-os/work-executor";
import { loadContextPack } from "../src/lib/revenue-os/shared-context";
import { retrievePluginKnowledge } from "../src/lib/revenue-os/plugin-knowledge";
import { initialDemoLearning, handleDemoLearning } from "../src/lib/admin/demo/learning-runtime";
import { createDemoBusinessState } from "../src/lib/admin/demo/business-runtime";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";

async function main() {
  const tenant = randomUUID(),
    opportunity = randomUUID();
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, name: "Fixture", status: "active" }],
    opportunities: [
      {
        id: opportunity,
        tenant_id: tenant,
        contact_id: randomUUID(),
        next_action: "Call",
        created_at: "2026-09-20",
      },
    ],
    tasks: [],
    learning_signals: [],
    learning_proposals: [],
    learned_policies: [],
  });
  mem.idFactory = () => randomUUID();
  const db = bindTenantDatabase(mem.client as never, tenant, true);
  let progress = await getFirstUseProgress(db);
  assert.equal(progress.steps.find((s) => s.id === "inquiry")?.complete, true);
  assert.equal(progress.steps.find((s) => s.id === "result")?.complete, false);
  mem.tables.tasks!.push({
    id: randomUUID(),
    tenant_id: tenant,
    related_type: "opportunity",
    related_id: opportunity,
    status: "completed",
    due_date: "2026-09-21",
  });
  progress = await getFirstUseProgress(db);
  assert.equal(progress.steps.find((s) => s.id === "result")?.complete, true);
  assert.equal(progress.steps.find((s) => s.id === "reuse")?.complete, false);
  // Failed proposal persistence leaves a recoverable signal, never approved guidance.
  const correction = { kind: "explicit_correction", rule: "Ask for a preferred appointment time." };
  mem.fail("learning_proposals", { message: "temporary failure" });
  await assert.rejects(recordCorrectionSignal(db, correction, "fixture@example.test"));
  assert.equal(mem.rows("learning_signals").length, 1);
  assert.equal(mem.rows("learned_policies").length, 0);
  mem.recover("learning_proposals");
  registerLearningSignalHandlers();
  await getWorkKindHandler("review_learning_signals")!(db, {} as never);
  assert.equal(mem.rows("learning_proposals").length, 1);
  assert.equal(mem.rows("learning_signals")[0]!.category, "guidance");
  await recordCorrectionSignal(db, correction, "fixture@example.test");
  assert.equal(mem.rows("learning_proposals").length, 1);
  assert.equal(mem.rows("learned_policies").length, 0);
  // Whole rules and warnings fit the declared context limit, including retrieval failures.
  mem.tables.learned_policies = [
    {
      id: randomUUID(),
      tenant_id: tenant,
      rule: "x".repeat(9000),
      authority: "approved",
      source: "approved_learning",
    },
  ];
  const context = await loadContextPack(db, { maxChars: 1000, query: "appointment" });
  assert(context.text.length <= 1000);
  assert(context.missing.length);
  assert.equal(context.guidance.length, 0);
  await assert.rejects(retrievePluginKnowledge(db, "meeting-prep"), /disabled/i);
  // Fictional approval remains separate; reset creates a fresh workspace.
  const pack = DEMO_SCENARIOS["northline-roofing"],
    state = initialDemoLearning(),
    business = createDemoBusinessState(pack);
  const request = async (path: string, method = "GET", body: Record<string, unknown> = {}) => {
    const r = handleDemoLearning(
      state,
      business,
      pack,
      new URL("http://fixture" + path),
      method,
      body,
      [],
    );
    assert(r);
    assert.equal(r.status, 200);
    return r.json();
  };
  const proposal = (
    await request("/api/admin/learning", "POST", {
      type: "messaging",
      rule: "Use the customer's preferred time.",
    })
  ).proposal;
  assert.equal(proposal.status, "proposed");
  await request(`/api/admin/learning/${proposal.id}`, "PUT", { action: "request-approval" });
  assert.equal(state.proposals[0]!.status, "proposed");
  await request("/api/admin/revenue-os/actions", "PATCH", {
    id: business.actions[0]!.id,
    decision: "approve",
  });
  assert.equal(state.proposals[0]!.status, "approved");
  assert.equal((await request("/api/admin/get-started")).readiness[0].state, "demo");
  assert.equal(initialDemoLearning().proposals.length, 0);
  console.log(
    "Connected learning: persisted progress, correction recovery/replay, context budget, disabled plugin and separate demo approval passed.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
