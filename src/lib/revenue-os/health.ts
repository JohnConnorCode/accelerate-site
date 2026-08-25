import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One operational health computation, shared by the admin overview, Setup
 * Center, and anything that needs to alert.
 *
 * It previously lived inline in the overview route and counted only `failed`
 * and `partial`, which made two real failures invisible:
 *
 *   - A job stuck `running` read as healthy. That is exactly the state a
 *     crashed run leaves behind, and it used to block its own cron forever.
 *   - `webhook_receipts` recorded failures that no admin surface ever read, so
 *     a bounce that never got processed simply vanished.
 *
 * Health must never be green because nothing said otherwise.
 */

/** Matches the recovery window in claim_revenue_job_run. */
export const STALLED_JOB_MINUTES = 30;
const WEBHOOK_FAILURE_LOOKBACK_HOURS = 48;

export type HealthStatus = "ready" | "attention" | "not_configured";

export interface HealthRunView {
  key: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  /** Claimed long ago and never closed: the process almost certainly died. */
  stalled?: boolean;
}

export interface HealthConcern {
  kind: "integration" | "job" | "source" | "webhook";
  key: string;
  detail: string;
  observedAt: string | null;
}

export interface OperationalHealth {
  status: HealthStatus;
  attentionCount: number;
  integrations: Array<{ provider: string; status: string; lastSuccessAt: string | null; lastError: string | null }>;
  sourceRuns: HealthRunView[];
  jobRuns: HealthRunView[];
  webhookFailures: Array<{ id: string; provider: string; eventType: string | null; error: string | null; receivedAt: string | null }>;
  /** Everything wrong, in a form an alert can be built from. */
  concerns: HealthConcern[];
}

function latestByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = String(row[key] || "");
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function isStalled(status: string, startedAt: string | null): boolean {
  if (status !== "running") return false;
  if (!startedAt) return true;
  return Date.now() - Date.parse(startedAt) > STALLED_JOB_MINUTES * 60_000;
}

export async function loadOperationalHealth(supabase: SupabaseClient): Promise<OperationalHealth> {
  const webhookSince = new Date(Date.now() - WEBHOOK_FAILURE_LOOKBACK_HOURS * 3_600_000).toISOString();
  const [integrationResult, sourceRunsResult, jobRunsResult, webhookResult] = await Promise.all([
    supabase.from("integration_connections").select("provider,status,last_success_at,last_error,updated_at"),
    supabase.from("source_runs").select("source_key,status,started_at,finished_at,error").order("started_at", { ascending: false }).limit(30),
    supabase.from("job_runs").select("job_key,status,claimed_at,finished_at,error").order("claimed_at", { ascending: false }).limit(30),
    supabase.from("webhook_receipts").select("id,provider,event_type,error,received_at").eq("status", "failed").gte("received_at", webhookSince).order("received_at", { ascending: false }).limit(20),
  ]);
  const firstError = [integrationResult.error, sourceRunsResult.error, jobRunsResult.error, webhookResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const integrations = integrationResult.data ?? [];
  const sourceRows = latestByKey(sourceRunsResult.data ?? [], "source_key");
  const jobRows = latestByKey(jobRunsResult.data ?? [], "job_key");
  const webhookFailures = (webhookResult.data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider ?? "unknown"),
    eventType: row.event_type ?? null,
    error: row.error ?? null,
    receivedAt: row.received_at ?? null,
  }));

  const sourceRuns: HealthRunView[] = sourceRows.map((row) => ({
    key: String(row.source_key),
    status: String(row.status),
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    error: row.error ?? null,
  }));

  const jobRuns: HealthRunView[] = jobRows.map((row) => ({
    key: String(row.job_key),
    status: String(row.status),
    startedAt: row.claimed_at ?? null,
    finishedAt: row.finished_at ?? null,
    error: row.error ?? null,
    stalled: isStalled(String(row.status), row.claimed_at ?? null),
  }));

  const concerns: HealthConcern[] = [];
  for (const integration of integrations) {
    if (integration.status === "degraded" || integration.status === "revoked" || integration.last_error) {
      concerns.push({
        kind: "integration",
        key: String(integration.provider),
        detail: integration.last_error || `Connection is ${integration.status}`,
        observedAt: integration.updated_at ?? integration.last_success_at ?? null,
      });
    }
  }
  for (const run of sourceRuns) {
    if (run.status === "failed" || run.status === "partial") {
      concerns.push({ kind: "source", key: run.key, detail: run.error || `Last sync reported ${run.status}`, observedAt: run.finishedAt || run.startedAt });
    }
  }
  for (const run of jobRuns) {
    if (run.stalled) {
      concerns.push({
        kind: "job",
        key: run.key,
        detail: `Claimed at ${run.startedAt ?? "an unknown time"} and never reported a result. The next run will take the claim over.`,
        observedAt: run.startedAt,
      });
    } else if (run.status === "failed" || run.status === "partial") {
      concerns.push({ kind: "job", key: run.key, detail: run.error || `Last run reported ${run.status}`, observedAt: run.finishedAt || run.startedAt });
    }
  }
  for (const failure of webhookFailures) {
    concerns.push({
      kind: "webhook",
      key: `${failure.provider}:${failure.eventType ?? "event"}`,
      detail: failure.error || "Webhook was received but could not be processed",
      observedAt: failure.receivedAt,
    });
  }

  const everWorked =
    integrations.some((item) => item.status === "connected") ||
    sourceRuns.some((item) => item.status === "success") ||
    jobRuns.some((item) => item.status === "success");

  return {
    status: concerns.length ? "attention" : everWorked ? "ready" : "not_configured",
    attentionCount: concerns.length,
    integrations: integrations.map((item) => ({
      provider: String(item.provider),
      status: String(item.status),
      lastSuccessAt: item.last_success_at ?? null,
      lastError: item.last_error ?? null,
    })),
    sourceRuns,
    jobRuns,
    webhookFailures,
    concerns,
  };
}
