import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { updateLegacyLead } from "../src/lib/revenue-os/legacy-adapter";
import { captureManualLead } from "../src/lib/revenue-os/inbound";

const tenant = randomUUID(),
  foreign = randomUUID(),
  leadId = randomUUID(),
  oppId = randomUUID();
const actor = "operator@example.test";
function fixture() {
  const mem = new MemorySupabase({
    tenants: [{ id: tenant, status: "active", config: { modules: { clients: true } } }],
    solution_requests: [
      {
        id: leadId,
        tenant_id: tenant,
        contact_name: "Test Owner",
        contact_email: "owner@example.test",
        business_name: "Test Company",
        industry: "other",
        lead_status: "new",
        intake_data: {},
      },
    ],
    opportunities: [
      {
        id: oppId,
        tenant_id: tenant,
        stage: "new",
        source_record_type: "solution_request",
        source_record_id: leadId,
        email: "owner@example.test",
        contact_id: "contact",
        company_id: "company",
        estimated_value: 1200,
      },
    ],
    contacts: [
      {
        id: "contact",
        tenant_id: tenant,
        full_name: "Test Owner",
        primary_email: "owner@example.test",
      },
    ],
    companies: [{ id: "company", tenant_id: tenant, name: "Test Company", domain: "example.test" }],
    kanban_columns: ["new", "contacted", "qualified", "won", "lost"].map((key, i) => ({
      tenant_id: tenant,
      board_key: "pipeline",
      column_key: key,
      label: key,
      sort_order: i,
      metadata: { role: key === "won" || key === "lost" ? key : "open", probability: i * 20 },
    })),
    onboarding_templates: [
      {
        id: "template",
        tenant_id: tenant,
        template_key: "default",
        active: true,
        version: 1,
        milestones: [{ key: "kickoff", title: "Book kickoff", due_offset_days: 1 }],
      },
    ],
  });
  return { mem, db: bindTenantDatabase(mem.client, tenant, true) };
}
async function main() {
  const cases: string[] = [];
  const f = fixture();
  const update = (lead_status: string) =>
    updateLegacyLead(f.db, { id: leadId, lead_status }, actor);
  let result = await update("contacted");
  assert.equal(result.status, "complete");
  assert.equal(f.mem.rows("opportunities")[0]!.stage, "contacted");
  assert.equal(f.mem.rows("solution_requests")[0]!.lead_status, "contacted");
  assert.equal(f.mem.rows("stage_events").length, 1);
  assert.equal(f.mem.rows("tasks").length, 1);
  assert.ok(result.taskId);
  cases.push("canonical-stage-and-checked-follow-up");
  const due = f.mem.rows("tasks")[0]!.due_date;
  await update("contacted");
  assert.equal(f.mem.rows("tasks").length, 1);
  assert.equal(f.mem.rows("stage_events").length, 1);
  assert.equal(f.mem.rows("tasks")[0]!.due_date, due);
  f.mem.rows("tasks")[0]!.status = "completed";
  await update("contacted");
  assert.equal(f.mem.rows("tasks").length, 1, "replay must not recreate a completed follow-up");
  await update("qualified");
  await new Promise((resolve) => setTimeout(resolve, 2));
  await update("contacted");
  assert.equal(
    f.mem.rows("tasks").length,
    2,
    "a real new contact transition gets a new commitment",
  );
  cases.push("stable-replay-and-new-contact-transition");

  const partial = fixture();
  partial.mem.fail("tasks", { message: "Fictional database failure" });
  result = await updateLegacyLead(partial.db, { id: leadId, lead_status: "contacted" }, actor);
  assert.equal(result.status, "partial");
  assert.equal(result.step, "follow_up");
  assert.equal(partial.mem.rows("opportunities")[0]!.stage, "contacted");
  assert.equal(
    (
      partial.mem.rows("solution_requests")[0]!.intake_data as Record<
        string,
        Record<string, unknown>
      >
    ).lead_write_receipt!.status,
    "pending",
  );
  partial.mem.recover("tasks");
  result = await updateLegacyLead(partial.db, { id: leadId, lead_status: "contacted" }, actor);
  assert.equal(result.status, "complete");
  assert.equal(partial.mem.rows("tasks").length, 1);
  assert.equal(partial.mem.rows("stage_events").length, 1);
  cases.push("durable-partial-follow-up-and-recovery");

  const blocked = fixture();
  blocked.mem.fail("opportunities", { message: "Linkage unavailable" });
  result = await updateLegacyLead(blocked.db, { id: leadId, lead_status: "qualified" }, actor);
  assert.equal(result.status, "failed");
  assert.equal(blocked.mem.rows("solution_requests")[0]!.lead_status, "new");
  await assert.rejects(() =>
    updateLegacyLead(blocked.db, { id: "bad", lead_status: "contacted" }, actor),
  );
  await assert.rejects(
    () => updateLegacyLead(blocked.mem.client, { id: leadId, lead_status: "contacted" }, actor),
    /tenant-bound/,
  );
  result = await updateLegacyLead(blocked.db, { id: leadId, lead_status: "unregistered" }, actor);
  assert.equal(result.status, "failed");
  result = await updateLegacyLead(
    bindTenantDatabase(blocked.mem.client, foreign, true),
    { id: leadId, lead_status: "contacted" },
    actor,
  );
  assert.equal(result.status, "failed");
  assert.equal(blocked.mem.rows("tasks").length, 0);
  cases.push("invalid-unscoped-foreign-and-linkage-failure-refused");

  const delivery = fixture();
  delivery.mem.tables.clients = [
    {
      id: "retained-client",
      tenant_id: tenant,
      lead_id: leadId,
      opportunity_id: null,
      business_name: "Test Company",
      contact_name: "Test Owner",
      contact_email: "owner@example.test",
      monthly_value: 500,
      onboarding_checklist: [],
      handoff_receipt: {},
      handoff_revision: 0,
    },
  ];
  delivery.mem.fail("tasks", { message: "Delivery task unavailable" });
  result = await updateLegacyLead(
    delivery.db,
    { id: leadId, lead_status: "won", estimated_value: 2400 },
    actor,
  );
  assert.equal(result.status, "partial");
  assert.equal(result.step, "handoff");
  assert.equal(delivery.mem.rows("clients").length, 1);
  assert.equal(delivery.mem.rows("clients")[0]!.opportunity_id, oppId);
  assert.equal(delivery.mem.rows("clients")[0]!.monthly_value, 500);
  assert.equal(delivery.mem.rows("opportunities")[0]!.won_value, 2400);
  delivery.mem.recover("tasks");
  result = await updateLegacyLead(
    delivery.db,
    { id: leadId, lead_status: "won", estimated_value: 2400 },
    actor,
  );
  assert.equal(result.status, "complete");
  assert.equal(result.clientId, "retained-client");
  await updateLegacyLead(delivery.db, { id: leadId, lead_status: "won" }, actor);
  assert.equal(delivery.mem.rows("clients").length, 1);
  assert.equal(delivery.mem.rows("tasks").length, 1);
  result = await updateLegacyLead(delivery.db, { id: leadId, lead_status: "new" }, actor);
  assert.notEqual(result.status, "complete", "Leads must preserve terminal-reopen policy");
  assert.equal(delivery.mem.rows("opportunities")[0]!.stage, "won");
  cases.push("won-value-retained-engagement-handoff-replay-and-terminal-policy");

  const concurrent = fixture();
  const runs = await Promise.all(
    [1, 2].map(() =>
      updateLegacyLead(concurrent.db, { id: leadId, lead_status: "contacted" }, actor),
    ),
  );
  assert.ok(runs.some((run) => run.status === "complete"));
  assert.equal(concurrent.mem.rows("tasks").length, 1);
  assert.equal(concurrent.mem.rows("stage_events").length, 1);
  cases.push("concurrent-stage-cas-and-follow-up-dedupe");

  const capture = fixture();
  const requestId = randomUUID();
  capture.mem.rows("opportunities")[0]!.source_record_id = requestId;
  const input = {
    requestId,
    contact_name: "Test Owner",
    contact_email: "owner@example.test",
    business_name: "Test Company",
  };
  let externalCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("Unexpected external request");
  };
  try {
    capture.mem.fail("opportunities", { message: "Capture unavailable" });
    let saved = await captureManualLead(capture.db, input, actor);
    assert.equal(saved.status, "partial");
    assert.equal(saved.canonicalLinked, false);
    assert.equal(saved.lead.id, requestId);
    capture.mem.recover("opportunities");
    saved = await captureManualLead(capture.db, input, actor);
    assert.equal(saved.status, "complete");
    const count = capture.mem.rows("tasks").length;
    await captureManualLead(capture.db, input, actor);
    assert.equal(
      capture.mem.rows("solution_requests").filter((row) => row.id === requestId).length,
      1,
    );
    assert.equal(capture.mem.rows("tasks").length, count);
    await assert.rejects(
      () => captureManualLead(capture.db, { ...input, contact_name: "Different Owner" }, actor),
      /different lead details/,
    );
    assert.equal(externalCalls, 0);
    cases.push("capture-partial-stable-source-replay-intent-conflict-no-send");
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(JSON.stringify({ result: "passed", cases }, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
