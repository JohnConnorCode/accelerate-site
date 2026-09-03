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
// Finance Coworker (northstar Phase E, priority 3)
//
// Tracks invoices, monitors payment patterns, alerts on overdue payments,
// and reconciles revenue records.
// ---------------------------------------------------------------------------

export const FINANCE_COWORKER_ID = "finance";

export const FINANCE_WORK_KINDS = [
  "weekly_revenue_reconciliation",
  "detect_overdue_payments",
  "revenue_stage_audit",
] as const;

export const FINANCE_REQUIRED_CAPABILITIES = ["crm.read", "crm.write"] as const;

export const FINANCE_AUTONOMY_POLICIES = [
  { actionKey: "crm.read", label: "Read CRM records", level: "autonomous" as const },
  { actionKey: "crm.write", label: "Update revenue records", level: "ask_until_trusted" as const },
  {
    actionKey: "finance.analyze",
    label: "Analyze revenue data",
    level: "standing_permission" as const,
  },
  { actionKey: "finance.alert", label: "Send payment alerts", level: "ask_until_trusted" as const },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapFinanceCoworker(
  supabase: SupabaseClient,
  actorEmail?: string | null,
): Promise<{ coworker: Coworker; capabilityGaps: string[]; readyToWork: boolean }> {
  for (const capKey of FINANCE_REQUIRED_CAPABILITIES) {
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

  for (const policy of FINANCE_AUTONOMY_POLICIES) {
    await registerAutonomyPolicy(supabase, {
      actionKey: policy.actionKey,
      label: policy.label,
      level: policy.level,
      coworkerId: FINANCE_COWORKER_ID,
      source: "coworker_bootstrap",
      actorEmail,
    }).catch(() => {});
  }

  const coworker = await registerCoworker(supabase, {
    id: FINANCE_COWORKER_ID,
    name: "Finance Coworker",
    role: "Tracks revenue, monitors payment patterns, and reconciles financial records",
    description:
      "Watches the pipeline for won deals, monitors payment timelines, alerts on overdue payments, and performs weekly revenue reconciliation to ensure CRM data matches financial reality.",
    toolPack: "core",
    requiredCapabilities: [...FINANCE_REQUIRED_CAPABILITIES],
    workKinds: [...FINANCE_WORK_KINDS],
    actorEmail,
  });

  const manifest = await getCoworkerManifest(supabase, FINANCE_COWORKER_ID);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "finance_coworker.bootstrapped",
    entityType: "coworker",
    entityId: FINANCE_COWORKER_ID,
    source: "automation",
    after: { readyToWork: manifest.readyToWork, capabilityGaps: manifest.capabilityGaps },
  });

  return { coworker, capabilityGaps: manifest.capabilityGaps, readyToWork: manifest.readyToWork };
}

// ---------------------------------------------------------------------------
// Work item creation helpers
// ---------------------------------------------------------------------------

