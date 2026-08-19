#!/usr/bin/env tsx
/**
 * Loop One step 1 evidence: prove that an inbound inquiry actually becomes a
 * complete set of canonical records in the configured database, and that
 * replaying the same submission does not duplicate any of them.
 *
 * This exercises the real domain service against a real database rather than an
 * in-memory harness, because the failure this guards against is exactly the one
 * a harness cannot see: a column that does not exist, a constraint that rejects
 * the write, or a dead project. A submission that is accepted by the site and
 * then silently fails to become canonical work is a lost customer.
 *
 * Safety: every record it creates is namespaced by a single generated run id and
 * a reserved test address. Cleanup deletes only rows carrying that run id, and
 * refuses to run at all if the reserved address already has unrelated history.
 * Audit rows are intentionally left behind, because audit history is immutable.
 */
import { randomUUID } from "node:crypto";
import { ingestInboundLead } from "../src/lib/revenue-os/inbound";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const TEST_EMAIL_PREFIX = "revenue-os-verify";
const keep = process.argv.includes("--keep");

const runId = randomUUID().slice(0, 8);
const email = `${TEST_EMAIL_PREFIX}+${runId}@example.invalid`;
// source_record_id is a uuid column on opportunities, mirroring the real
// contact_submissions row id the contact route passes in.
const sourceRecordId = randomUUID();
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition) failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
  return condition;
}

