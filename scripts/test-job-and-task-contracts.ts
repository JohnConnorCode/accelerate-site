#!/usr/bin/env tsx
/**
 * Coverage for three modules that decide whether scheduled work is honest.
 *
 *   - `runs.ts` wraps every scheduled job. If `withJobRun` does not write the
 *     failed receipt before rethrowing, a crashed job leaves a `running` row
 *     that the claim RPC then refuses to displace, and the cron reports
 *     `{skipped:true}` with HTTP 200 forever. That failure mode is the reason
 *     stale-claim recovery exists, so the wrapper's ordering is load-bearing.
 *   - `tasks.ts` dedupes follow-ups. A broken dedupe key either buries the
 *     founder in copies of the same task or, worse, silently drops a real one.
 *   - `campaigns.ts` decides how much mail leaves the building. The per-campaign
 *     limit alone let N active campaigns each send their own cap from the same
 *     sending domain, so the global ceiling is what protects the domain.
 */
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { failJobRun, finishJobRun, startJobRun, withJobRun } from "../src/lib/revenue-os/runs";
import { createRevenueTask } from "../src/lib/revenue-os/tasks";
import {
  globalDailySendCap,
  normalizeCampaignPolicy,
  recoverStaleCampaignSendClaims,
  renderCampaignTemplate,
} from "../src/lib/revenue-os/campaigns";

/** A MemorySupabase with the job-claim RPC wired to a real ledger row. */
function jobHarness(
  options: { claimed?: boolean; recoveredStale?: boolean; existingStatus?: string } = {},
) {
  const db = new MemorySupabase({
    job_runs: [],
    admin_notifications: [],
    sent_emails: [],
    messages: [],
  });
  const claimed = options.claimed !== false;
  db.rpc("claim_revenue_job_run", (args) => {
    const runId = "run-1";
    if (claimed)
      db.rows("job_runs").push({
        id: runId,
        job_key: args.p_job_key,
        status: "running",
        summary: null,
        error: null,
        finished_at: null,
        recovered_from: options.recoveredStale ? "run-dead" : null,
      });
    return {
      run_id: runId,
      claimed,
      existing_status: options.existingStatus ?? (claimed ? "running" : "running"),
      recovered_stale: Boolean(options.recoveredStale),
    };
  });
  return db;
}

async function rejects(run: () => Promise<unknown>, includes: string, because: string) {
  let message: string | null = null;
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert.ok(message !== null, `expected a rejection: ${because}`);
  assert.ok(
    message.toLowerCase().includes(includes.toLowerCase()),
    `${because}\n  expected the message to mention "${includes}"\n  got: ${message}`,
  );
}