export async function createWeeklyReconciliationWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  const week = new Date().toISOString().slice(0, 10);
  return createWorkItem(supabase, {
    kind: "weekly_revenue_reconciliation",
    objective: `Weekly revenue reconciliation for week of ${week}`,
    reason: "Scheduled weekly revenue audit",
    source: "finance_coworker",
    priority: "high",
    coworkerId: FINANCE_COWORKER_ID,
    dedupeKey: `finance:reconciliation:${week}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createDetectOverduePaymentsWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "detect_overdue_payments",
    objective: "Detect overdue payments and stalled won deals",
    reason: "Scheduled overdue payment scan",
    source: "finance_coworker",
    priority: "high",
    coworkerId: FINANCE_COWORKER_ID,
    dedupeKey: `finance:overdue:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

export async function createRevenueStageAuditWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "revenue_stage_audit",
    objective: "Identify high-stage deals without recent activity that may need attention",
    reason: "Scheduled revenue-stage audit",
    source: "finance_coworker",
    priority: "medium",
    coworkerId: FINANCE_COWORKER_ID,
    dedupeKey: `finance:stage-audit:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

// ---------------------------------------------------------------------------
// Work kind handlers
// ---------------------------------------------------------------------------

const weeklyReconciliationHandler: WorkKindHandler = async (supabase) => {
  // Count won deals this week.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: wonThisWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "won")
    .gte("updated_at", weekAgo);

  // Count won deals last week for comparison.
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { count: wonLastWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "won")
    .gte("updated_at", twoWeeksAgo)
    .lt("updated_at", weekAgo);

  // Count lost deals this week.
  const { count: lostThisWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "lost")
    .gte("updated_at", weekAgo);

  // Total active pipeline value.
  const { data: activeOpps } = await supabase
    .from("opportunities")
    .select("probability")
    .not("stage", "in", '("won","lost")');

  const weightedPipeline = (activeOpps ?? []).reduce(
    (sum, o) => sum + (o.probability ?? 0) / 100,
    0,
  );

  const tw = wonThisWeek ?? 0;
  const lw = wonLastWeek ?? 0;
  const change = lw > 0 ? ((tw - lw) / lw) * 100 : tw > 0 ? 100 : 0;

  const summary = [
    `Won this week: ${tw} (last week: ${lw}, ${change > 0 ? "+" : ""}${change.toFixed(0)}%)`,
    `Lost this week: ${lostThisWeek ?? 0}`,
    `Weighted pipeline: ${weightedPipeline.toFixed(1)} units`,
  ].join(" | ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "finance_coworker.weekly_reconciliation",
    entityType: "work_engine",
    entityId: "reconciliation",
    source: "automation",
    after: { wonThisWeek: tw, wonLastWeek: lw, lostThisWeek: lostThisWeek ?? 0, weightedPipeline },
  });

  await storeAgentMemory(supabase, {
    coworkerId: FINANCE_COWORKER_ID,
    category: "prior_work",
    subject: "weekly_reconciliation: revenue summary",
    body: summary,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { outcome: summary };
};

const detectOverduePaymentsHandler: WorkKindHandler = async (supabase) => {
  // Find won deals with no recent activity — possible payment issues.
  const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleWon } = await supabase
    .from("opportunities")
    .select("id, company_name, updated_at")
    .eq("stage", "won")
    .lt("updated_at", staleThreshold)
    .order("updated_at", { ascending: true })
    .limit(20);

  const count = staleWon?.length ?? 0;
  if (count === 0) {
    return { outcome: "No overdue payments or stalled won deals detected" };
  }

  const summary = (staleWon ?? [])
    .map((s) => `${s.company_name} (won, last update ${s.updated_at.slice(0, 10)})`)
    .join("; ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "finance_coworker.overdue_detected",
    entityType: "work_engine",
    entityId: "overdue_payments",
    source: "automation",
    after: { count, deals: staleWon?.map((s) => ({ id: s.id, company: s.company_name })) },
  });

  await storeAgentMemory(supabase, {
    coworkerId: FINANCE_COWORKER_ID,
    category: "prior_work",
    subject: `detect_overdue_payments: ${count} found`,
    body: summary,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome: `${count} potential overdue/stalled deals: ${summary}` };
};

const revenueStageAuditHandler: WorkKindHandler = async (supabase) => {
  // Check for opportunities at high stages without recent activity — revenue risk.
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: atRisk } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, probability, updated_at")
    .in("stage", ["proposal", "negotiation"])
    .lt("updated_at", staleThreshold)
    .order("probability", { ascending: false })
    .limit(15);

  const count = atRisk?.length ?? 0;
  if (count === 0) {
    return {
      outcome:
        "No high-stage opportunities at risk — all proposal/negotiation deals have recent activity",
    };
  }

  const summary = (atRisk ?? [])
    .map(
      (s) =>
        `${s.company_name} (${s.stage}, ${s.probability}%, last update ${s.updated_at.slice(0, 10)})`,
    )
    .join("; ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "finance_coworker.revenue_stage_audit",
    entityType: "work_engine",
    entityId: "revenue_stage_audit",
    source: "automation",
    after: {
      count,
      deals: atRisk?.map((s) => ({
        id: s.id,
        company: s.company_name,
        stage: s.stage,
        probability: s.probability,
      })),
    },
  });

  await storeAgentMemory(supabase, {
    coworkerId: FINANCE_COWORKER_ID,
    category: "prior_work",
    subject: `revenue_stage_audit: ${count} at risk`,
    body: summary,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { outcome: `${count} high-stage deals at risk: ${summary}` };
};

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerFinanceWorkHandlers(): void {
  registerWorkKindHandler("weekly_revenue_reconciliation", weeklyReconciliationHandler);
  registerWorkKindHandler("detect_overdue_payments", detectOverduePaymentsHandler);
  registerWorkKindHandler("revenue_stage_audit", revenueStageAuditHandler);
}
