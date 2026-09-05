import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { recordStaleClaimRecovery } from "./runs";
import { safeErrorMessage } from "./db";
import { createRevenueTask } from "./tasks";
import { workResultText, type WorkResult } from "./work-result";
import { randomUUID } from "node:crypto";

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

export type WorkExecutionStatus = WorkResult["status"];
export type WorkLease = Pick<WorkItem, "lease_owner" | "lease_expires_at" | "attempt_count">;
export type { WorkResult } from "./work-result";

export interface WorkItemOutcome {
  status?: WorkExecutionStatus;
  error?: string;
  value: WorkResult | null;
  claimed: boolean;
  persisted: boolean;
  workItemId: string;
  existingStatus?: string;
  recoveredStale?: boolean;
  errors: string[];
}

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
      next_check_at: input.dueAt || null,
      next_check_reason: input.dueAt ? reason : null,
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
    source: "work_engine",
    metadata: { triggerSource: source },
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

export class WorkClaimLostError extends Error {
  constructor() {
    super("Work item claim expired or was superseded; this execution no longer owns it");
  }
}

/** CAS every transition against the exact claim, including expiry and attempt. */
export async function transitionOwnedWorkItem(
  supabase: SupabaseClient,
  item: WorkItem,
  changes: Record<string, unknown>,
): Promise<void> {
  if (!item.lease_owner || !item.claimed_at || !item.lease_expires_at)
    throw new WorkClaimLostError();
  const { data, error } = await supabase
    .from("work_items")
    .update(changes)
    .eq("id", item.id)
    .eq("tenant_id", item.tenant_id)
    .eq("lease_owner", item.lease_owner)
    .eq("claimed_at", item.claimed_at)
    .eq("attempt_count", item.attempt_count)
    .eq("lease_expires_at", item.lease_expires_at)
    .gt("lease_expires_at", new Date().toISOString())
    .in("status", ["claimed", "in_progress"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new WorkClaimLostError();
}

export async function settleWorkItem(
  supabase: SupabaseClient,
  item: WorkItem,
  result: WorkResult,
): Promise<string[]> {
  if (!result.outcome.trim()) throw new Error("Work result must explain its outcome");
  const now = new Date().toISOString();
  const outcome = workResultText(result);
  const changes: Record<string, unknown> = {
    outcome,
    lease_owner: null,
    lease_expires_at: null,
    error: null,
    finished_at: null,
    next_check_at: null,
    next_check_reason: null,
  };
  switch (result.status) {
    case "completed":
      changes.status = "completed";
      changes.finished_at = now;
      break;
    case "skipped":
      changes.status = "cancelled";
      changes.finished_at = now;
      break;
    case "deferred":
    case "awaiting_approval":
      if (
        !Number.isFinite(Date.parse(result.nextCheckAt)) ||
        Date.parse(result.nextCheckAt) <= Date.parse(now)
      ) {
        throw new Error("Deferred work requires a future next check");
      }
      Object.assign(changes, {
        status: "waiting",
        next_check_at: result.nextCheckAt,
        next_check_reason: outcome,
        attempt_count: Math.max(0, item.attempt_count - 1),
      });
      break;
    case "partial":
    case "failed": {
      changes.error = outcome;
      if (item.attempt_count >= item.max_attempts) {
        changes.status = "failed";
        changes.finished_at = now;
      } else {
        const minutes = Math.min(2 ** Math.max(0, item.attempt_count - 1) * 5, 60);
        Object.assign(changes, {
          status: "pending",
          next_check_at: new Date(Date.now() + minutes * 60_000).toISOString(),
          next_check_reason: `${result.status}: ${outcome}. Retrying in ${minutes} minutes.`,
        });
      }
      break;
    }
    default:
      throw new Error("Unknown work result disposition");
  }
  await transitionOwnedWorkItem(supabase, item, changes);
  // A telemetry failure after the state commit must not rewrite completed work
  // as failed or rerun its effects. Surface it on the cycle receipt instead.
  const errors: string[] = [];
  try {
    await recordAudit(supabase, {
      actorEmail: "system",
      action: `work_item.${result.status}`,
      entityType: "work_item",
      entityId: item.id,
      source: "automation",
      before: {
        status: item.status,
        attempt_count: item.attempt_count,
        outcome: item.outcome,
        error: item.error,
        finished_at: item.finished_at,
        next_check_at: item.next_check_at,
        next_check_reason: item.next_check_reason,
      },
      after: {
        attempt_count: item.attempt_count,
        ...changes,
        disposition: result.status,
        artifacts: result.artifacts ?? [],
      },
    });
  } catch (error) {
    errors.push(`work-item-audit: ${safeErrorMessage(error)}`);
    console.error("[work-items] outcome audit failed:", safeErrorMessage(error));
  }
  if (result.status === "completed") {
    try {
      await recordActivity(supabase, {
        activityType: "work_item_completed",
        title: `Work completed: ${item.objective}`,
        summary: outcome,
        source: "work_engine",
        actorEmail: "system",
        externalId: `work_item:${item.id}:completed`,
        contactId: item.entity_type === "contact" ? (item.entity_id ?? undefined) : undefined,
        opportunityId:
          item.entity_type === "opportunity" ? (item.entity_id ?? undefined) : undefined,
      });
    } catch (error) {
      errors.push(`work-item-activity: ${safeErrorMessage(error)}`);
      console.error("[work-items] completion activity failed:", safeErrorMessage(error));
    }
  }
  return errors;
}

export async function withWorkItem(
  supabase: SupabaseClient,
  kind: string,
  work: (item: WorkItem) => Promise<WorkResult>,
  input?: { leaseOwner?: string; leaseDurationMs?: number },
): Promise<WorkItemOutcome> {
  const leaseOwner = input?.leaseOwner ?? `work:${randomUUID()}`;
  const claim = await claimWorkItem(supabase, {
    kind,
    leaseOwner,
    leaseDurationMs: input?.leaseDurationMs,
  });
  const base = {
    claimed: claim.claimed,
    persisted: false,
    workItemId: claim.workItemId,
    existingStatus: claim.existingStatus,
    recoveredStale: claim.recoveredStale,
    errors: [] as string[],
  };
  if (!claim.claimed) return { ...base, value: null };
  const { data, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("id", claim.workItemId)
    .single();
  if (error || !data)
    return { ...base, value: null, errors: [error?.message ?? "Claimed item not found"] };
  // Snapshot: mutable test clients and future adapters must not alter our fence.
  const item = { ...data } as WorkItem;
  if (item.lease_owner !== leaseOwner)
    return { ...base, value: null, errors: ["Work claim superseded before start"] };
  let result: WorkResult;
  try {
    await transitionOwnedWorkItem(supabase, item, {
      status: "in_progress",
      started_at: new Date().toISOString(),
    });
    result = await work(item);
  } catch (error) {
    if (error instanceof WorkClaimLostError)
      return { ...base, value: null, errors: [error.message] };
    result = { status: "failed", outcome: safeErrorMessage(error) };
  }
  try {
    const errors = await settleWorkItem(supabase, item, result);
    return { ...base, value: result, status: result.status, persisted: true, errors };
  } catch (error) {
    // An unknown write outcome is not permission to attempt a second transition.
    return { ...base, value: null, errors: [safeErrorMessage(error)] };
  }
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

async function ownedSnapshot(
  supabase: SupabaseClient,
  id: string,
  lease: WorkLease,
): Promise<WorkItem> {
  const { data, error } = await supabase.from("work_items").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Work item unavailable");
  if (
    data.lease_owner !== lease.lease_owner ||
    data.lease_expires_at !== lease.lease_expires_at ||
    data.attempt_count !== lease.attempt_count
  )
    throw new WorkClaimLostError();
  return { ...data } as WorkItem;
}
async function transitionOwnedWork(
  supabase: SupabaseClient,
  id: string,
  lease: WorkLease,
  patch: Record<string, unknown>,
  statuses: WorkItemStatus[] = ["claimed", "in_progress"],
) {
  const item = await ownedSnapshot(supabase, id, lease);
  if (!statuses.includes(item.status)) throw new WorkClaimLostError();
  await transitionOwnedWorkItem(supabase, item, patch);
}
export async function startWorkItem(supabase: SupabaseClient, id: string, lease: WorkLease) {
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
) {
  return settleWorkItem(supabase, await ownedSnapshot(supabase, id, lease), {
    status: "completed",
    outcome,
  });
}
export async function failWorkItem(
  supabase: SupabaseClient,
  id: string,
  outcome: string,
  lease: WorkLease,
) {
  return settleWorkItem(supabase, await ownedSnapshot(supabase, id, lease), {
    status: "failed",
    outcome,
  });
}
export async function scheduleCheck(
  supabase: SupabaseClient,
  id: string,
  nextCheckAt: string,
  outcome: string,
  lease: WorkLease,
) {
  return settleWorkItem(supabase, await ownedSnapshot(supabase, id, lease), {
    status: "deferred",
    nextCheckAt,
    outcome,
  });
}
