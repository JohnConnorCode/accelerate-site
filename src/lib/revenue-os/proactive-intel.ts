import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkItem } from "./work-items";
import { recordAudit } from "./audit";
import { storeAgentMemory } from "./memory";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";

// ---------------------------------------------------------------------------
// Proactive Operator Intelligence (northstar §3: NOTICE layer)
//
// The system continuously evaluates business state and surfaces what
// deserves attention without being asked. This is the "What changed"
// intelligence layer — the difference between "you can check the pipeline"
// and "the system tells you what needs attention."
//
// This module produces a daily intelligence brief by combining signals
// from all coworkers, recent work outcomes, and business state changes
// into a concise "what matters now" summary that surfaces in the
// operator inbox.
// ---------------------------------------------------------------------------

export const PROACTIVE_INTELLIGENCE_COWORKER_ID = "system-intel";

export interface BusinessSignal {
  category: "pipeline" | "revenue" | "activity" | "risk" | "opportunity";
  severity: "info" | "attention" | "urgent";
  summary: string;
  evidence: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Gather business signals from the last 24 hours across all data sources.
 * Each signal represents something that changed or needs attention.
 */
export async function gatherBusinessSignals(
  supabase: SupabaseClient,
  input?: { since?: string },
): Promise<BusinessSignal[]> {
  const since = input?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const signals: BusinessSignal[] = [];

  // --- Pipeline signals ---
  // New opportunities created.
  const { count: newOpportunities } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  if (newOpportunities && newOpportunities > 0) {
    signals.push({
      category: "pipeline",
      severity: "info",
      summary: `${newOpportunities} new opportunity${newOpportunities > 1 ? "ies" : "y"} entered the pipeline`,
      evidence: `opportunities.created_at >= ${since}`,
    });
  }

  // Stage transitions.
  const { data: transitions } = await supabase
    .from("activity_ledger")
    .select("entity_id, metadata")
    .eq("activity_type", "stage_change")
    .gte("occurred_at", since)
    .limit(20);
  const wonDeals = (transitions ?? []).filter(
    (t) => (t.metadata as Record<string, unknown>)?.to === "won",
  );
  const lostDeals = (transitions ?? []).filter(
    (t) => (t.metadata as Record<string, unknown>)?.to === "lost",
  );
  if (wonDeals.length > 0) {
    signals.push({
      category: "revenue",
      severity: "info",
      summary: `${wonDeals.length} deal${wonDeals.length > 1 ? "s" : ""} won`,
      evidence: `stage_change to won since ${since}`,
    });
  }
  if (lostDeals.length > 0) {
    signals.push({
      category: "risk",
      severity: "attention",
      summary: `${lostDeals.length} deal${lostDeals.length > 1 ? "s" : ""} lost`,
      evidence: `stage_change to lost since ${since}`,
    });
  }

  // Stale deals (no update in 7+ days, still active).
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleDeals } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .not("stage", "in", '("won","lost","nurture")')
    .lt("updated_at", staleThreshold);
  if (staleDeals && staleDeals > 0) {
    signals.push({
      category: "risk",
      severity: staleDeals > 3 ? "urgent" : "attention",
      summary: `${staleDeals} stale deal${staleDeals > 1 ? "s" : ""} (no update in 7+ days)`,
      evidence: `opportunities.updated_at < ${staleThreshold}`,
    });
  }

  // --- Activity signals ---
  // Pending actions count.
  const { count: pendingActions } = await supabase
    .from("action_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (pendingActions && pendingActions > 0) {
    signals.push({
      category: "activity",
      severity: pendingActions > 5 ? "attention" : "info",
      summary: `${pendingActions} action${pendingActions > 1 ? "s" : ""} awaiting approval`,
      evidence: `action_queue.status = pending`,
    });
  }

  // Work items completed.
  const { count: completedWork } = await supabase
    .from("work_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", since);
  if (completedWork && completedWork > 0) {
    signals.push({
      category: "activity",
      severity: "info",
      summary: `${completedWork} work item${completedWork > 1 ? "s" : ""} completed by coworkers`,
      evidence: `work_items.completed_at >= ${since}`,
    });
  }

