import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { recordStaleClaimRecovery } from "./runs";
import { safeErrorMessage } from "./db";
import { createRevenueTask } from "./tasks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkItemPriority = "urgent" | "high" | "medium" | "low";
export type WorkItemStatus =
  "pending" | "claimed" | "in_progress" | "waiting" | "completed" | "failed" | "cancelled";

export interface WorkItem {
  id: string;
  tenant_id: string;
  coworker_id: string | null;
  kind: string;
  objective: string;
  entity_type: string | null;
  entity_id: string | null;
  priority: WorkItemPriority;
  reason: string;
  source: string;
  status: WorkItemStatus;
  dedupe_key: string | null;
  due_at: string | null;
  next_check_at: string | null;
  next_check_reason: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  max_attempts: number;
  outcome: string | null;
  error: string | null;
  agent_run_id: string | null;
  action_ids?: string[];
  created_at: string;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkItemClaimResult {
  workItemId: string;
  claimed: boolean;
  existingStatus: string;
  recoveredStale: boolean;
}

export interface WorkItemOutcome<T = unknown> {
  value: T | null;
  claimed: boolean;
  workItemId: string;
  existingStatus?: string;
  recoveredStale?: boolean;
  status?: WorkExecutionStatus;
  error?: string;
}

export type WorkExecutionStatus =
  "completed" | "deferred" | "awaiting_approval" | "partial" | "failed";
export type WorkResult<T = unknown> = { value: T; outcome: string } & (
  | { status: "completed" }
  | { status: "deferred" | "awaiting_approval"; nextCheckAt: string }
  | { status: "partial" | "failed" }
);
export type WorkLease = Pick<WorkItem, "lease_owner" | "lease_expires_at" | "attempt_count">;

const DEFAULT_LEASE_DURATION_MS = 30 * 60 * 1000; // 30 minutes, same as job_runs

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createWorkItem(
  supabase: SupabaseClient,
  input: {
    kind: string;
    objective: string;
    reason: string;
    source: string;
    priority?: WorkItemPriority;
    coworkerId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    dedupeKey?: string | null;
    dueAt?: string | null;
    maxAttempts?: number;
    actorEmail?: string | null;
    surfaceInInbox?: boolean;
  },
): Promise<{ workItem: WorkItem; deduplicated: boolean }> {
  const kind = input.kind.trim();
  const objective = input.objective.trim();
  const reason = input.reason.trim();
  const source = input.source.trim();

  if (!kind) throw new Error("kind is required");
  if (!objective) throw new Error("objective is required");
  if (!reason) throw new Error("reason is required");
  if (!source) throw new Error("source is required");

  // Dedupe: if a dedupe_key is provided, check for an existing open item.
  if (input.dedupeKey) {
    const { data: existing, error } = await supabase
      .from("work_items")
      .select("*")
      .eq("dedupe_key", input.dedupeKey)
      .in("status", ["pending", "claimed", "in_progress", "waiting"])
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) return { workItem: existing as WorkItem, deduplicated: true };
  }

