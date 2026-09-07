import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXPECTED_CADENCE_LABELS,
  isCheckOverdue,
  nextExpectedFromAnchor,
} from "./health-expectation";

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

export function describeSourceOutput(source: string, status: string, raw: unknown) {
  const summary = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const count = (key: string) =>
    typeof summary[key] === "number" && Number.isFinite(summary[key]) && Number(summary[key]) >= 0
      ? Number(summary[key])
      : null;
  const listed = count("listed"),
    stored = count("stored"),
    pending = count("deferred"),
    failed = count("failed");
  const incomplete =
    (pending ?? 0) > 0 ||
    (failed ?? 0) > 0 ||
    (count("quarantined") ?? 0) > 0 ||
    (listed !== null && stored !== null && stored < listed);
  const state =
    status === "not_configured"
      ? "not_configured"
      : status === "never_run"
        ? "never_run"
        : incomplete
          ? "incomplete"
          : status === "success" &&
              stored === 0 &&
              source === "gmail" &&
              summary.mode === "incremental"
            ? "quiet"
            : status === "success" && stored !== null
              ? "complete"
              : "unknown";
  const detail =
    state === "quiet"
      ? "Successful incremental sync; no changed threads to store."
      : state === "not_configured"
        ? "Source configuration is missing; no output is expected yet."
        : state === "never_run"
          ? "Source is configured but has no execution receipt."
          : state === "unknown"
            ? "The receipt does not establish source processing output."
            : `${listed === null ? "Listed count unknown" : `${listed} listed`} · ${stored ?? "unknown"} stored · ${pending ?? "unknown"} deferred in this run${incomplete ? "; processing is incomplete" : ""}.`;
  return { state, listed, stored, pending, detail };
}

export interface HealthRunView {
  output?: ReturnType<typeof describeSourceOutput>;
  key: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  /** Claimed long ago and never closed: the process almost certainly died. */
  stalled?: boolean;
  /** Last time this key produced a successful result (ms since epoch). */
  lastSuccessAt?: number;
  /** Expected next execution from last receipt + cadence (ms since epoch). */
  nextExpectedAt?: number;
  /** Operator cadence wording for this run's subsystem ("hourly", …). */
  cadenceLabel?: string;
  /** Admin surface that shows the underlying receipt. */
  receiptHref?: string;
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
  receiptHref?: string;
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
    receiptHref?: string;
  }>;
  queueBacklog: { pending: number; expired: number };
  processingBacklog?: { pendingWork: number; failedWork: number; unresolvedMessages: number };
  /** Everything wrong, in a form an alert can be built from. */
  concerns: HealthConcern[];
}

const SETUP_OPERATIONS_HREF = "/admin/setup#operations";
const INTEGRATIONS_HREF = "/admin/integrations";
const HEALTH_SNAPSHOT_CADENCE_MINUTES = 15;
const INTEGRATION_FRESHNESS_HOURS = 24;

function cadenceMsForJob(jobKey: string): number {
  if (jobKey === "system-health-snapshot") return HEALTH_SNAPSHOT_CADENCE_MINUTES * 60_000;
  return STALLED_JOB_MINUTES * 60_000;
}

function anchorMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const [
    integrationResult,
    sourceRunsResult,
    jobRunsResult,
    webhookResult,
    pendingQueue,
    expiredQueue,
    pendingWork,
    failedWork,
    unresolvedMessages,
  ] = await Promise.all([
    supabase
      .from("integration_connections")
      .select("provider,status,last_success_at,last_error,updated_at,settings"),
    supabase
      .from("source_runs")
      .select("source_key,status,started_at,finished_at,error,summary")
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
    supabase
      .from("action_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("action_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
    supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "waiting", "running"]),
    supabase.from("work_items").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .in("status", ["processing", "failed"]),
  ]);
  const firstError = [
    integrationResult.error,
    sourceRunsResult.error,
    jobRunsResult.error,
    webhookResult.error,
    pendingQueue.error,
    expiredQueue.error,
    pendingWork.error,
    failedWork.error,
    unresolvedMessages.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const integrations = integrationResult.data ?? [];
  const sourceRows = latestByKey(sourceRunsResult.data ?? [], "source_key");
  if (integrations.some((i) => i.provider === "google" && i.status === "connected")) {
    for (const source_key of ["gmail", "google_calendar", "google_drive"]) {
      if (sourceRows.some((r) => r.source_key === source_key)) continue;
      const google = integrations.find((i) => i.provider === "google");
      const folders = (google?.settings as { drive_folder_ids?: unknown[] } | undefined)
        ?.drive_folder_ids;
      sourceRows.push({
        source_key,
        status: source_key === "google_drive" && !folders?.length ? "not_configured" : "never_run",
        summary: {},
        started_at: null,
        finished_at: null,
        error: null,
      });
    }
  }
  const jobRows = latestByKey(jobRunsResult.data ?? [], "job_key");

  const integrationHealths: IntegrationHealth[] = integrations.map((item) => ({
    provider: String(item.provider),
    status: String(item.status),
    lastSuccessAt: item.last_success_at ?? null,
    lastError: item.last_error ?? null,
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : undefined,
    receiptHref: INTEGRATIONS_HREF,
  }));

  const sourceCadenceMs = (EXPECTED_CADENCES.source ?? 0) * 60_000;
  const sourceRuns: HealthRunView[] = sourceRows.map((row) => {
    const lastSuccessAt = anchorMs(
      (sourceRunsResult.data ?? []).find(
        (receipt) => receipt.source_key === row.source_key && receipt.status === "success",
      )?.finished_at,
    );
    const anchor = lastSuccessAt ?? anchorMs(row.finished_at ?? row.started_at);
    return {
      key: String(row.source_key),
      output: describeSourceOutput(String(row.source_key), String(row.status), row.summary),
      status: String(row.status),
      startedAt: row.started_at ?? null,
      finishedAt: row.finished_at ?? null,
      error: row.error ?? null,
      lastSuccessAt,
      nextExpectedAt: nextExpectedFromAnchor(anchor, sourceCadenceMs),
      cadenceLabel: EXPECTED_CADENCE_LABELS.source,
      receiptHref: SETUP_OPERATIONS_HREF,
    };
  });

  const jobRuns: HealthRunView[] = jobRows.map((row) => {
    const lastSuccessAt = anchorMs(
      (jobRunsResult.data ?? []).find(
        (receipt) => receipt.job_key === row.job_key && receipt.status === "success",
      )?.finished_at,
    );
    const anchor = lastSuccessAt ?? anchorMs(row.finished_at ?? row.claimed_at);
    const cadenceMs = cadenceMsForJob(String(row.job_key));
    return {
      key: String(row.job_key),
      status: String(row.status),
      startedAt: row.claimed_at ?? null,
      finishedAt: row.finished_at ?? null,
      error: row.error ?? null,
      stalled: isStalled(String(row.status), row.claimed_at ?? null),
      lastSuccessAt,
      nextExpectedAt: nextExpectedFromAnchor(anchor, cadenceMs),
      cadenceLabel:
        String(row.job_key) === "system-health-snapshot"
          ? "every 15 minutes"
          : EXPECTED_CADENCE_LABELS.job,
      receiptHref: SETUP_OPERATIONS_HREF,
    };
  });

  const webhookFailures = (webhookResult.data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider ?? "unknown"),
    eventType: row.event_type ?? null,
    error: row.error ?? null,
    receivedAt: row.received_at ?? null,
    receiptHref: SETUP_OPERATIONS_HREF,
  }));
  const queueBacklog = {
    pending: pendingQueue.count ?? 0,
    expired: expiredQueue.count ?? 0,
  };

  const processingBacklog = {
    pendingWork: pendingWork.count ?? 0,
    failedWork: failedWork.count ?? 0,
    unresolvedMessages: unresolvedMessages.count ?? 0,
  };
  const concerns: HealthConcern[] = [];
  for (const run of sourceRuns)
    if (run.output && ["incomplete", "never_run"].includes(run.output.state))
      concerns.push({
        kind: "source",
        key: run.key,
        detail: run.output.detail,
        observedAt: run.finishedAt,
      });
  if (processingBacklog.failedWork || processingBacklog.unresolvedMessages)
    concerns.push({
      kind: "job",
      key: "unreconciled-work",
      detail: `${processingBacklog.failedWork} failed work items and ${processingBacklog.unresolvedMessages} failed or processing outbound messages require receipt review. Pending work: ${processingBacklog.pendingWork}.`,
      observedAt: null,
    });
  const integrationFreshnessMs = INTEGRATION_FRESHNESS_HOURS * 3_600_000;
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
      continue;
    }
    if (integration.status === "connected" && !integration.lastSuccessAt) {
      concerns.push({
        kind: "integration",
        key: integration.provider,
        detail: "Connected, but no successful sync receipt exists. Configuration is not health.",
        observedAt: integration.updatedAt ? new Date(integration.updatedAt).toISOString() : null,
      });
      continue;
    }
    const lastSuccess = anchorMs(integration.lastSuccessAt);
    const nextExpected = nextExpectedFromAnchor(lastSuccess, integrationFreshnessMs);
    if (isCheckOverdue(nextExpected)) {
      concerns.push({
        kind: "integration",
        key: integration.provider,
        detail: `Last successful receipt is older than the ${INTEGRATION_FRESHNESS_HOURS}h freshness window.`,
        observedAt: integration.lastSuccessAt,
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
    } else if (isCheckOverdue(run.nextExpectedAt)) {
      concerns.push({
        kind: "source",
        key: run.key,
        detail: `Expected hourly sync is overdue. Last receipt: ${run.finishedAt || run.startedAt || "none"}.`,
        observedAt: run.finishedAt || run.startedAt,
      });
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
    } else if (isCheckOverdue(run.nextExpectedAt)) {
      concerns.push({
        kind: "job",
        key: run.key,
        detail: `Expected ${run.cadenceLabel ?? "scheduled"} run is overdue. Last receipt: ${run.finishedAt || run.startedAt || "none"}.`,
        observedAt: run.finishedAt || run.startedAt,
      });
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
  if (queueBacklog.expired > 0) {
    concerns.push({
      kind: "job",
      key: "action_queue",
      detail: `${queueBacklog.expired} expired action${queueBacklog.expired === 1 ? "" : "s"} still on the queue. Open Today to recover or drop them.`,
      observedAt: null,
    });
  }

  const everWorked =
    integrationHealths.some((item) => item.status === "connected" && item.lastSuccessAt) ||
    sourceRuns.some((item) => item.status === "success") ||
    jobRuns.some((item) => item.status === "success");

  return {
    status: concerns.length ? "attention" : everWorked ? "ready" : "not_configured",
    attentionCount: concerns.length,
    integrations: integrationHealths,
    sourceRuns,
    jobRuns,
    webhookFailures,
    queueBacklog,
    processingBacklog,
    concerns,
  };
}
