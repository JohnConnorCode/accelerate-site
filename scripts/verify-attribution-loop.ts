#!/usr/bin/env tsx
/**
 * Loop One step 8 evidence, and the check that closes the loop: an inquiry
 * captured by the website must be countable as revenue at the other end,
 * attributed to where it came from.
 *
 * It drives one real capture through the canonical transition service to won and
 * asserts the analytics service counts it at every stage of the funnel, credits
 * the revenue, attributes it to its utm source, and reports no missing
 * attribution. Then it removes the record and asserts the funnel returns to its
 * baseline, which also proves the numbers are derived rather than accumulated.
 *
 * Safety: the same reserved address prefix and cleanup guard as
 * verify-inbound-canonical. Audit rows are retained; audit history is immutable.
 */
import { randomUUID } from "node:crypto";
import { loadRevenueAnalytics } from "../src/lib/revenue-os/analytics";
import { ingestInboundLead } from "../src/lib/revenue-os/inbound";
import { transitionOpportunity } from "../src/lib/revenue-os/pipeline";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const TEST_EMAIL_PREFIX = "revenue-os-verify";
const WINDOW_DAYS = 30;
const DEAL_VALUE = 12500;

const runId = randomUUID().slice(0, 8);
const email = `${TEST_EMAIL_PREFIX}+attr-${runId}@example.invalid`;
const campaign = `loop-one-attr-${runId}`;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition) failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

async function purge(supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data: opportunities } = await supabase.from("opportunities").select("id").like("email", `${TEST_EMAIL_PREFIX}%`);
  for (const opportunity of opportunities ?? []) {
    for (const table of ["tasks", "activities", "stage_events"]) {
      await supabase.from(table).delete().eq("opportunity_id", opportunity.id);
    }
  }
  await supabase.from("opportunities").delete().like("email", `${TEST_EMAIL_PREFIX}%`);
  await supabase.from("contacts").delete().like("primary_email", `${TEST_EMAIL_PREFIX}%`);
  await supabase.from("companies").delete().ilike("name", "Attribution Co %");
}

async function main() {
  const supabase = createServiceRoleClient();

  if (process.argv.includes("--cleanup")) {
    await purge(supabase);
    const { count } = await supabase.from("opportunities").select("*", { count: "exact", head: true }).like("email", `${TEST_EMAIL_PREFIX}%`);
    console.log(JSON.stringify({ mode: "cleanup", leftoverOpportunities: count ?? 0, result: (count ?? 0) === 0 ? "clean" : "incomplete" }, null, 2));
    if (count) process.exit(1);
    return;
  }

  const { data: preexisting } = await supabase.from("contacts").select("id").like("primary_email", `${TEST_EMAIL_PREFIX}%`);
  if (preexisting?.length) throw new Error(`Found ${preexisting.length} leftover verification contact(s). Run with --cleanup first.`);

  const baseline = await loadRevenueAnalytics(supabase, WINDOW_DAYS);

  // --- Capture, then drive the full canonical path to won -------------------
  const captured = await ingestInboundLead(supabase, {
    name: `Attribution Run ${runId}`, email, companyName: `Attribution Co ${runId}`,
    website: `https://attr-${runId}.example.invalid`, industry: "verification",
    source: "contact_form", sourceRecordId: randomUUID(),
    summary: `Automated Loop One attribution verification ${runId}. Safe to delete.`,
    utm: { utm_source: "verification", utm_medium: "script", utm_campaign: campaign },
  });
  const opportunityId = captured.opportunity.id;

  const { error: valueError } = await supabase.from("opportunities").update({ estimated_value: DEAL_VALUE }).eq("id", opportunityId);
  if (valueError) throw new Error(`could not set estimated value: ${valueError.message}`);

  for (const stage of ["qualified", "meeting", "proposal", "won"]) {
    await transitionOpportunity(supabase, { id: opportunityId, to: stage, actorEmail: "verification@local", source: "verification", reason: `Loop One attribution verification ${runId}` });
  }

  const { data: finalOpportunity } = await supabase.from("opportunities").select("stage,won_value,closed_at,source_detail").eq("id", opportunityId).single();
  check("the opportunity reaches the won stage", finalOpportunity?.stage === "won", finalOpportunity?.stage);
  check("winning carries the estimated value into won revenue", Number(finalOpportunity?.won_value) === DEAL_VALUE, finalOpportunity?.won_value);
  check("winning records a close timestamp", Boolean(finalOpportunity?.closed_at), finalOpportunity?.closed_at);
  check("the opportunity keeps its campaign attribution", finalOpportunity?.source_detail === campaign, finalOpportunity?.source_detail);

  const { count: stageEvents } = await supabase.from("stage_events").select("*", { count: "exact", head: true }).eq("opportunity_id", opportunityId);
  check("every stage change left an immutable event", stageEvents === 5, { expected: "1 creation + 4 transitions", got: stageEvents });

  // --- The funnel must count it at every step ------------------------------
  const after = await loadRevenueAnalytics(supabase, WINDOW_DAYS);
  const delta = (key: keyof typeof after.funnel) => Number(after.funnel[key]) - Number(baseline.funnel[key]);
  check("the funnel counts one more opportunity", delta("opportunities") === 1, delta("opportunities"));
  check("the funnel counts it as qualified", delta("qualified") === 1, delta("qualified"));
  check("the funnel counts it as a meeting", delta("meetings") === 1, delta("meetings"));
  check("the funnel counts it as a proposal", delta("proposals") === 1, delta("proposals"));
  check("the funnel counts it as won", delta("won") === 1, delta("won"));
  check("the funnel credits the won revenue", delta("wonRevenue") === DEAL_VALUE, delta("wonRevenue"));
  check("a won deal is excluded from open pipeline value", delta("pipelineValue") === 0, delta("pipelineValue"));
  check("no attribution is reported missing", after.attribution.missing === baseline.attribution.missing, { baseline: baseline.attribution.missing, after: after.attribution.missing });

  const attributed = after.sources.find((source) => source.source === campaign);
  check("revenue is attributed to the originating campaign", attributed?.revenue === DEAL_VALUE, attributed);
  check("the attributed source counts one win", attributed?.won === 1, attributed);

  // --- Removing it must return the funnel to baseline ----------------------
  await purge(supabase);
  const restored = await loadRevenueAnalytics(supabase, WINDOW_DAYS);
  check("the funnel returns to baseline once the record is removed", restored.funnel.opportunities === baseline.funnel.opportunities && restored.funnel.wonRevenue === baseline.funnel.wonRevenue, { baseline: baseline.funnel, restored: restored.funnel });

  console.log(JSON.stringify({
    runId, windowDays: WINDOW_DAYS, dealValue: DEAL_VALUE,
    baselineFunnel: baseline.funnel, withDealFunnel: after.funnel, restoredFunnel: restored.funnel,
    ratesWithDeal: after.rates,
    result: failures.length ? "failed" : "passed",
  }, null, 2));

  if (failures.length) {
    console.error(`\nAttribution loop verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Attribution loop verification errored:", error instanceof Error ? error.message : error);
  console.error(`Run ${runId} may have left rows behind. Run with --cleanup.`);
  process.exit(1);
});
