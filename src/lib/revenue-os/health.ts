import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPECTED_CADENCE_LABELS } from "./health-expectation";

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

/** Cadence at which each subsystem is checked / expected to produce a result. */
export const EXPECTED_CADENCES = {
  /** Integration connections are checked on every overview render; no fixed cadence. */
  integration: null as number | null,
  /** Source runs: every 60 minutes the sync jobs execute. */
  source: 60,
  /** Job runs: the same window used to detect a stalled claim. */
  job: STALLED_JOB_MINUTES,
  /** Webhook failures are surfaced against the lookback window. */
  webhook: WEBHOOK_FAILURE_LOOKBACK_HOURS,
} as const;

export type HealthStatus = "ready" | "attention" | "not_configured";

export interface HealthRunView {
  key: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  /** Claimed long ago and never closed: the process almost certainly died. */
  stalled?: boolean;
  /** Last time this key produced a successful result (ms since epoch). */
  lastSuccessAt?: number;
  /** Expected next execution window end (ms since epoch). */
  nextExpectedAt?: number;
  /** Operator cadence wording for this run's subsystem ("hourly", …). */
  cadenceLabel?: string;
}

export interface HealthConcern {
  kind: "integration" | "job" | "source" | "webhook";
  key: string;
  detail: string;
  observedAt: string | null;
}

export interface IntegrationHealth {
  provider: string;
  status: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** When the integration connection was last updated (ms since epoch). */
  updatedAt?: number;
}

export interface OperationalHealth {
  status: HealthStatus;
  attentionCount: number;
  integrations: IntegrationHealth[];
  sourceRuns: HealthRunView[];
  jobRuns: HealthRunView[];
  webhookFailures: Array<{
    id: string;
    provider: string;
    eventType: string | null;
    error: string | null;
    receivedAt: string | null;
    /** Expected next check window end (ms since epoch). */
    nextExpectedAt?: number;
  }>;
  /** Everything wrong, in a form an alert can be built from. */
  concerns: HealthConcern[];
}

/** Milliseconds from now until the next expected check for the given cadence key. */
export function msUntilNextExpected(cadenceMs?: number): number | undefined {
  if (cadenceMs == null || cadenceMs <= 0) return undefined;
  const now = Date.now();
  return Math.max(0, cadenceMs - (now % cadenceMs));
}

/**
 * Absolute epoch ms of the next expected check — what every `nextExpectedAt`
 * field actually needs, since it's later compared against `Date.now()`
 * directly (`run.nextExpectedAt - Date.now()`). `msUntilNextExpected` alone
 * returns a duration, not a timestamp; assigning it straight into
 * `nextExpectedAt` made every concern read as overdue by ~55 years the
 * instant it was computed.
 */
