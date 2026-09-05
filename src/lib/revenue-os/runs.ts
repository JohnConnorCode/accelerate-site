import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { safeErrorMessage } from "./db";
import { alertJobFailure, alertStaleRecovery } from "./alerts";

export const STALE_CLAIM_WINDOW_MS = 30 * 60 * 1000;

export async function recordStaleClaimRecovery(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    recoveredFrom?: string | null;
    detail: string;
    jobKey?: string | null;
  },
) {
  await recordAudit(supabase, {
    actorEmail: "system",
    action: "execution.stale_claim_recovered",
    entityType: input.entityType,
    entityId: input.entityId,
    source: "automation",
    before: { status: "running" },
    after: { status: "failed", recovered: true },
    metadata: {
      job_key: input.jobKey ?? null,
      recovered_from: input.recoveredFrom ?? null,
      detail: input.detail,
      stale_after_ms: STALE_CLAIM_WINDOW_MS,
    },
  });
}

export interface JobRunClaim {
  runId: string;
  claimed: boolean;
  existingStatus: string;
  recoveredStale: boolean;
}
export interface JobRunOutcome<T> {
  value: T | null;
  claimed: boolean;
  runId: string;
  existingStatus?: string;
  recoveredStale?: boolean;
}

export async function startJobRun(
  supabase: SupabaseClient,
  jobKey: string,
  idempotencyKey?: string,
): Promise<JobRunClaim> {
  const { data, error } = await supabase
    .rpc("claim_revenue_job_run", {
      p_job_key: jobKey,
      p_claim_key: idempotencyKey ?? null,
    })
    .single();
  if (error) throw new Error(error.message);
  const claim = data as {
    run_id: string;
    claimed: boolean;
    existing_status: string;
    recovered_stale?: boolean;
  };
  // recovered_stale means this claim took over a run that died without ever
  // reporting a terminal state. It is surfaced rather than absorbed, because a
  // job that keeps needing recovery is a failing job, not a healthy one.
  const recoveredStale = Boolean(claim.recovered_stale);
  if (recoveredStale && Boolean(claim.claimed)) {
    const { data: fresh } = await supabase
      .from("job_runs")
      .select("recovered_from")
      .eq("id", claim.run_id)
      .maybeSingle();
    await recordStaleClaimRecovery(supabase, {
      entityType: "job_run",
      entityId: claim.run_id,
      recoveredFrom: typeof fresh?.recovered_from === "string" ? fresh.recovered_from : null,
      jobKey,
      detail: `A previous ${jobKey} run claimed the job and never reported a terminal state, so this claim took it over.`,
    });
  }
  return {
    runId: claim.run_id,
    claimed: Boolean(claim.claimed),
    existingStatus: claim.existing_status,
    recoveredStale,
  };
}

export async function finishJobRun(
  supabase: SupabaseClient,
  id: string,
  summary: Record<string, unknown>,
  status: "success" | "partial" | "skipped" | "failed" = "success",
) {
  const { error } = await supabase
    .from("job_runs")
    .update({
      status,
      summary,
      finished_at: new Date().toISOString(),
      ...(status === "failed" ? { error: "Job reported failed work; see execution summary" } : {}),
    })
    .eq("id", id)
    .eq("status", "running");
  if (error) throw new Error(error.message);
}

export async function failJobRun(supabase: SupabaseClient, id: string, error: unknown) {
  await supabase
    .from("job_runs")
    .update({
      status: "failed",
      error: safeErrorMessage(error),
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "running");
}

export async function withJobRun<T>(
  supabase: SupabaseClient,
  jobKey: string,
  work: () => Promise<{
    value: T;
    summary: Record<string, unknown>;
    status?: "success" | "partial" | "skipped" | "failed";
  }>,
  idempotencyKey?: string,
): Promise<JobRunOutcome<T>> {
  const claim = await startJobRun(supabase, jobKey, idempotencyKey);
  if (!claim.claimed) {
    return {
      value: null,
      claimed: false,
      runId: claim.runId,
      existingStatus: claim.existingStatus,
      recoveredStale: false,
    };
  }
  // A takeover means the previous run died partway through. Report it before
  // doing the work, so the signal survives even if this run also fails.
  if (claim.recoveredStale) await alertStaleRecovery(supabase, jobKey);
  try {
    const result = await work();
    await finishJobRun(supabase, claim.runId, result.summary, result.status);
    return {
      value: result.value,
      claimed: true,
      runId: claim.runId,
      recoveredStale: claim.recoveredStale,
    };
  } catch (error) {
    await failJobRun(supabase, claim.runId, error);
    // This is the one place every scheduled job's failure passes through, which
    // makes it the natural interception point. Alerting must never replace the
    // original error, so it is best-effort and the throw still wins.
    await alertJobFailure(supabase, jobKey, error).catch(() => undefined);
    throw error;
  }
}

export async function recordSourceRun(
  supabase: SupabaseClient,
  input: {
    sourceKey: string;
    status: "success" | "partial" | "failed" | "not_configured";
    summary?: Record<string, unknown>;
    cursor?: unknown;
    error?: string;
  },
) {
  await supabase.from("source_runs").insert({
    source_key: input.sourceKey,
    status: input.status,
    summary: input.summary ?? {},
    cursor: input.cursor ?? null,
    error: input.error ?? null,
    finished_at: new Date().toISOString(),
  });
}
