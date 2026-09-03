import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCoworker, getCoworkerManifest, type Coworker } from "./coworkers";
import { createWorkItem } from "./work-items";
import { registerAutonomyPolicy } from "./autonomy-policy";
import { registerCapability } from "./capabilities";
import { recordAudit } from "./audit";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";
import { storeAgentMemory } from "./memory";

// ---------------------------------------------------------------------------
// Operations Coworker (northstar Phase E, priority 4)
//
// Monitors system health, integration status, data quality, and
// operational anomalies. The "meta-coworker" that watches the platform
// itself.
// ---------------------------------------------------------------------------

export const OPERATIONS_COWORKER_ID = "operations";

export const OPERATIONS_WORK_KINDS = [
  "daily_health_check",
  "integration_status_audit",
  "data_quality_scan",
] as const;

export const OPERATIONS_REQUIRED_CAPABILITIES = ["crm.read"] as const;

export const OPERATIONS_AUTONOMY_POLICIES = [
  { actionKey: "crm.read", label: "Read CRM records", level: "autonomous" as const },
  {
    actionKey: "ops.analyze",
    label: "Analyze system health",
    level: "standing_permission" as const,
  },
  { actionKey: "ops.alert", label: "Send operational alerts", level: "ask_until_trusted" as const },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapOperationsCoworker(
  supabase: SupabaseClient,
  actorEmail?: string | null,
): Promise<{ coworker: Coworker; capabilityGaps: string[]; readyToWork: boolean }> {
  for (const capKey of OPERATIONS_REQUIRED_CAPABILITIES) {
    await registerCapability(supabase, {
      capabilityKey: capKey,
      label: capKey
        .split(".")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      category: "integration",
      source: "coworker_bootstrap",
    }).catch(() => {});
  }

  for (const policy of OPERATIONS_AUTONOMY_POLICIES) {
    await registerAutonomyPolicy(supabase, {
      actionKey: policy.actionKey,
      label: policy.label,
      level: policy.level,
      coworkerId: OPERATIONS_COWORKER_ID,
      source: "coworker_bootstrap",
      actorEmail,
    }).catch(() => {});
  }

  const coworker = await registerCoworker(supabase, {
    id: OPERATIONS_COWORKER_ID,
    name: "Operations Coworker",
    role: "Monitors system health, integration status, data quality, and operational anomalies",
    description:
      "The meta-coworker that watches the platform itself. Checks integration health, detects stale syncs, scans for data quality issues (missing fields, orphaned records), and produces daily operational health reports.",
    toolPack: "core",
    requiredCapabilities: [...OPERATIONS_REQUIRED_CAPABILITIES],
    workKinds: [...OPERATIONS_WORK_KINDS],
    actorEmail,
  });

  const manifest = await getCoworkerManifest(supabase, OPERATIONS_COWORKER_ID);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "operations_coworker.bootstrapped",
    entityType: "coworker",
    entityId: OPERATIONS_COWORKER_ID,
    source: "automation",
    after: { readyToWork: manifest.readyToWork, capabilityGaps: manifest.capabilityGaps },
  });

  return { coworker, capabilityGaps: manifest.capabilityGaps, readyToWork: manifest.readyToWork };
}

// ---------------------------------------------------------------------------
// Work item creation helpers
// ---------------------------------------------------------------------------