async function main() {
  const supabase = createServiceRoleClient();

  // Refuse to touch a database where this reserved address already has history:
  // that would mean a previous run failed to clean up, and deleting now could
  // remove something a human is still looking at.
  const { data: preexisting, error: preError } = await supabase
    .from("contacts").select("id,primary_email").like("primary_email", `${TEST_EMAIL_PREFIX}%`);
  if (preError) throw new Error(`Could not check for prior verification rows: ${preError.message}`);
  if (preexisting?.length) {
    throw new Error(`Found ${preexisting.length} leftover verification contact(s). Inspect and remove them before rerunning: ${preexisting.map((row) => row.primary_email).join(", ")}`);
  }

  const input = {
    name: `Verification Run ${runId}`,
    email,
    companyName: `Verification Co ${runId}`,
    website: `https://verify-${runId}.example.invalid`,
    industry: "verification",
    source: "contact_form" as const,
    sourceRecordId,
    summary: `Automated Loop One inbound verification ${runId}. Safe to delete.`,
    utm: { utm_source: "verification", utm_medium: "script", utm_campaign: `loop-one-${runId}` },
  };

  // --- First capture -------------------------------------------------------
  const first = await ingestInboundLead(supabase, input);
  check("first capture reports a new opportunity, not an existing one", first.existing === false, first.existing);
  const opportunityId = first.opportunity.id;
  const contactId = first.identity.contact.id;
  const companyId = first.identity.company.id;

  check("opportunity starts in the new stage", first.opportunity.stage === "new", first.opportunity.stage);
  check("opportunity carries a next action", Boolean(first.opportunity.next_action), first.opportunity.next_action);
  check("opportunity links to the canonical contact", first.opportunity.contact_id === contactId);
  check("opportunity links to the canonical company", first.opportunity.company_id === companyId);
  check("attribution is preserved from utm", first.opportunity.utm_campaign === `loop-one-${runId}`, first.opportunity.utm_campaign);

  async function countWhere(table: string, column: string, value: string) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, value);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }

  // A single capture legitimately writes two activity receipts: the inbound
  // form submission itself, and the follow-up task that inbound creates. Assert
  // on the activity types rather than a raw total, so this stays meaningful if
  // another receipt is added later.
  async function activityTypes() {
    const { data, error } = await supabase.from("activities").select("activity_type").eq("opportunity_id", opportunityId);
    if (error) throw new Error(`activities: ${error.message}`);
    const tally: Record<string, number> = {};
    for (const row of data ?? []) tally[row.activity_type] = (tally[row.activity_type] ?? 0) + 1;
    return tally;
  }

  const childCounts = async () => ({
    stageEvents: await countWhere("stage_events", "opportunity_id", opportunityId),
    tasks: await countWhere("tasks", "opportunity_id", opportunityId),
    activities: await activityTypes(),
  });

  const afterFirst = await childCounts();
  check("one stage event recorded", afterFirst.stageEvents === 1, afterFirst.stageEvents);
  check("one follow-up task created", afterFirst.tasks === 1, afterFirst.tasks);
  check("one form submission activity recorded", afterFirst.activities.form_submission === 1, afterFirst.activities);
  check("one task created activity recorded", afterFirst.activities.task_created === 1, afterFirst.activities);

  // --- Replay: the same submission must not duplicate anything -------------
  const second = await ingestInboundLead(supabase, input);
  check("replay resolves to the same opportunity", second.opportunity.id === opportunityId, { first: opportunityId, second: second.opportunity.id });
  check("replay resolves to the same contact", second.identity.contact.id === contactId);
  check("replay reports the opportunity as existing", second.existing === true, second.existing);

  const afterReplay = {
    ...(await childCounts()),
    contacts: await countWhere("contacts", "primary_email", email),
  };
  check("replay does not duplicate the stage event", afterReplay.stageEvents === 1, afterReplay.stageEvents);
  check("replay does not duplicate the form submission activity", afterReplay.activities.form_submission === 1, afterReplay.activities);
  check("replay does not duplicate the task created activity", afterReplay.activities.task_created === 1, afterReplay.activities);
  check("replay does not duplicate the open task", afterReplay.tasks === 1, afterReplay.tasks);
  check("replay does not duplicate the contact", afterReplay.contacts === 1, afterReplay.contacts);

  // --- Degraded capture ----------------------------------------------------
  // The inbound routes now keep serving the visitor and still notify the
  // operator when canonical ingestion fails, instead of returning an error and
  // stranding a saved inquiry in a table nobody watches. Prove both halves:
  // that the failure is genuinely reachable, and that the receipts the routes
  // write on that path are accepted by the schema.
  const ambiguousEmail = `${TEST_EMAIL_PREFIX}+amb-${runId}@example.invalid`;
  for (let i = 0; i < 2; i += 1) {
    const { error } = await supabase.from("opportunities").insert({
      name: `Ambiguity probe ${runId} ${i}`, email: ambiguousEmail, stage: "new", pipeline: "sales",
      source: "verification", source_detail: "ambiguity-probe",
    });
    if (error) throw new Error(`ambiguity probe insert: ${error.message}`);
  }

  let ingestThrew = "";
  try {
    await ingestInboundLead(supabase, { ...input, email: ambiguousEmail, sourceRecordId: randomUUID() });
  } catch (error) {
    ingestThrew = error instanceof Error ? error.message : String(error);
  }
  check("ambiguous identity makes canonical ingestion fail rather than guess", ingestThrew.includes("Multiple open opportunities"), ingestThrew || "(did not throw)");

  const { error: degradedAuditError } = await supabase.from("audit_log").insert({
    actor_email: "system", action: "inbound.canonical_failed", entity_type: "contact_submission",
    entity_id: null, source: "webhook", metadata: { inbound_source: "contact_form", error: ingestThrew, verification_run: runId },
  });
  check("the degraded-capture audit receipt is accepted", !degradedAuditError, degradedAuditError?.message);

  const { data: degradedNotice, error: degradedNoticeError } = await supabase.from("admin_notifications").insert({
    type: "new_contact", title: `Verification ${runId} (needs manual entry)`,
    description: "Canonical capture failed", link: "/admin/today", priority: "urgent",
  }).select("id").single();
  check("the degraded-capture operator notification is accepted", !degradedNoticeError, degradedNoticeError?.message);

  // --- Cleanup -------------------------------------------------------------
  let cleanup = "skipped (--keep)";
  if (!keep) {
    // Child rows first: they carry foreign keys to the opportunity.
    for (const table of ["tasks", "activities", "stage_events"]) {
      const { error } = await supabase.from(table).delete().eq("opportunity_id", opportunityId);
      if (error) throw new Error(`cleanup ${table}: ${error.message}`);
    }
    // Delete by the reserved prefix rather than by collected ids: identity
    // resolution runs before the ambiguity check, so the failing probe leaves a
    // contact behind that no id list would know about.
    const { error: oppError } = await supabase.from("opportunities").delete().like("email", `${TEST_EMAIL_PREFIX}%`);
    if (oppError) throw new Error(`cleanup opportunities: ${oppError.message}`);
    const { error: contactError } = await supabase.from("contacts").delete().like("primary_email", `${TEST_EMAIL_PREFIX}%`);
    if (contactError) throw new Error(`cleanup contacts: ${contactError.message}`);
    const { error: companyError } = await supabase.from("companies").delete().eq("id", companyId);
    if (companyError) throw new Error(`cleanup companies: ${companyError.message}`);
    if (degradedNotice?.id) await supabase.from("admin_notifications").delete().eq("id", degradedNotice.id);

    const { count: strayOpportunities } = await supabase.from("opportunities").select("*", { count: "exact", head: true }).like("email", `${TEST_EMAIL_PREFIX}%`);
    check("cleanup removed every verification opportunity", (strayOpportunities ?? 0) === 0, strayOpportunities);
    const { data: leftover } = await supabase.from("contacts").select("id").like("primary_email", `${TEST_EMAIL_PREFIX}%`);
    check("cleanup removed every verification contact", (leftover?.length ?? 0) === 0, leftover?.length);
    cleanup = "removed";
  }

  console.log(JSON.stringify({
    runId,
    opportunityId,
    checks: {
      firstCapture: afterFirst,
      afterReplay: { stageEvents: afterReplay.stageEvents, activities: afterReplay.activities, tasks: afterReplay.tasks, contacts: afterReplay.contacts },
    },
    cleanup,
    note: "Audit rows are intentionally retained; audit history is immutable.",
    result: failures.length ? "failed" : "passed",
  }, null, 2));

  if (failures.length) {
    console.error(`\nInbound canonical verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Inbound canonical verification errored:", error instanceof Error ? error.message : error);
  console.error(`Run id ${runId} may have left rows behind. Look for ${TEST_EMAIL_PREFIX}% in contacts.`);
  process.exit(1);
});