  // Work items that failed.
  const { count: failedWork } = await supabase
    .from("work_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("updated_at", since);
  if (failedWork && failedWork > 0) {
    signals.push({
      category: "risk",
      severity: "attention",
      summary: `${failedWork} work item${failedWork > 1 ? "s" : ""} failed — may need attention`,
      evidence: `work_items.status = failed since ${since}`,
    });
  }

  // --- Opportunity signals ---
  // High-value deals in late stages.
  const { data: highStage } = await supabase
    .from("opportunities")
    .select("id, company_name, stage, probability")
    .in("stage", ["proposal", "negotiation"])
    .order("probability", { ascending: false })
    .limit(5);
  if (highStage && highStage.length > 0) {
    signals.push({
      category: "opportunity",
      severity: "info",
      summary: `${highStage.length} deal${highStage.length > 1 ? "s" : ""} in late stages: ${highStage.map((d) => `${d.company_name} (${d.stage})`).join(", ")}`,
      evidence: `opportunities.stage in (proposal, negotiation)`,
    });
  }

  // Sort by severity (urgent first).
  const severityOrder = { urgent: 0, attention: 1, info: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return signals;
}

/**
 * Produce a proactive intelligence brief from gathered signals.
 * Returns a human-readable summary of what matters now.
 */
export function formatIntelligenceBrief(signals: BusinessSignal[]): string {
  if (signals.length === 0) {
    return "No significant business signals in the last 24 hours. Pipeline is stable.";
  }

  const urgent = signals.filter((s) => s.severity === "urgent");
  const attention = signals.filter((s) => s.severity === "attention");
  const info = signals.filter((s) => s.severity === "info");

  const parts: string[] = [];

  if (urgent.length > 0) {
    parts.push("⚠ URGENT:");
    parts.push(...urgent.map((s) => `  • ${s.summary}`));
  }
  if (attention.length > 0) {
    parts.push("🔔 NEEDS ATTENTION:");
    parts.push(...attention.map((s) => `  • ${s.summary}`));
  }
  if (info.length > 0) {
    parts.push("ℹ STATUS:");
    parts.push(...info.map((s) => `  • ${s.summary}`));
  }

  return parts.join("\n");
}

/**
 * Create a proactive intelligence brief work item.
 */
export async function createProactiveIntelBriefWork(
  supabase: SupabaseClient,
  input?: { actorEmail?: string | null },
) {
  const today = new Date().toISOString().slice(0, 10);
  return createWorkItem(supabase, {
    kind: "proactive_intelligence_brief",
    objective: `Proactive intelligence brief for ${today}`,
    reason: "Daily NOTICE layer — surface what matters now without being asked",
    source: "proactive_intel",
    priority: "medium",
    dedupeKey: `proactive-intel:brief:${today}`,
    maxAttempts: 2,
    actorEmail: input?.actorEmail,
    surfaceInInbox: true,
  });
}

// ---------------------------------------------------------------------------
// Work kind handler
// ---------------------------------------------------------------------------

const proactiveIntelBriefHandler: WorkKindHandler = async (supabase, wi) => {
  const signals = await gatherBusinessSignals(supabase);
  const brief = formatIntelligenceBrief(signals);

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "proactive_intel.brief_produced",
    entityType: "work_engine",
    entityId: "proactive_intel",
    source: "automation",
    after: {
      signalCount: signals.length,
      urgent: signals.filter((s) => s.severity === "urgent").length,
      attention: signals.filter((s) => s.severity === "attention").length,
      info: signals.filter((s) => s.severity === "info").length,
      work_item: wi.id,
    },
  });

  await storeAgentMemory(supabase, {
    category: "prior_work",
    subject: `proactive_intel_brief: ${signals.length} signals`,
    body: brief,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome: brief };
};

export function registerProactiveIntelHandlers(): void {
  registerWorkKindHandler("proactive_intelligence_brief", proactiveIntelBriefHandler);
}