export async function createDailyHealthCheckWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  const today = new Date().toISOString().slice(0, 10);
  return createWorkItem(supabase, {
    kind: "daily_health_check",
    objective: `Daily operational health check for ${today}`,
    reason: "Scheduled daily health scan",
    source: "operations_coworker",
    priority: "medium",
    coworkerId: OPERATIONS_COWORKER_ID,
    dedupeKey: `ops:health:${today}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createIntegrationStatusAuditWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "integration_status_audit",
    objective: "Audit integration source runs for failures or staleness",
    reason: "Scheduled integration health audit",
    source: "operations_coworker",
    priority: "medium",
    coworkerId: OPERATIONS_COWORKER_ID,
    dedupeKey: `ops:integration-audit:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

export async function createDataQualityScanWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "data_quality_scan",
    objective: "Scan contacts and opportunities for missing critical fields",
    reason: "Scheduled data quality check",
    source: "operations_coworker",
    priority: "low",
    coworkerId: OPERATIONS_COWORKER_ID,
    dedupeKey: `ops:data-quality:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

// ---------------------------------------------------------------------------
// Work kind handlers
// ---------------------------------------------------------------------------

const dailyHealthCheckHandler: WorkKindHandler = async (supabase) => {
  // Count failed job runs in the last 24 hours.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedJobs } = await supabase
    .from("job_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", dayAgo);

  // Count stale work items (claimed but past lease).
  const now = new Date().toISOString();
  const { count: staleClaims } = await supabase
    .from("work_items")
    .select("*", { count: "exact", head: true })
    .in("status", ["claimed", "in_progress"])
    .not("lease_expires_at", "is", null)
    .lt("lease_expires_at", now);

  // Count pending actions past expiry.
  const { count: expiredActions } = await supabase
    .from("action_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  // Count total work items by status.
  const { data: workStatusCounts } = await supabase.from("work_items").select("status");

  const byStatus: Record<string, number> = {};
  for (const wi of workStatusCounts ?? []) {
    byStatus[wi.status] = (byStatus[wi.status] ?? 0) + 1;
  }

  const issues: string[] = [];
  if ((failedJobs ?? 0) > 0) issues.push(`${failedJobs} failed jobs`);
  if ((staleClaims ?? 0) > 0) issues.push(`${staleClaims} stale work claims`);
  if ((expiredActions ?? 0) > 0) issues.push(`${expiredActions} expired actions`);

  const statusSummary = Object.entries(byStatus)
    .map(([s, c]) => `${s}=${c}`)
    .join(", ");

  const outcome =
    issues.length > 0
      ? `Issues: ${issues.join(", ")}. Work items: ${statusSummary}`
      : `All healthy. Work items: ${statusSummary}`;

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "operations_coworker.daily_health_check",
    entityType: "work_engine",
    entityId: "health_check",
    source: "automation",
    after: { failedJobs, staleClaims, expiredActions, workByStatus: byStatus },
  });

  await storeAgentMemory(supabase, {
    coworkerId: OPERATIONS_COWORKER_ID,
    category: "prior_work",
    subject: `daily_health_check: ${issues.length > 0 ? "issues found" : "healthy"}`,
    body: outcome,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

const integrationStatusAuditHandler: WorkKindHandler = async (supabase) => {
  // Check source_runs for recent failures.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSourceRuns } = await supabase
    .from("source_runs")
    .select("source_key, status, error")
    .gte("finished_at", dayAgo)
    .order("finished_at", { ascending: false })
    .limit(20);

  const failed = (recentSourceRuns ?? []).filter((r) => r.status === "failed");
  const notConfigured = (recentSourceRuns ?? []).filter((r) => r.status === "not_configured");

  if (failed.length === 0 && notConfigured.length === 0) {
    return {
      outcome:
        "All integrations healthy — no failed or unconfigured source runs in the last 24 hours",
    };
  }

  const parts: string[] = [];
  if (failed.length > 0) {
    parts.push(
      `${failed.length} failed: ${failed.map((f) => `${f.source_key} (${(f.error ?? "").slice(0, 50)})`).join(", ")}`,
    );
  }
  if (notConfigured.length > 0) {
    parts.push(
      `${notConfigured.length} not configured: ${notConfigured.map((n) => n.source_key).join(", ")}`,
    );
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "operations_coworker.integration_audit",
    entityType: "work_engine",
    entityId: "integration_audit",
    source: "automation",
    after: { failedCount: failed.length, notConfiguredCount: notConfigured.length },
  });

  const outcome = `Integration issues: ${parts.join("; ")}`;
  await storeAgentMemory(supabase, {
    coworkerId: OPERATIONS_COWORKER_ID,
    category: "prior_work",
    subject: `integration_status_audit: ${failed.length + notConfigured.length} issues`,
    body: outcome,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

const dataQualityScanHandler: WorkKindHandler = async (supabase) => {
  // Check for contacts without email.
  const { count: noEmail } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .or("email.is.null,email.eq.");

  // Check for opportunities without a company name.
  const { count: noCompany } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .or("company_name.is.null,company_name.eq.");

  // Check for opportunities without next_action that are in active stages.
  const { count: noNextAction } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .not("stage", "in", '("won","lost","nurture")')
    .or("next_action.is.null,next_action.eq.");

  const issues: string[] = [];
  if ((noEmail ?? 0) > 0) issues.push(`${noEmail} contacts without email`);
  if ((noCompany ?? 0) > 0) issues.push(`${noCompany} opportunities without company name`);
  if ((noNextAction ?? 0) > 0)
    issues.push(`${noNextAction} active opportunities without next action`);

  if (issues.length === 0) {
    return { outcome: "Data quality scan clean — no missing critical fields detected" };
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "operations_coworker.data_quality_scan",
    entityType: "work_engine",
    entityId: "data_quality",
    source: "automation",
    after: { noEmail, noCompany, noNextAction },
  });

  const outcome = `Data quality issues: ${issues.join("; ")}`;
  await storeAgentMemory(supabase, {
    coworkerId: OPERATIONS_COWORKER_ID,
    category: "prior_work",
    subject: `data_quality_scan: ${issues.length} issues`,
    body: outcome,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerOperationsWorkHandlers(): void {
  registerWorkKindHandler("daily_health_check", dailyHealthCheckHandler);
  registerWorkKindHandler("integration_status_audit", integrationStatusAuditHandler);
  registerWorkKindHandler("data_quality_scan", dataQualityScanHandler);
}
