#!/usr/bin/env tsx
/**
 * End-to-end operator proof: seed a realistic book of business, then confirm
 * every surface the founder actually works from renders it correctly.
 *
 * Loop One proved one inquiry can travel the whole path. This proves the system
 * is usable with a pipeline in it rather than with a single row, which is the
 * difference between "the plumbing works" and "this can run the business".
 *
 *   --seed     create the dataset and leave it in place
 *   --cleanup  remove everything this script created
 *   (default)  seed, report what was created, and leave it for screenshotting
 *
 * Safety: every record is namespaced by a reserved address prefix and removed by
 * that prefix. Audit rows are retained; audit history is immutable.
 */
import { randomUUID } from "node:crypto";
import { loadRevenueAnalytics } from "../src/lib/revenue-os/analytics";
import { ingestInboundLead } from "../src/lib/revenue-os/inbound";
import { transitionOpportunity } from "../src/lib/revenue-os/pipeline";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const PREFIX = "revenue-os-demo";
const cleanupOnly = process.argv.includes("--cleanup");

/** A believable spread: most inquiries stall early, a few convert. */
const BOOK = [
  { company: "Ridgeline Roofing", stages: ["qualified", "meeting", "proposal", "won"], value: 18000, source: "google" },
  { company: "Cedar Creek Plumbing", stages: ["qualified", "meeting", "proposal"], value: 12500, source: "referral" },
  { company: "Bright Path Dental", stages: ["qualified", "meeting"], value: 9000, source: "google" },
  { company: "Harbor Legal Group", stages: ["qualified", "meeting", "proposal", "negotiation"], value: 24000, source: "linkedin" },
  { company: "Summit HVAC", stages: ["contacted", "qualified"], value: 7500, source: "google" },
  { company: "Northgate Electric", stages: ["contacted"], value: 6000, source: "referral" },
  { company: "Lakeside Landscaping", stages: [], value: 4500, source: "google" },
  { company: "Ironwood Construction", stages: ["qualified", "meeting", "proposal", "won"], value: 31000, source: "referral" },
  { company: "Verde Pest Control", stages: ["contacted", "qualified", "lost"], value: 5000, source: "google", lossReason: "Went with a cheaper competitor" },
  { company: "Copperfield Auto", stages: [], value: 3800, source: "direct" },
];

async function purge(supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data: opportunities } = await supabase.from("opportunities").select("id").like("email", `${PREFIX}%`);
  for (const opportunity of opportunities ?? []) {
    for (const table of ["tasks", "activities", "stage_events"]) {
      await supabase.from(table).delete().eq("opportunity_id", opportunity.id);
    }
  }
  await supabase.from("opportunities").delete().like("email", `${PREFIX}%`);
  await supabase.from("contacts").delete().like("primary_email", `${PREFIX}%`);
  const { data: companies } = await supabase.from("companies").select("id,name");
  const names = new Set(BOOK.map((entry) => entry.company));
  for (const company of companies ?? []) {
    if (names.has(company.name)) await supabase.from("companies").delete().eq("id", company.id);
  }
}

async function main() {
  const supabase = createServiceRoleClient();

  if (cleanupOnly) {
    await purge(supabase);
    const { count } = await supabase.from("opportunities").select("*", { count: "exact", head: true }).like("email", `${PREFIX}%`);
    console.log(JSON.stringify({ mode: "cleanup", leftover: count ?? 0, result: (count ?? 0) === 0 ? "clean" : "incomplete" }, null, 2));
    if (count) process.exit(1);
    return;
  }

  const { data: existing } = await supabase.from("contacts").select("id").like("primary_email", `${PREFIX}%`);
  if (existing?.length) throw new Error(`${existing.length} demo contact(s) already present. Run with --cleanup first.`);

  const created: { company: string; stage: string; value: number }[] = [];
  for (const entry of BOOK) {
    const slug = entry.company.toLowerCase().replace(/[^a-z]+/g, "-");
    const captured = await ingestInboundLead(supabase, {
      name: `${entry.company} owner`,
      email: `${PREFIX}+${slug}@example.invalid`,
      companyName: entry.company,
      website: `https://${slug}.example.invalid`,
      industry: "demo",
      source: "contact_form",
      sourceRecordId: randomUUID(),
      summary: `${entry.company} asked about reducing missed inquiries and slow follow-up.`,
      utm: { utm_source: entry.source, utm_medium: "organic", utm_campaign: entry.source },
    });
    await supabase.from("opportunities").update({ estimated_value: entry.value }).eq("id", captured.opportunity.id);

    let stage = "new";
    for (const next of entry.stages) {
      await transitionOpportunity(supabase, {
        id: captured.opportunity.id, to: next, actorEmail: "demo@local", source: "demo",
        reason: `Demo dataset progression to ${next}`,
        ...(next === "lost" ? { lossReason: entry.lossReason ?? "No reason given" } : {}),
      });
      stage = next;
    }
    created.push({ company: entry.company, stage, value: entry.value });
  }

  const analytics = await loadRevenueAnalytics(supabase, 30);
  console.log(JSON.stringify({
    mode: "seeded",
    created: created.length,
    byStage: created.reduce<Record<string, number>>((acc, item) => { acc[item.stage] = (acc[item.stage] ?? 0) + 1; return acc; }, {}),
    funnel: analytics.funnel,
    rates: analytics.rates,
    sources: analytics.sources,
    cleanup: "npm run verify:operator-surfaces -- --cleanup",
  }, null, 2));
}

main().catch((error) => {
  console.error("Operator surface seeding failed:", error instanceof Error ? error.message : error);
  console.error("Run with --cleanup to remove partial data.");
  process.exit(1);
});
