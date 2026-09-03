import "server-only";
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
  work: (item: WorkItem) => Promise<{ value: T; outcome: string }>,
  input?: {
    leaseOwner?: string;
    leaseDurationMs?: number;
  },
): Promise<WorkItemOutcome<T>> {
  const claim = await claimWorkItem(supabase, {
    kind,
    leaseOwner: input?.leaseOwner,
    leaseDurationMs: input?.leaseDurationMs,
  });

  if (!claim.claimed) {
    return {
      value: null,
      claimed: false,
      workItemId: claim.workItemId,
      existingStatus: claim.existingStatus,
      recoveredStale: claim.recoveredStale,
    };
  }

  // Load the claimed item for the worker.
  const { data: item, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("id", claim.workItemId)
    .single();
  if (error || !item) {
    await failWorkItem(supabase, claim.workItemId, error?.message || "Item not found after claim");
    return { value: null, claimed: true, workItemId: claim.workItemId };
  }

  await startWorkItem(supabase, claim.workItemId);

  try {
    const result = await work(item as WorkItem);
    await completeWorkItem(supabase, claim.workItemId, result.outcome);
    return { value: result.value, claimed: true, workItemId: claim.workItemId };
  } catch (err) {
    await failWorkItem(supabase, claim.workItemId, safeErrorMessage(err));
    return { value: null, claimed: true, workItemId: claim.workItemId };
  }
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function startWorkItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("work_items")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "claimed");
  if (error) throw new Error(error.message);
}

export async function completeWorkItem(
  supabase: SupabaseClient,
  id: string,
  outcome: string,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("work_items")
    .select("status, kind, objective")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("work_items")
    .update({ status: "completed", outcome, finished_at: now })
    .eq("id", id)
    .in("status", ["claimed", "in_progress"]);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_item.completed",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    before: { status: before.status },
    after: { status: "completed", outcome },
  });

  await recordActivity(supabase, {
    activityType: "work_item_completed",
    title: `Work completed: ${before.objective}`,
    summary: outcome,
    source: "work_engine",
    actorEmail: "system",
    externalId: `work_item:${id}:completed`,
  });
}

export async function failWorkItem(
  supabase: SupabaseClient,
  id: string,
  errorMessage: string,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("work_items")
    .select("status, kind, objective, attempt_count, max_attempts")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const attemptsExhausted = (before.attempt_count ?? 0) >= (before.max_attempts ?? 3);

  if (attemptsExhausted) {
    // Permanent failure — no retry.
    const { error } = await supabase
      .from("work_items")
      .update({
        status: "failed",
        error: errorMessage,
        finished_at: now,
      })
      .eq("id", id)
      .in("status", ["claimed", "in_progress"]);
    if (error) throw new Error(error.message);

    await recordAudit(supabase, {
      actorEmail: "system",
      action: "work_item.failed",
      entityType: "work_item",
      entityId: id,
      source: "automation",
      before: { status: before.status, attempt_count: before.attempt_count },
      after: { status: "failed", error: errorMessage, attempts_exhausted: true },
    });
  } else {
    // Retryable — release back to pending with exponential backoff.
    const backoffMinutes = Math.min(2 ** (before.attempt_count - 1) * 5, 60);
    const nextCheckAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
    const retryReason = `Attempt ${before.attempt_count} of ${before.max_attempts} failed: ${errorMessage}. Retrying in ${backoffMinutes} minutes.`;

    const { error } = await supabase
      .from("work_items")
      .update({
        status: "pending",
        error: errorMessage,
        lease_owner: null,
        lease_expires_at: null,
        next_check_at: nextCheckAt,
        next_check_reason: retryReason,
      })
      .eq("id", id)
      .in("status", ["claimed", "in_progress"]);
    if (error) throw new Error(error.message);

    await recordAudit(supabase, {
      actorEmail: "system",
      action: "work_item.retry_scheduled",
      entityType: "work_item",
      entityId: id,
      source: "automation",
      before: { status: before.status, attempt_count: before.attempt_count },
      after: {
        status: "pending",
        next_check_at: nextCheckAt,
        next_check_reason: retryReason,
        attempts_exhausted: false,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Schedule a future check (worker self-scheduling)
// ---------------------------------------------------------------------------

export async function scheduleCheck(
  supabase: SupabaseClient,
  id: string,
  nextCheckAt: string,
  reason: string,
): Promise<void> {
  if (!reason.trim())
    throw new Error("next_check_reason is required when scheduling a future check");

  const { data: before, error: readError } = await supabase
    .from("work_items")
    .select("status, objective")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase
    .from("work_items")
    .update({
      status: "waiting",
      next_check_at: nextCheckAt,
      next_check_reason: reason.trim(),
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", id)
    .in("status", ["claimed", "in_progress"]);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_item.scheduled_check",
    entityType: "work_item",
    entityId: id,
    source: "automation",
    before: { status: before.status },
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
  const { error } = await supabase
    .from("work_items")
    .update({
      status: "cancelled",
      outcome: reason,
      finished_at: now,
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", id)
    .in("status", ["pending", "claimed", "in_progress", "waiting"]);
  if (error) throw new Error(error.message);

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

export async function releaseWorkItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("work_items")
    .update({
      status: "pending",
      lease_owner: null,
      lease_expires_at: null,
      claimed_at: null,
      attempt_count:
        Math.max(
          0,
          (await supabase.from("work_items").select("attempt_count").eq("id", id).single()).data
            ?.attempt_count ?? 1,
        ) - 1,
    })
    .eq("id", id)
    .eq("status", "claimed");
  if (error) throw new Error(error.message);
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
    .select("id, status, attempt_count, max_attempts, kind, objective")
    .in("status", ["claimed", "in_progress"])
    .not("lease_expires_at", "is", null)
    .lt("lease_expires_at", now)
    .limit(100);

  if (error) {
    console.error("[work-items] stale claim recovery scan failed:", error.message);
    return 0;
  }

  let recovered = 0;
  for (const item of stale ?? []) {
    const attemptsExhausted = item.attempt_count >= item.max_attempts;

    if (attemptsExhausted) {
      await supabase
        .from("work_items")
        .update({
          status: "failed",
          error: "Stale claim expired past max attempts",
          finished_at: now,
        })
        .eq("id", item.id)
        .eq("status", item.status);
    } else {
      await supabase
        .from("work_items")
        .update({ status: "pending", lease_owner: null, lease_expires_at: null })
        .eq("id", item.id)
        .eq("status", item.status);
    }

    await recordStaleClaimRecovery(supabase, {
      entityType: "work_item",
      entityId: item.id,
      detail: `Stale ${item.status} claim on "${item.objective}" (${item.kind}) recovered after lease expiry.`,
    });
    recovered++;
  }
  return recovered;
}
