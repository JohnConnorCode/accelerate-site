#!/usr/bin/env tsx
/**
 * Proves an abandoned job claim can no longer disable its cron forever.
 *
 * Before this, the only transitions out of `running` happened inside the process
 * doing the work, so a Vercel timeout left the row `running` and the partial
 * unique index blocked every future claim. The cron then returned HTTP 200 with
 * {skipped:true} indefinitely and Vercel reported it healthy. Recovery lives
 * inside the claim RPC because both Hobby cron slots are already spoken for.
 *
 * Everything here uses a reserved job key and is removed afterwards.
 */
import { randomUUID } from "node:crypto";
import { startJobRun } from "../src/lib/revenue-os/runs";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const JOB_KEY = `revenue-os-stale-verify-${randomUUID().slice(0, 8)}`;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition)
    failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

type ClaimRow = {
  run_id: string;
  claimed: boolean;
  existing_status: string;
  recovered_stale: boolean;
};

async function claim(supabase: ReturnType<typeof createServiceRoleClient>, staleAfter?: string) {
  const { data, error } = await supabase.rpc("claim_revenue_job_run", {
    p_job_key: JOB_KEY,
    p_claim_key: null,
    ...(staleAfter ? { p_stale_after: staleAfter } : {}),
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as ClaimRow;
}

async function main() {
  const supabase = createServiceRoleClient();

  try {
    // A first claim succeeds and holds the job.
    const first = await claim(supabase);
    check("a first claim succeeds", first.claimed === true, first);
    check("a fresh claim reports no recovery", first.recovered_stale === false, first);

    // A concurrent claim is refused while the first is genuinely in flight.
    const second = await claim(supabase);
    check(
      "a concurrent claim is refused while the job is running",
      second.claimed === false,
      second,
    );
    check("the refusal points at the run already holding the job", second.run_id === first.run_id, {
      first: first.run_id,
      second: second.run_id,
    });

    // Simulate the process dying: the row stays `running` with nobody to close it.
    const abandonedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const { error: ageError } = await supabase
      .from("job_runs")
      .update({ claimed_at: abandonedAt })
      .eq("id", first.run_id);
    if (ageError) throw new Error(`could not age the claim: ${ageError.message}`);

    // The old behaviour: still refused, forever. The new behaviour: taken over.
    const third = await startJobRun(supabase, JOB_KEY);
    check(
      "an abandoned claim is taken over rather than blocking the job",
      third.claimed === true,
      third,
    );
    check("the takeover is reported so it can be alerted on", third.recoveredStale === true, third);
    check(
      "the takeover starts a new run rather than reusing the dead one",
      third.runId !== first.run_id,
      { dead: first.run_id, fresh: third.runId },
    );

    const { data: recovered } = await supabase
      .from("job_runs")
      .select("status,error,finished_at")
      .eq("id", first.run_id)
      .single();
    check(
      "the abandoned run is closed as failed",
      recovered?.status === "failed",
      recovered?.status,
    );
    check(
      "the abandoned run records why it was closed",
      /abandoned/i.test(recovered?.error ?? ""),
      recovered?.error,
    );
    check(
      "the abandoned run gets a terminal timestamp",
      Boolean(recovered?.finished_at),
      recovered?.finished_at,
    );

    const { data: fresh } = await supabase
      .from("job_runs")
      .select("recovered_from")
      .eq("id", third.runId)
      .single();
    check(
      "the new run points back at what it recovered from",
      fresh?.recovered_from === first.run_id,
      fresh,
    );

    const { data: audits } = await supabase
      .from("audit_log")
      .select("action,entity_id,metadata")
      .eq("action", "execution.stale_claim_recovered")
      .eq("entity_id", third.runId);
    check("the takeover writes an audit receipt", (audits?.length ?? 0) > 0, audits);

    // A long-running job that is still inside the window must never be stolen.
    const fourth = await claim(supabase, "24 hours");
    check("a job still inside the stale window is left alone", fourth.claimed === false, fourth);

    console.log(
      JSON.stringify(
        {
          jobKey: JOB_KEY,
          deadRun: first.run_id,
          recoveredBy: third.runId,
          result: failures.length ? "failed" : "passed",
        },
        null,
        2,
      ),
    );
  } finally {
    await supabase.from("job_runs").delete().eq("job_key", JOB_KEY);
    await supabase
      .from("audit_log")
      .delete()
      .eq("action", "execution.stale_claim_recovered")
      .eq("metadata->>job_key", JOB_KEY);
  }

  if (failures.length) {
    console.error(`\nStale claim recovery failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Stale claim recovery verification errored:",
    error instanceof Error ? error.message : error,
  );
  console.error(`Look for leftover job_runs with job_key ${JOB_KEY}.`);
  process.exit(1);
});
