import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCoworker, getCoworkerManifest, type Coworker } from "./coworkers";
import { createWorkItem } from "./work-items";
import { registerAutonomyPolicy } from "./autonomy-policy";
import { registerCapability } from "./capabilities";
import { recordAudit } from "./audit";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";

// ---------------------------------------------------------------------------
// Business Pulse Coworker (northstar Phase E, priority 1)
//
// Monitors pipeline health, detects anomalies (stale deals, velocity
// drops, stage bottlenecks), and produces daily digest work items.
// ---------------------------------------------------------------------------

export const BUSINESS_PULSE_COWORKER_ID = "business-pulse";

export const BUSINESS_PULSE_WORK_KINDS = [
  "daily_digest",
  "detect_stale_deals",
  "detect_stage_bottleneck",
  "detect_velocity_change",
] as const;

export type BusinessPulseWorkKind = (typeof BUSINESS_PULSE_WORK_KINDS)[number];

export const BUSINESS_PULSE_REQUIRED_CAPABILITIES = [
  "crm.read",
] as const;

export const BUSINESS_PULSE_AUTONOMY_POLICIES = [
  { actionKey: "crm.read", label: "Read CRM records", level: "autonomous" as const },
  { actionKey: "pipeline.analyze", label: "Analyze pipeline health", level: "standing_permission" as const },
  { actionKey: "notification.send", label: "Send anomaly alerts", level: "ask_until_trusted" as const },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapBusinessPulseCoworker(
  supabase: SupabaseClient,
  actorEmail?: string | null,
): Promise<{ coworker: Coworker; capabilityGaps: string[]; readyToWork: boolean }> {
  for (const capKey of BUSINESS_PULSE_REQUIRED_CAPABILITIES) {
    await registerCapability(supabase, {
      capabilityKey: capKey,
      label: capKey.split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
      category: "integration",
      source: "coworker_bootstrap",
    }).catch(() => {});
  }

  for (const policy of BUSINESS_PULSE_AUTONOMY_POLICIES) {
    await registerAutonomyPolicy(supabase, {
      actionKey: policy.actionKey,
      label: policy.label,
      level: policy.level,
      coworkerId: BUSINESS_PULSE_COWORKER_ID,
      source: "coworker_bootstrap",
      actorEmail,
    }).catch(() => {});
  }

  const coworker = await registerCoworker(supabase, {
    id: BUSINESS_PULSE_COWORKER_ID,
    name: "Business Pulse",
    role: "Monitors pipeline health, detects anomalies, and produces daily business digests",
    description: "Continuously watches the pipeline for stale deals, stage bottlenecks, and velocity changes. Produces daily digest summaries and surfaces anomalies that need attention.",
    toolPack: "core",
    requiredCapabilities: [...BUSINESS_PULSE_REQUIRED_CAPABILITIES],
    workKinds: [...BUSINESS_PULSE_WORK_KINDS],
    actorEmail,
  });

  const manifest = await getCoworkerManifest(supabase, BUSINESS_PULSE_COWORKER_ID);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "business_pulse_coworker.bootstrapped",
    entityType: "coworker",
    entityId: BUSINESS_PULSE_COWORKER_ID,
    source: "automation",
    after: { readyToWork: manifest.readyToWork, capabilityGaps: manifest.capabilityGaps },
  });

  return { coworker, capabilityGaps: manifest.capabilityGaps, readyToWork: manifest.readyToWork };
}

// ---------------------------------------------------------------------------
// Work item creation helpers
// ---------------------------------------------------------------------------

