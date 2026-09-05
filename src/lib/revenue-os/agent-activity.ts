import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentActivitySource = "work_item" | "action" | "claim" | "agent_run" | "activity";

export interface AgentActivityEntry {
  id: string;
  timestamp: string;
  source: AgentActivitySource;
  action: string;
  summary: string;
  status: string;
  coworkerId: string | null;
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown>;
}

export interface AgentActivityTimeline {
  entityType: string;
  entityId: string;
  entries: AgentActivityEntry[];
  totalAvailable: number;
}

// ---------------------------------------------------------------------------
// Build a readable agent activity timeline for an entity
// ---------------------------------------------------------------------------

export async function getAgentActivityForEntity(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    limit?: number;
  },
): Promise<AgentActivityTimeline> {
  const limit = input.limit ?? 20;
  const entries: AgentActivityEntry[] = [];

  // 1. Work items for this entity
  const { data: workItems, error: wiError } = await supabase
    .from("work_items")
    .select("id, kind, objective, status, priority, reason, source, coworker_id, created_at, started_at, finished_at, next_check_at, next_check_reason, outcome, error, attempt_count")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (wiError) throw new Error(wiError.message);

  for (const wi of workItems ?? []) {
    const summary = describeWorkItemStatus(wi);
    entries.push({
      id: wi.id,
      timestamp: wi.started_at ?? wi.created_at,
      source: "work_item",
      action: wi.kind,
      summary,
      status: wi.status,
      coworkerId: wi.coworker_id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      detail: {
        objective: wi.objective,
        reason: wi.reason,
        source: wi.source,
        priority: wi.priority,
        attempt_count: wi.attempt_count,
        outcome: wi.outcome ?? undefined,
        error: wi.error ?? undefined,
        next_check_at: wi.next_check_at ?? undefined,
        next_check_reason: wi.next_check_reason ?? undefined,
      },
    });
  }

  // 2. Action queue entries for this entity
  const { data: actions, error: actError } = await supabase
    .from("action_queue")
    .select("id, action_type, title, status, urgency, reasoning, proposed_by, created_at, executed_at")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (actError) throw new Error(actError.message);

  for (const act of actions ?? []) {
    entries.push({
      id: String(act.id),
      timestamp: act.executed_at ?? act.created_at,
      source: "action",
      action: act.action_type,
      summary: act.title,
      status: act.status,
      coworkerId: act.proposed_by ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      detail: {
        urgency: act.urgency,
        reasoning: act.reasoning ?? undefined,
      },
    });
  }

  // 3. Claims for this entity
  const { data: claims, error: claimError } = await supabase
    .from("claims")
    .select("id, field, proposed_value, status, best_evidence, source_type, coworker_id, created_at, resolved_at")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (claimError) throw new Error(claimError.message);

  for (const claim of claims ?? []) {
    entries.push({
      id: claim.id,
      timestamp: claim.resolved_at ?? claim.created_at,
      source: "claim",
      action: `claim.${claim.field}`,
      summary: `${claim.field}: ${claim.proposed_value} (${claim.status}, ${claim.best_evidence ?? "no evidence"})`,
      status: claim.status,
      coworkerId: claim.coworker_id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      detail: {
        field: claim.field,
        proposed_value: claim.proposed_value,
        best_evidence: claim.best_evidence,
        source_type: claim.source_type,
      },
    });
  }

  // 4. Agent runs linked to this entity (via audit trail)
  const { data: auditRuns, error: runError } = await supabase
    .from("audit_log")
    .select("entity_id, created_at, action, metadata")
    .eq("entity_type", "agent_run")
    .or(`metadata->>'contact_id'.eq.${input.entityId},metadata->>'opportunity_id'.eq.${input.entityId},metadata->>'company_id'.eq.${input.entityId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Audit queries may not match the JSON path — best-effort, not blocking.
  if (!runError && auditRuns) {
    for (const run of auditRuns) {
      entries.push({
        id: run.entity_id,
        timestamp: run.created_at,
        source: "agent_run",
        action: run.action,
        summary: `Agent run: ${run.action}`,
        status: "completed",
        coworkerId: (run.metadata as Record<string, unknown>)?.coworker_id as string ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        detail: (run.metadata as Record<string, unknown>) ?? {},
      });
    }
  }

  // 5. Activity ledger entries from the work engine
  const { data: activities, error: actLedgerError } = await supabase
    .from("activities")
    .select("id, activity_type, title, summary, source, actor_email, external_id, occurred_at")
    .eq(input.entityType === "contact" ? "contact_id" : input.entityType === "company" ? "company_id" : "opportunity_id", input.entityId)
    .like("source", "work_engine%")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (!actLedgerError && activities) {
    for (const act of activities) {
      entries.push({
        id: act.id,
        timestamp: act.occurred_at,
        source: "activity",
        action: act.activity_type,
        summary: act.title,
        status: "completed",
        coworkerId: act.actor_email ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        detail: {
          summary: act.summary ?? undefined,
          source: act.source,
          external_id: act.external_id,
        },
      });
    }
  }

  // Sort all entries by timestamp descending, then take the top N.
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const totalAvailable = entries.length;
  const bounded = entries.slice(0, limit);

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    entries: bounded,
    totalAvailable,
  };
}

// ---------------------------------------------------------------------------
// Describe a work item's status in human-readable terms (northstar §20)
// ---------------------------------------------------------------------------

function describeWorkItemStatus(wi: {
  status: string;
  kind: string;
  objective: string;
  reason: string;
  outcome: string | null;
  error: string | null;
  next_check_at: string | null;
  next_check_reason: string | null;
  attempt_count: number;
}): string {
  switch (wi.status) {
    case "pending":
      return wi.error && wi.next_check_reason
        ? `Retry scheduled: ${wi.next_check_reason}`
        : `Queued: ${wi.objective}`;
    case "claimed":
      return `Claimed: ${wi.objective} — preparing to execute`;
    case "in_progress":
      return `Working: ${wi.objective}`;
    case "waiting":
      return wi.next_check_reason
        ? `Waiting: ${wi.next_check_reason}`
        : `Waiting: ${wi.objective} — scheduled check at ${wi.next_check_at ?? "unknown"}`;
    case "completed":
      return wi.outcome
        ? `Completed: ${wi.outcome}`
        : `Completed: ${wi.objective}`;
    case "failed":
      return wi.error
        ? `Failed (attempt ${wi.attempt_count}): ${wi.error}`
        : `Failed: ${wi.objective}`;
    case "cancelled":
      return `Cancelled: ${wi.outcome || wi.objective}`;
    default:
      return `${wi.status}: ${wi.objective}`;
  }
}