function nextExpectedAt(cadenceMs?: number): number | undefined {
  const until = msUntilNextExpected(cadenceMs);
  return until === undefined ? undefined : Date.now() + until;
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
  const webhookSince = new Date(
    Date.now() - WEBHOOK_FAILURE_LOOKBACK_HOURS * 3_600_000,
  ).toISOString();
  const [integrationResult, sourceRunsResult, jobRunsResult, webhookResult] = await Promise.all([
    supabase
      .from("integration_connections")
      .select("provider,status,last_success_at,last_error,updated_at"),
    supabase
      .from("source_runs")
      .select("source_key,status,started_at,finished_at,error")
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("job_runs")
      .select("job_key,status,claimed_at,finished_at,error")
      .order("claimed_at", { ascending: false })
      .limit(30),
    supabase
      .from("webhook_receipts")
      .select("id,provider,event_type,error,received_at")
      .eq("status", "failed")
      .gte("received_at", webhookSince)
      .order("received_at", { ascending: false })
      .limit(20),
  ]);
  const firstError = [
    integrationResult.error,
    sourceRunsResult.error,
    jobRunsResult.error,
    webhookResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const integrations = integrationResult.data ?? [];
  const sourceRows = latestByKey(sourceRunsResult.data ?? [], "source_key");
  const jobRows = latestByKey(jobRunsResult.data ?? [], "job_key");

  const integrationHealths: IntegrationHealth[] = integrations.map((item) => ({
    provider: String(item.provider),
    status: String(item.status),
    lastSuccessAt: item.last_success_at ?? null,
    lastError: item.last_error ?? null,
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : undefined,
  }));

  const sourceCadenceMs = (EXPECTED_CADENCES.source ?? 0) * 60_000;
  const sourceRuns: HealthRunView[] = sourceRows.map((row) => ({
    key: String(row.source_key),
    status: String(row.status),
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    error: row.error ?? null,
    lastSuccessAt: row.finished_at ? Date.parse(row.finished_at) : undefined,
    nextExpectedAt: nextExpectedAt(sourceCadenceMs),
    cadenceLabel: EXPECTED_CADENCE_LABELS.source,
  }));

  const jobCadenceMs = (EXPECTED_CADENCES.job ?? 0) * 60_000;
  const jobRuns: HealthRunView[] = jobRows.map((row) => ({
    key: String(row.job_key),
    status: String(row.status),
    startedAt: row.claimed_at ?? null,
    finishedAt: row.finished_at ?? null,
    error: row.error ?? null,
    stalled: isStalled(String(row.status), row.claimed_at ?? null),
    lastSuccessAt: row.finished_at ? Date.parse(row.finished_at) : undefined,
    nextExpectedAt: nextExpectedAt(jobCadenceMs),
    cadenceLabel: EXPECTED_CADENCE_LABELS.job,
  }));

  const webhookCadenceMs = (EXPECTED_CADENCES.webhook ?? 0) * 60_000;
  const webhookFailures = (webhookResult.data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider ?? "unknown"),
    eventType: row.event_type ?? null,
    error: row.error ?? null,
    receivedAt: row.received_at ?? null,
    nextExpectedAt: nextExpectedAt(webhookCadenceMs),
  }));

  const concerns: HealthConcern[] = [];
  for (const integration of integrationHealths) {
    if (
      integration.status === "degraded" ||
      integration.status === "revoked" ||
      integration.lastError
    ) {
      concerns.push({
        kind: "integration",
        key: integration.provider,
        detail: integration.lastError || `Connection is ${integration.status}`,
        observedAt:
          integration.lastSuccessAt ??
          (integration.updatedAt ? new Date(integration.updatedAt).toISOString() : null),
      });
    }
  }
  for (const run of sourceRuns) {
    if (run.status === "failed" || run.status === "partial") {
      concerns.push({
        kind: "source",
        key: run.key,
        detail: run.error || `Last sync reported ${run.status}`,
        observedAt: run.finishedAt || run.startedAt,
      });
    }
    if (run.nextExpectedAt !== undefined) {
      const secondsUntil = Math.ceil((run.nextExpectedAt - Date.now()) / 1000);
      if (secondsUntil < 0) {
        concerns.push({
          kind: "source",
          key: run.key,
          detail: `Expected sync check is overdue by ${Math.abs(secondsUntil)}s`,
          observedAt: run.finishedAt || run.startedAt,
        });
      }
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
      concerns.push({
        kind: "job",
        key: run.key,
        detail: run.error || `Last run reported ${run.status}`,
        observedAt: run.finishedAt || run.startedAt,
      });
    }
    if (run.nextExpectedAt !== undefined) {
      const secondsUntil = Math.ceil((run.nextExpectedAt - Date.now()) / 1000);
      if (secondsUntil < 0) {
        concerns.push({
          kind: "job",
          key: run.key,
          detail: `Expected job check is overdue by ${Math.abs(secondsUntil)}s`,
          observedAt: run.finishedAt || run.startedAt,
        });
      }
    }
  }
  for (const failure of webhookFailures) {
    concerns.push({
      kind: "webhook",
      key: `${failure.provider}:${failure.eventType ?? "event"}`,
      detail: failure.error || "Webhook was received but could not be processed",
      observedAt: failure.receivedAt,
    });
    if (failure.nextExpectedAt !== undefined) {
      const secondsUntil = Math.ceil((failure.nextExpectedAt - Date.now()) / 1000);
      if (secondsUntil < 0) {
        concerns.push({
          kind: "webhook",
          key: `${failure.provider}:${failure.eventType ?? "event"}`,
          detail: `Expected webhook check is overdue by ${Math.abs(secondsUntil)}s`,
          observedAt: failure.receivedAt,
        });
      }
    }
  }

  const everWorked =
    integrationHealths.some((item) => item.status === "connected") ||
    sourceRuns.some((item) => item.status === "success") ||
    jobRuns.some((item) => item.status === "success");

  return {
    status: concerns.length ? "attention" : everWorked ? "ready" : "not_configured",
    attentionCount: concerns.length,
    integrations: integrationHealths,
    sourceRuns,
    jobRuns,
    webhookFailures,
    concerns,
  };
}