export async function createDailyDigestWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  const today = new Date().toISOString().slice(0, 10);
  return createWorkItem(supabase, {
    kind: "daily_digest",
    objective: `Daily business digest for ${today}`,
    reason: "Scheduled daily pipeline health summary",
    source: "business_pulse_coworker",
    priority: "medium",
    coworkerId: BUSINESS_PULSE_COWORKER_ID,
    dedupeKey: `pulse:digest:${today}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createDetectStaleDealsWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "detect_stale_deals",
    objective: "Detect stale deals needing attention",
    reason: "Scheduled stale deal scan",
    source: "business_pulse_coworker",
    priority: "high",
    coworkerId: BUSINESS_PULSE_COWORKER_ID,
    dedupeKey: `pulse:stale:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

export async function createDetectStageBottleneckWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  return createWorkItem(supabase, {
    kind: "detect_stage_bottleneck",
    objective: "Detect pipeline stage bottlenecks",
    reason: "Scheduled bottleneck analysis",
    source: "business_pulse_coworker",
    priority: "medium",
    coworkerId: BUSINESS_PULSE_COWORKER_ID,
    dedupeKey: `pulse:bottleneck:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
  });
}

// ---------------------------------------------------------------------------
// Work kind handlers
// ---------------------------------------------------------------------------

const dailyDigestHandler: WorkKindHandler = async (supabase) => {
  // Count opportunities by stage.
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("stage, probability, created_at, updated_at")
    .not("stage", "in", '("won","lost")');

  const byStage: Record<string, number> = {};
  let totalActive = 0;
  let weightedPipeline = 0;
  for (const opp of opportunities ?? []) {
    byStage[opp.stage] = (byStage[opp.stage] ?? 0) + 1;
    totalActive++;
    weightedPipeline += (opp.probability ?? 0) / 100;
  }

  // Count stale (no update in 7+ days).
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const staleCount = (opportunities ?? []).filter((o) => o.updated_at < staleThreshold).length;

  // Count new this week.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: newThisWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  // Count pending actions.
  const { count: pendingActions } = await supabase
    .from("action_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const digest = [
    `Active pipeline: ${totalActive} opportunities`,
    `Weighted pipeline value: ${weightedPipeline.toFixed(1)} units`,
    `By stage: ${Object.entries(byStage).map(([s, c]) => `${s}=${c}`).join(", ")}`,
    `New this week: ${newThisWeek ?? 0}`,
    `Stale (7+ days): ${staleCount}`,
    `Pending actions: ${pendingActions ?? 0}`,
  ].join(" | ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "business_pulse.daily_digest",
    entityType: "work_engine",
    entityId: "daily_digest",
    source: "automation",
    after: { totalActive, weightedPipeline, staleCount, newThisWeek, pendingActions, byStage },
  });

  return { outcome: digest };
};

const detectStaleDealsHandler: WorkKindHandler = async (supabase) => {
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, updated_at")
    .not("stage", "in", '("won","lost","nurture")')
    .lt("updated_at", staleThreshold)
    .order("updated_at", { ascending: true })
    .limit(20);

  const count = stale?.length ?? 0;
  if (count === 0) {
    return { outcome: "No stale deals detected" };
  }

  const summary = (stale ?? [])
    .map((s) => `${s.company_name} (${s.stage}, last update ${s.updated_at.slice(0, 10)})`)
    .join("; ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "business_pulse.stale_deals_detected",
    entityType: "work_engine",
    entityId: "stale_deals",
    source: "automation",
    after: { count, deals: stale?.map((s) => ({ id: s.id, company: s.company_name, stage: s.stage })) },
  });

  return { outcome: `${count} stale deals: ${summary}` };
};

const detectStageBottleneckHandler: WorkKindHandler = async (supabase) => {
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("stage")
    .not("stage", "in", '("won","lost")');

  const byStage: Record<string, number> = {};
  for (const opp of opportunities ?? []) {
    byStage[opp.stage] = (byStage[opp.stage] ?? 0) + 1;
  }

  // Simple bottleneck: if any stage has >40% of active deals, it's a bottleneck.
  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  const bottlenecks = Object.entries(byStage)
    .filter(([, count]) => total > 0 && count / total > 0.4)
    .map(([stage, count]) => `${stage} (${count}/${total} = ${((count / total) * 100).toFixed(0)}%)`);

  if (bottlenecks.length === 0) {
    return { outcome: `No stage bottlenecks detected. Distribution: ${Object.entries(byStage).map(([s, c]) => `${s}=${c}`).join(", ")}` };
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "business_pulse.bottleneck_detected",
    entityType: "work_engine",
    entityId: "stage_bottleneck",
    source: "automation",
    after: { bottlenecks, distribution: byStage },
  });

  return { outcome: `Bottleneck detected: ${bottlenecks.join(", ")}` };
};

const detectVelocityChangeHandler: WorkKindHandler = async (supabase) => {
  // Compare this week's new opportunities vs last week's.
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const lastWeekEnd = thisWeekStart;

  const { count: thisWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thisWeekStart);

  const { count: lastWeek } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .gte("created_at", lastWeekStart)
    .lt("created_at", lastWeekEnd);

  const tw = thisWeek ?? 0;
  const lw = lastWeek ?? 0;
  const change = lw > 0 ? ((tw - lw) / lw) * 100 : tw > 0 ? 100 : 0;

  if (Math.abs(change) > 50) {
    await recordAudit(supabase, {
      actorEmail: "system",
      action: "business_pulse.velocity_change",
      entityType: "work_engine",
      entityId: "velocity_change",
      source: "automation",
      after: { thisWeek: tw, lastWeek: lw, changePercent: change.toFixed(1) },
    });
    return { outcome: `Velocity alert: ${tw} new this week vs ${lw} last week (${change > 0 ? "+" : ""}${change.toFixed(0)}%)` };
  }

  return { outcome: `Velocity stable: ${tw} new this week vs ${lw} last week (${change > 0 ? "+" : ""}${change.toFixed(0)}%)` };
};

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerBusinessPulseWorkHandlers(): void {
  registerWorkKindHandler("daily_digest", dailyDigestHandler);
  registerWorkKindHandler("detect_stale_deals", detectStaleDealsHandler);
  registerWorkKindHandler("detect_stage_bottleneck", detectStageBottleneckHandler);
  registerWorkKindHandler("detect_velocity_change", detectVelocityChangeHandler);
}