async function main() {
  // ---- withJobRun: success closes the receipt ---------------------------

  const good = jobHarness();
  const success = await withJobRun(good.client, "revenue-campaigns", async () => ({
    value: { sent: 3 },
    summary: { sent: 3, failed: 0 },
  }));
  assert.deepEqual(success.value, { sent: 3 });
  assert.equal(success.claimed, true);
  const closed = good.rows("job_runs")[0]!;
  assert.equal(
    closed.status,
    "success",
    "a job that returned must not be left `running`; that is what blocks the next claim",
  );
  assert.deepEqual(
    closed.summary,
    { sent: 3, failed: 0 },
    "the summary is what the health surface reads",
  );
  assert.ok(closed.finished_at, "a closed run must record finished_at");

  // ---- withJobRun: failure is recorded AND rethrown ---------------------

  const bad = jobHarness();
  await rejects(
    () =>
      withJobRun(bad.client, "revenue-campaigns", async () => {
        throw new Error("provider refused the batch");
      }),
    "provider refused",
    "the original error must survive; swallowing it would let the cron return HTTP 200 for a run that failed",
  );
  const failed = bad.rows("job_runs")[0]!;
  assert.equal(
    failed.status,
    "failed",
    "a crashed job must write its failed receipt, or the row stays `running` and the partial unique index blocks every future claim",
  );
  assert.match(
    String(failed.error),
    /provider refused/,
    "the failure reason must reach the ledger",
  );
  assert.ok(failed.finished_at, "a failed run must still record finished_at");

  // ---- An unclaimed job does no work and reports why -------------------

  const busy = jobHarness({ claimed: false, existingStatus: "running" });
  let ran = false;
  const skipped = await withJobRun(busy.client, "revenue-campaigns", async () => {
    ran = true;
    return { value: null, summary: {} };
  });
  assert.equal(
    ran,
    false,
    "losing the claim must skip the work entirely; running it anyway is how a job double-sends",
  );
  assert.equal(skipped.claimed, false);
  assert.equal(
    skipped.existingStatus,
    "running",
    "the caller must be able to say what already owns the job",
  );

  // ---- A stale takeover is surfaced, not absorbed ----------------------

  const recovered = jobHarness({ recoveredStale: true });
  const takeover = await withJobRun(recovered.client, "google-workspace-sync", async () => ({
    value: 1,
    summary: {},
  }));
  assert.equal(
    takeover.recoveredStale,
    true,
    "a job that keeps needing recovery is a failing job; absorbing the takeover hides that",
  );
  const recoveryAudit = recovered
    .rows("audit_log")
    .find((row) => row.action === "execution.stale_claim_recovered");
  assert.ok(
    recoveryAudit,
    "stale job recovery must write an audit receipt, not only an operator alert",
  );
  assert.equal(recoveryAudit?.entity_id, "run-1");
  assert.equal(
    (recoveryAudit?.metadata as { recovered_from?: string } | undefined)?.recovered_from,
    "run-dead",
  );

  // ---- Terminal writes are scoped to `running` -------------------------

  // Both finishJobRun and failJobRun filter on `status = 'running'`. Without it
  // a late completion overwrites a run that already failed, and the ledger
  // reports success for work that did not happen.
  const late = new MemorySupabase({
    job_runs: [
      {
        id: "run-9",
        status: "failed",
        error: "died mid-batch",
        summary: null,
        finished_at: "2026-08-19T00:00:00.000Z",
      },
    ],
  });
  await finishJobRun(late.client, "run-9", { sent: 99 });
  assert.equal(
    late.rows("job_runs")[0]!.status,
    "failed",
    "finishJobRun must not resurrect a run that already failed",
  );
  assert.equal(
    late.rows("job_runs")[0]!.error,
    "died mid-batch",
    "the real failure reason must survive",
  );

  const done = new MemorySupabase({
    job_runs: [
      {
        id: "run-9",
        status: "success",
        error: null,
        summary: { sent: 2 },
        finished_at: "2026-08-19T00:00:00.000Z",
      },
    ],
  });
  await failJobRun(done.client, "run-9", new Error("late failure"));
  assert.equal(
    done.rows("job_runs")[0]!.status,
    "success",
    "failJobRun must not overwrite a run that already succeeded",
  );

  // ---- A claim RPC error surfaces rather than silently not claiming ----

  const brokenRpc = new MemorySupabase({ job_runs: [] });
  brokenRpc.rpc("claim_revenue_job_run", () => ({
    data: null,
    error: { message: "function does not exist" },
  }));
  await rejects(
    () => startJobRun(brokenRpc.client, "revenue-campaigns"),
    "does not exist",
    "a broken claim must throw; treating it as 'not claimed' would make a missing migration look like healthy contention",
  );

  // ---- Task dedupe --------------------------------------------------

  const tasks = new MemorySupabase({ tasks: [], audit_log: [], activities: [] });
  const first = await createRevenueTask(tasks.client, {
    title: "Call Northside back",
    source: "inbound",
    dedupeKey: "inbound:opp-1",
    actorEmail: "system",
  });
  assert.equal(first.deduplicated, false);
  assert.equal(tasks.rows("tasks").length, 1);
  assert.equal(
    tasks.rows("activities").length,
    1,
    "a created task must leave an activity receipt; it is how Today explains itself",
  );

  const again = await createRevenueTask(tasks.client, {
    title: "Call Northside back",
    source: "inbound",
    dedupeKey: "inbound:opp-1",
    actorEmail: "system",
  });
  assert.equal(again.deduplicated, true, "the same follow-up must not be created twice");
  assert.equal(tasks.rows("tasks").length, 1, "dedupe must prevent the row, not just flag it");
  assert.equal(
    (again.task as { id: string }).id,
    (first.task as { id: string }).id,
    "the existing task must be returned so the caller can link to it",
  );

  // Once the original is completed the key is free again: a later inbound from
  // the same contact deserves a fresh follow-up, not silence.
  tasks.rows("tasks")[0]!.status = "completed";
  const afterCompletion = await createRevenueTask(tasks.client, {
    title: "Call Northside back",
    source: "inbound",
    dedupeKey: "inbound:opp-1",
    actorEmail: "system",
  });
  assert.equal(
    afterCompletion.deduplicated,
    false,
    "dedupe is scoped to open tasks; a completed one must not suppress the next real follow-up forever",
  );
  assert.equal(tasks.rows("tasks").length, 2);

  // A task with no dedupe key is always created; dedupe must be opt-in.
  const undeduped = new MemorySupabase({ tasks: [], audit_log: [], activities: [] });
  await createRevenueTask(undeduped.client, {
    title: "Ad hoc",
    source: "manual",
    actorEmail: "john@acceleratewith.us",
  });
  await createRevenueTask(undeduped.client, {
    title: "Ad hoc",
    source: "manual",
    actorEmail: "john@acceleratewith.us",
  });
  assert.equal(
    undeduped.rows("tasks").length,
    2,
    "without a dedupe key every task must be created",
  );

  await rejects(
    () =>
      createRevenueTask(undeduped.client, {
        title: "   ",
        source: "manual",
        actorEmail: "john@acceleratewith.us",
      }),
    "title is required",
    "a blank title must be refused; an untitled task in Today tells the founder nothing",
  );

  // ---- Campaign policy normalisation ----------------------------------

  delete process.env.CAMPAIGN_AUTOMATION_ENABLED;
  delete process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT;

  assert.deepEqual(
    normalizeCampaignPolicy(undefined),
    {
      daily_limit: 10,
      stop_on_reply: true,
      stop_on_booking: true,
      stop_on_bounce: true,
      stop_on_unsubscribe: true,
    },
    "the default policy must stop on every signal; opting out has to be deliberate",
  );
  assert.equal(
    normalizeCampaignPolicy({ daily_limit: 5000 }).daily_limit,
    10,
    "a campaign must not be able to raise its own ceiling past the automation gate",
  );
  assert.equal(
    normalizeCampaignPolicy({ daily_limit: 0 }).daily_limit,
    10,
    "0 is falsy and falls through to the default, which is the right call: a campaign silently capped at zero would look like a quiet success while sending nothing",
  );
  assert.equal(
    normalizeCampaignPolicy({ daily_limit: -5 }).daily_limit,
    1,
    "a negative limit must floor at 1 rather than producing a nonsense budget",
  );
  assert.equal(
    normalizeCampaignPolicy({ daily_limit: "not a number" }).daily_limit,
    10,
    "a malformed limit must fall back to the default rather than becoming NaN",
  );
  assert.equal(
    normalizeCampaignPolicy({ stop_on_reply: false }).stop_on_reply,
    false,
    "an explicit opt-out must be honoured",
  );
  assert.equal(
    normalizeCampaignPolicy({ stop_on_reply: "no" }).stop_on_reply,
    true,
    "only an explicit false disables a stop rule; anything else stays safe",
  );

  assert.equal(
    globalDailySendCap(),
    10,
    "without the automation flag the account-wide ceiling is the conservative one",
  );
  process.env.CAMPAIGN_AUTOMATION_ENABLED = "true";
  assert.equal(globalDailySendCap(), 200);
  assert.equal(
    normalizeCampaignPolicy({ daily_limit: 5000 }).daily_limit,
    200,
    "the automation flag raises the ceiling but does not remove it",
  );
  process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT = "50";
  assert.equal(globalDailySendCap(), 50, "an explicit override below the ceiling must be honoured");
  process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT = "999999";
  assert.equal(
    globalDailySendCap(),
    2000,
    "an override must still be bounded; a typo must not uncap the sending domain",
  );
  delete process.env.CAMPAIGN_AUTOMATION_ENABLED;
  delete process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT;

  // ---- Template rendering leaves no placeholders ----------------------

  assert.equal(
    renderCampaignTemplate("Hi {{first_name}}, about {{topic}}.", {
      first_name: "Dana",
      topic: "intake",
    }),
    "Hi Dana, about intake.",
  );
  assert.equal(
    renderCampaignTemplate("Hi {{first_name}},", { first_name: null }),
    "Hi ,",
    "a missing value must render empty rather than leaking `{{first_name}}` into a prospect's inbox",
  );
  assert.equal(
    renderCampaignTemplate("Hi {{ first_name }},", { first_name: "Dana" }),
    "Hi Dana,",
    "whitespace inside the braces must still match",
  );
  assert.equal(
    renderCampaignTemplate("Hi {{unknown_key}}.", {}),
    "Hi .",
    "an unknown placeholder must not survive into the sent body",
  );
  assert.equal(
    renderCampaignTemplate("Hi {{first_name}}.", { first_name: "   " }),
    "Hi .",
    "a whitespace-only value counts as missing",
  );

  // ---- Abandoned campaign send claims are released and audited --------

  const staleSend = new MemorySupabase({
    campaign_members: [
      {
        id: "member-1",
        campaign_id: "campaign-1",
        status: "sending",
        send_claimed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        send_claim_key: "campaign:campaign-1:member:member-1:step:0",
      },
    ],
    audit_log: [],
  });
  const released = await recoverStaleCampaignSendClaims(staleSend.client);
  assert.equal(released, 1, "a send left `sending` past the stale window must be released");
  assert.equal(
    staleSend.rows("campaign_members")[0]!.status,
    "active",
    "the member must return to active so the original send key can retry",
  );
  assert.ok(
    staleSend
      .rows("audit_log")
      .some(
        (row) => row.action === "execution.stale_claim_recovered" && row.entity_id === "member-1",
      ),
    "campaign send recovery must write an audit receipt",
  );

  console.log(
    JSON.stringify(
      {
        checks: [
          "job-success-receipt",
          "job-failure-recorded-and-rethrown",
          "unclaimed-does-no-work",
          "stale-takeover-surfaced",
          "job-terminal-writes-scoped",
          "claim-rpc-error-surfaces",
          "task-dedupe",
          "dedupe-scoped-to-open",
          "dedupe-opt-in",
          "blank-title-refused",
          "policy-normalisation",
          "global-cap-bounded",
          "template-leaves-no-placeholders",
          "stale-campaign-send-recovered",
        ],
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
