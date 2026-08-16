import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeErrorMessage } from "./db";

export async function startJobRun(supabase: SupabaseClient, jobKey: string, idempotencyKey?: string) {
  const { data, error } = await supabase.from("job_runs").insert({
    job_key: jobKey,
    status: "running",
    idempotency_key: idempotencyKey ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function finishJobRun(supabase: SupabaseClient, id: string, summary: Record<string, unknown>, status: "success" | "partial" | "skipped" = "success") {
  const { error } = await supabase.from("job_runs").update({ status, summary, finished_at: new Date().toISOString() }).eq("id", id).eq("status", "running");
  if (error) throw new Error(error.message);
}

export async function failJobRun(supabase: SupabaseClient, id: string, error: unknown) {
  await supabase.from("job_runs").update({ status: "failed", error: safeErrorMessage(error), finished_at: new Date().toISOString() }).eq("id", id).eq("status", "running");
}

export async function withJobRun<T>(supabase: SupabaseClient, jobKey: string, work: () => Promise<{ value: T; summary: Record<string, unknown>; status?: "success" | "partial" | "skipped" }>, idempotencyKey?: string): Promise<T> {
  const id = await startJobRun(supabase, jobKey, idempotencyKey);
  try {
    const result = await work();
    await finishJobRun(supabase, id, result.summary, result.status);
    return result.value;
  } catch (error) {
    await failJobRun(supabase, id, error);
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
