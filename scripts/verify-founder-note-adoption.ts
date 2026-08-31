#!/usr/bin/env tsx
/**
 * Read-only founder-note burn-in report.
 *
 * The query intentionally excludes note title and body. It reports whether
 * real captures have spanned a week, whether the median open-to-save time is
 * below ten seconds, and whether provenance is structurally retrievable.
 * Founder usefulness remains a separate human judgment and is never inferred
 * from activity counts.
 */
import { createBootstrapServiceRoleClient } from "../src/lib/supabase/server";
import { loadFounderNoteAdoptionReport } from "../src/lib/revenue-os/notes";

async function main() {
  const founderUsefulnessConfirmed = process.argv.includes("--founder-confirmed-useful");
  const requireReady = process.argv.includes("--require-ready");
  const database = createBootstrapServiceRoleClient("founder-note-adoption-report");
  const report = await loadFounderNoteAdoptionReport(database, { founderUsefulnessConfirmed });

  console.log(JSON.stringify({
    result: report.cardReady ? "ready" : "pending",
    privacy: "No note titles or bodies were selected.",
    ...report,
  }, null, 2));

  if (requireReady && !report.cardReady) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Founder-note adoption report failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
