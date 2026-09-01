#!/usr/bin/env tsx
/**
 * Proves operational health cannot report green while something is broken.
 *
 * The previous computation counted only `failed` and `partial`, which hid the
 * two failures most likely to happen unattended: a job stuck `running` because
 * its process died, and a webhook that was received but could not be processed.
 * Both were invisible on every admin surface.
 *
 * Injects each condition against the real database, asserts health notices,
 * then removes it and asserts health returns to its previous reading.
 */
import { randomUUID } from "node:crypto";
import { loadOperationalHealth, STALLED_JOB_MINUTES } from "../src/lib/revenue-os/health";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const JOB_KEY = `revenue-os-health-verify-${randomUUID().slice(0, 8)}`;
const RECEIPT_ID = `revenue-os-health-verify-${randomUUID()}`;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition)
    failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

async function main() {
  const supabase = createServiceRoleClient();
  const baseline = await loadOperationalHealth(supabase);

  try {
    // 1. A job claimed long ago that never reported a result.
    const stale = new Date(Date.now() - (STALLED_JOB_MINUTES + 30) * 60_000).toISOString();
    const { error: jobError } = await supabase
      .from("job_runs")
      .insert({ job_key: JOB_KEY, status: "running", claimed_at: stale });
    if (jobError) throw new Error(`seeding stalled job: ${jobError.message}`);

    const withStalled = await loadOperationalHealth(supabase);
    const stalledRun = withStalled.jobRuns.find((run) => run.key === JOB_KEY);
    check("a job stuck running is reported as stalled", stalledRun?.stalled === true, stalledRun);
    check(
      "a stalled job makes health require attention",
      withStalled.status === "attention",
      withStalled.status,
    );
    check(
      "a stalled job raises a concern that names it",
      withStalled.concerns.some((c) => c.kind === "job" && c.key === JOB_KEY),
      withStalled.concerns.filter((c) => c.kind === "job"),
    );
    check(
      "the stalled concern explains what will happen next",
      withStalled.concerns.some((c) => c.key === JOB_KEY && /take the claim over/i.test(c.detail)),
      withStalled.concerns.find((c) => c.key === JOB_KEY)?.detail,
    );
    check(
      "the stalled job increases the attention count",
      withStalled.attentionCount > baseline.attentionCount,
      { baseline: baseline.attentionCount, withStalled: withStalled.attentionCount },
    );

    // 2. A webhook that arrived and could not be processed.
    const { error: hookError } = await supabase.from("webhook_receipts").insert({
      id: RECEIPT_ID,
      provider: "resend",
      event_type: "email.bounced",
      status: "failed",
      error: "Verification: suppression could not be applied",
    });
    if (hookError) throw new Error(`seeding webhook failure: ${hookError.message}`);

    const withBoth = await loadOperationalHealth(supabase);
    check(
      "a failed webhook receipt is surfaced",
      withBoth.webhookFailures.some((f) => f.id === RECEIPT_ID),
      withBoth.webhookFailures.length,
    );
    check(
      "a failed webhook raises its own concern",
      withBoth.concerns.some((c) => c.kind === "webhook"),
      withBoth.concerns.filter((c) => c.kind === "webhook"),
    );
    check(
      "both failures are counted, not collapsed",
      withBoth.attentionCount >= withStalled.attentionCount + 1,
      { withStalled: withStalled.attentionCount, withBoth: withBoth.attentionCount },
    );
  } finally {
    await supabase.from("job_runs").delete().eq("job_key", JOB_KEY);
    await supabase.from("webhook_receipts").delete().eq("id", RECEIPT_ID);
  }

  const restored = await loadOperationalHealth(supabase);
  check(
    "health returns to its previous reading once the causes are gone",
    restored.attentionCount === baseline.attentionCount,
    { baseline: baseline.attentionCount, restored: restored.attentionCount },
  );

  console.log(
    JSON.stringify(
      {
        baselineStatus: baseline.status,
        baselineConcerns: baseline.attentionCount,
        restoredConcerns: restored.attentionCount,
        result: failures.length ? "failed" : "passed",
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    console.error(`\nHealth truth verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Health truth verification errored:",
    error instanceof Error ? error.message : error,
  );
  console.error(
    `Look for leftovers: job_runs job_key ${JOB_KEY}, webhook_receipts id ${RECEIPT_ID}.`,
  );
  process.exit(1);
});