  const { data: workItem, error } = await supabase
    .from("work_items")
    .insert({
      kind,
      objective,
      reason,
      source,
      priority: input.priority || "medium",
      coworker_id: input.coworkerId || null,
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      dedupe_key: input.dedupeKey || null,
      due_at: input.dueAt || null,
      max_attempts: input.maxAttempts || 3,
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique violation: race on the dedupe partial index.
    if (error.code === "23505" && input.dedupeKey) {
      const { data: existing } = await supabase
        .from("work_items")
        .select("*")
        .eq("dedupe_key", input.dedupeKey)
        .in("status", ["pending", "claimed", "in_progress", "waiting"])
        .maybeSingle();
      if (existing) return { workItem: existing as WorkItem, deduplicated: true };
    }
    throw new Error(error.message);
  }

  await recordActivity(supabase, {
    activityType: "work_item_created",
    title: `Work created: ${objective}`,
    source: `work_engine:${source}`,
    actorEmail: input.actorEmail || "system",
    externalId: `work_item:${workItem.id}`,
    contactId: input.entityType === "contact" ? input.entityId : undefined,
    companyId: input.entityType === "company" ? input.entityId : undefined,
    opportunityId: input.entityType === "opportunity" ? input.entityId : undefined,
  });

  // Task bridge: surface the work item in the Today inbox so the founder can
  // see durable work alongside regular tasks. Uses a work-item-scoped dedupe
  // key so the inbox entry is never duplicated.
  if (input.surfaceInInbox) {
    await createRevenueTask(supabase, {
      title: `[Work] ${objective}`,
      description: `${reason} (kind: ${kind}, source: ${source})`,
      dueDate: input.dueAt ? input.dueAt.slice(0, 10) : null,
      priority: input.priority === "urgent" || input.priority === "high" ? "high" : "medium",
      relatedType: input.entityType,
      relatedId: input.entityId,
      source: `work_engine:${source}`,
      dedupeKey: `work-item-inbox:${workItem.id}`,
      actorEmail: input.actorEmail || "system",
    }).catch((err) => {
      console.error("[work-items] failed to surface in inbox:", safeErrorMessage(err));
    });
  }

  return { workItem: workItem as WorkItem, deduplicated: false };
}

// ---------------------------------------------------------------------------
// Claim (via RPC)
// ---------------------------------------------------------------------------

export async function claimWorkItem(
  supabase: SupabaseClient,
  input: {
    kind: string;
    workItemId?: string;
    leaseOwner?: string;
    leaseDurationMs?: number;
  },
): Promise<WorkItemClaimResult> {
  const { data, error } = await supabase
    .rpc("claim_work_item", {
      p_kind: input.kind,
      p_work_item_id: input.workItemId || null,
      p_lease_owner: input.leaseOwner || null,
      p_lease_duration_ms: input.leaseDurationMs || DEFAULT_LEASE_DURATION_MS,
    })
    .single();

  if (error) throw new Error(error.message);

  const claim = data as {
    work_item_id: string;
    claimed: boolean;
    existing_status: string;
    recovered_stale: boolean;
  };

  const recoveredStale = Boolean(claim.recovered_stale);
  if (recoveredStale && Boolean(claim.claimed)) {
    await recordStaleClaimRecovery(supabase, {
      entityType: "work_item",
      entityId: claim.work_item_id,
      detail: "A previous claim on this work item expired without reporting a terminal state.",
    });
  }

  return {
    workItemId: claim.work_item_id,
    claimed: Boolean(claim.claimed),
    existingStatus: claim.existing_status,
    recoveredStale,
  };
}

// ---------------------------------------------------------------------------
// Execute a work item in a managed wrapper (like withJobRun)
// ---------------------------------------------------------------------------

export async function withWorkItem<T>(
  supabase: SupabaseClient,
  kind: string,
  work: (item: WorkItem) => Promise<WorkResult<T>>,
  input?: { leaseOwner?: string; leaseDurationMs?: number },
): Promise<WorkItemOutcome<T>> {
  const leaseOwner = input?.leaseOwner ?? randomUUID();
  const claim = await claimWorkItem(supabase, {
    kind,
    leaseOwner,
    leaseDurationMs: input?.leaseDurationMs,
  });
  if (!claim.claimed) return { ...claim, value: null };
  const { data, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("id", claim.workItemId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Claimed work item is unavailable");
  const item = data as WorkItem;
  if (item.lease_owner !== leaseOwner) throw new Error("Work item lease was superseded");
  await startWorkItem(supabase, item.id, item);
  let result: WorkResult<T>;
  try {
    result = await work(item);
  } catch (error) {
    const message = safeErrorMessage(error);
    await failWorkItem(supabase, item.id, message, item);
    return { ...claim, value: null, status: "failed", error: message };
  }
  // Keep persistence outside the handler catch: a receipt failure after an effect
  // must not convert completed work back into a retryable operation.
  switch (result.status) {
    case "completed":
      await completeWorkItem(supabase, item.id, result.outcome, item);
      break;
    case "deferred":
    case "awaiting_approval":
      await scheduleCheck(supabase, item.id, result.nextCheckAt, result.outcome, item);
      break;
    case "partial":
    case "failed":
      await failWorkItem(supabase, item.id, result.outcome, item);
      break;
    default:
      throw new Error("Work handler returned an invalid execution status");
  }
  return {
    ...claim,
    value: result.value,
    status: result.status,
    ...(result.status === "failed" || result.status === "partial" ? { error: result.outcome } : {}),
  };
}

async function transitionOwnedWork(
  supabase: SupabaseClient,
  id: string,
  lease: WorkLease,
  patch: Record<string, unknown>,
  statuses: WorkItemStatus[] = ["claimed", "in_progress"],
): Promise<WorkItem> {
  if (!lease.lease_owner || !lease.lease_expires_at) throw new Error("A work lease is required");
  const { data, error } = await supabase
    .from("work_items")
    .update(patch)
    .eq("id", id)
    .eq("lease_owner", lease.lease_owner)
    .eq("lease_expires_at", lease.lease_expires_at)
    .eq("attempt_count", lease.attempt_count)
    .gt("lease_expires_at", new Date().toISOString())
    .in("status", statuses)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Work item lease expired or was superseded");
  return data as WorkItem;
}

export async function startWorkItem(
  supabase: SupabaseClient,
  id: string,
  lease: WorkLease,
): Promise<void> {
  await transitionOwnedWork(
    supabase,
    id,
    lease,
    { status: "in_progress", started_at: new Date().toISOString() },
    ["claimed"],
  );
}

export async function completeWorkItem(
  supabase: SupabaseClient,
  id: string,
  outcome: string,
  lease: WorkLease,
): Promise<void> {
  const item = await transitionOwnedWork(supabase, id, lease, {
    status: "completed",
    outcome,
    error: null,
    finished_at: new Date().toISOString(),
    lease_owner: null,
    lease_expires_at: null,
  });
  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_item.completed",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    after: { status: item.status, outcome, attempt_count: item.attempt_count },
  });
  await recordActivity(supabase, {
    activityType: "work_item_completed",
    title: `Work completed: ${item.objective}`,
    summary: outcome,
    source: "work_engine",
    actorEmail: "system",
    externalId: `work_item:${id}:completed`,
  });
}

export async function failWorkItem(
  supabase: SupabaseClient,
  id: string,
  message: string,
  lease: WorkLease,
): Promise<void> {
  const { data: before, error } = await supabase
    .from("work_items")
    .select("max_attempts")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  const exhausted = lease.attempt_count >= before.max_attempts;
  const reason = `Attempt ${lease.attempt_count} of ${before.max_attempts} failed: ${message}`;
  const item = await transitionOwnedWork(supabase, id, lease, {
    status: exhausted ? "failed" : "pending",
    error: message,
    outcome: reason,
    finished_at: exhausted ? new Date().toISOString() : null,
    next_check_at: exhausted
      ? null
      : new Date(
          Date.now() + Math.min(2 ** Math.max(0, lease.attempt_count - 1) * 5, 60) * 60_000,
        ).toISOString(),
    next_check_reason: exhausted ? null : `${reason}. Retrying with bounded backoff.`,
    lease_owner: null,
    lease_expires_at: null,
  });
  await recordAudit(supabase, {
    actorEmail: "system",
    action: exhausted ? "work_item.failed" : "work_item.retry_scheduled",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    after: { status: item.status, error: message, attempt_count: item.attempt_count },
  });
}

export async function scheduleCheck(
  supabase: SupabaseClient,
  id: string,
  nextCheckAt: string,
  reason: string,
  lease: WorkLease,
): Promise<void> {
  if (
    !reason.trim() ||
    !Number.isFinite(Date.parse(nextCheckAt)) ||
    Date.parse(nextCheckAt) <= Date.now()
  )
    throw new Error("A future check time and reason are required");
  await transitionOwnedWork(supabase, id, lease, {
    status: "waiting",
    outcome: reason.trim(),
    next_check_at: nextCheckAt,
    next_check_reason: reason.trim(),
    lease_owner: null,
    lease_expires_at: null,
    // Capability/budget deferral did not attempt the handler and must not consume retry allowance.
    attempt_count: Math.max(0, lease.attempt_count - 1),
  });
  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_item.scheduled_check",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    after: { status: "waiting", next_check_at: nextCheckAt, next_check_reason: reason.trim() },
  });
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelWorkItem(
  supabase: SupabaseClient,
  id: string,
  reason: string,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("work_items")
    .select("status, objective")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("work_items")
    .update({
      status: "cancelled",
      outcome: reason,
      finished_at: now,
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", id)
    .in("status", ["pending", "claimed", "in_progress", "waiting"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Work item is already terminal; cancellation was not applied");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_item.cancelled",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    before: { status: before.status },
    after: { status: "cancelled", outcome: reason },
  });
}

// ---------------------------------------------------------------------------
// Release claim (without starting work)
// ---------------------------------------------------------------------------

export async function releaseWorkItem(
  supabase: SupabaseClient,
  id: string,
  lease: WorkLease,
): Promise<void> {
  await transitionOwnedWork(
    supabase,
    id,
    lease,
    {
      status: "pending",
      lease_owner: null,
      lease_expires_at: null,
      claimed_at: null,
      attempt_count: Math.max(0, lease.attempt_count - 1),
    },
    ["claimed"],
  );
}

// ---------------------------------------------------------------------------
// List claimable work (read-only)
// ---------------------------------------------------------------------------

export async function listClaimableWork(
  supabase: SupabaseClient,
  input?: {
    kind?: string;
    limit?: number;
  },
): Promise<WorkItem[]> {
  let query = supabase
    .from("work_items")
    .select("*")
    .in("status", ["pending", "waiting"])
    .or("next_check_at.is.null,next_check_at.lte." + new Date().toISOString())
    .order("priority", { ascending: true })
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(input?.limit ?? 20);

  if (input?.kind) {
    query = query.eq("kind", input.kind);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkItem[];
}

// ---------------------------------------------------------------------------
// Stale claim recovery (called inline, like sweepExpiredActions)
// ---------------------------------------------------------------------------

export async function recoverStaleWorkItemClaims(supabase: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data: stale, error } = await supabase
    .from("work_items")
    .select("id,status,lease_owner,lease_expires_at,attempt_count,max_attempts,kind,objective")
    .in("status", ["claimed", "in_progress"])
    .not("lease_expires_at", "is", null)
    .lt("lease_expires_at", now)
    .limit(100);
  if (error) throw new Error(`Work recovery scan failed: ${error.message}`);
  let recovered = 0;
  for (const item of stale ?? []) {
    const exhausted = item.attempt_count >= item.max_attempts;
    const { data: changed, error: updateError } = await supabase
      .from("work_items")
      .update({
        status: exhausted ? "failed" : "pending",
        lease_owner: null,
        lease_expires_at: null,
        error: "Lease expired before completion",
        ...(exhausted ? { finished_at: now } : {}),
      })
      .eq("id", item.id)
      .eq("status", item.status)
      .eq("lease_owner", item.lease_owner)
      .eq("lease_expires_at", item.lease_expires_at)
      .eq("attempt_count", item.attempt_count)
      .lt("lease_expires_at", now)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(`Work recovery failed: ${updateError.message}`);
    if (!changed) continue;
    await recordStaleClaimRecovery(supabase, {
      entityType: "work_item",
      entityId: item.id,
      detail: `Expired lease on ${item.kind}: ${exhausted ? "retry limit reached" : "released for retry"}`,
    });
    recovered++;
  }
  return recovered;
}

export async function linkWorkItemRun(
  supabase: SupabaseClient,
  item: WorkItem,
  runId: string,
  actionIds: string[],
) {
  if (actionIds.length) {
    const { data, error } = await supabase.from("action_queue").select("id").in("id", actionIds);
    if (error || data?.length !== new Set(actionIds).size)
      throw new Error("Work action links are unavailable in this tenant");
  }
  await transitionOwnedWork(
    supabase,
    item.id,
    item,
    { agent_run_id: runId, action_ids: [...new Set(actionIds)] },
    ["in_progress"],
  );
}
