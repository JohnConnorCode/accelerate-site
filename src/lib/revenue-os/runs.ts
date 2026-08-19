import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeErrorMessage } from "./db";

export interface JobRunClaim { runId: string; claimed: boolean; existingStatus: string }
export interface JobRunOutcome<T> { value: T | null; claimed: boolean; runId: string; existingStatus?: string }

export async function startJobRun(supabase: SupabaseClient, jobKey: string, idempotencyKey?: string): Promise<JobRunClaim> {
  const { data, error } = await supabase.rpc("claim_revenue_job_run", {
    p_job_key: jobKey,
    p_claim_key: idempotencyKey ?? null,
  }).single();
  if (error) throw new Error(error.message);
  const claim = data as { run_id: string; claimed: boolean; existing_status: string };
  return { runId: claim.run_id, claimed: Boolean(claim.claimed), existingStatus: claim.existing_status };
}

export async function finishJobRun(supabase: SupabaseClient, id: string, summary: Record<string, unknown>, status: "success" | "partial" | "skipped" = "success") {
  const { error } = await supabase.from("job_runs").update({ status, summary, finished_at: new Date().toISOString() }).eq("id", id).eq("status", "running");
  if (error) throw new Error(error.message);
}

export async function failJobRun(supabase: SupabaseClient, id: string, error: unknown) {
  await supabase.from("job_runs").update({ status: "failed", error: safeErrorMessage(error), finished_at: new Date().toISOString() }).eq("id", id).eq("status", "running");
}

export async function withJobRun<T>(supabase: SupabaseClient, jobKey: string, work: () => Promise<{ value: T; summary: Record<string, unknown>; status?: "success" | "partial" | "skipped" }>, idempotencyKey?: string): Promise<JobRunOutcome<T>> {
  const claim = await startJobRun(supabase, jobKey, idempotencyKey);
  if (!claim.claimed) return { value: null, claimed: false, runId: claim.runId, existingStatus: claim.existingStatus };
  try {
    const result = await work();
    await finishJobRun(supabase, claim.runId, result.summary, result.status);
    return { value: result.value, claimed: true, runId: claim.runId };
  } catch (error) {
    await failJobRun(supabase, claim.runId, error);
    throw error;
  }
}

export async function recordSourceRun(supabase: SupabaseClient, input: {
  sourceKey: string;
  status: "success" | "partial" | "failed" | "not_configured";
  summary?: Record<string, unknown>;
  cursor?: unknown;
  error?: string;
}) {
  await supabase.from("source_runs").insert({
    source_key: input.sourceKey,
    status: input.status,
    summary: input.summary ?? {},
    cursor: input.cursor ?? null,
    error: input.error ?? null,
    finished_at: new Date().toISOString(),
  });
}
