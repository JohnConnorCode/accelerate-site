import "server-only";
import {
  prepareOperatorTaskPatch,
  validateOperatorTaskPatch,
  TASK_REVIEW_FIELDS,
  type TaskReviewState,
} from "./operator-task-patch";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";

type OperatorTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  opportunity_id: string | null;
};

export interface TaskListInput {
  status?: "pending" | "snoozed" | "completed" | "all" | null;
  owner?: "team" | "me" | "unassigned" | null;
  /** Authenticated viewer for owner "me"; never caller-supplied identity. */
  viewerId?: string;
  source?: string;
  search?: string;
  priority?: "all" | "high" | "medium" | "low";
  due?: "any" | "overdue" | "today" | "upcoming" | "unscheduled";
  /** "id" orders by record id for keyset reads (graph windows). */
  sortBy?: "due_date" | "created_at" | "id";
  sortDirection?: "asc" | "desc";
  id?: string | null;
  date?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  includeOverdue?: boolean;
  /** Exact task ids. */
  ids?: string[];
  /** Tasks attached to this record by opportunity_id, contact_id or related_id. */
  linkedTo?: { type: string; id: string };
  /** Keyset continuation for sortBy "id": rows after this id. */
  afterId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Bounded, tenant-scoped task list shared by the operator task route and the
 * workspace graph adapter. Filters are validated by the caller; this service
 * owns the query shape and always carries an explicit tenant filter.
 */
export async function listTasks(
  supabase: SupabaseClient,
  input: TaskListInput,
): Promise<{ tasks: Array<Record<string, unknown>>; total: number }> {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Task reads require a tenant-bound workspace");
  const page = Math.max(1, Math.min(10000, input.page ?? 1));
  const pageSize = Math.max(1, Math.min(201, input.pageSize ?? 100));
  const direction = input.sortDirection ?? "asc";
  let query = supabase.from("tasks").select("*", { count: "exact" }).eq("tenant_id", tenantId);

  if (input.sortBy === "id") query = query.order("id", { ascending: true });
  else if ((input.sortBy ?? "due_date") === "due_date")
    query = query
      .order("due_date", { ascending: direction === "asc", nullsFirst: false })
      .order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: direction === "asc" });

  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.id) query = query.eq("id", input.id);
  if (input.ids) query = query.in("id", input.ids);
  if (input.afterId) query = query.gt("id", input.afterId);
  if (input.linkedTo) {
    const { type, id } = input.linkedTo;
    const typed = `and(related_type.eq.${type},related_id.eq.${id})`;
    query =
      type === "opportunity"
        ? query.or(`opportunity_id.eq.${id},${typed}`)
        : type === "contact"
          ? query.or(`contact_id.eq.${id},${typed}`)
          : query.eq("related_type", type).eq("related_id", id);
  }
  if (input.owner === "me") query = query.eq("assigned_to", input.viewerId ?? "");
  if (input.owner === "unassigned") query = query.is("assigned_to", null);
  if (input.source) query = query.eq("source", input.source);
  if (input.priority && input.priority !== "all") query = query.eq("priority", input.priority);
  if (input.relatedType && !input.relatedId) query = query.eq("related_type", input.relatedType);
  const today = new Date().toISOString().split("T")[0]!;
  if (input.due === "overdue") query = query.eq("status", "pending").lt("due_date", today);
  if (input.due === "today") query = query.eq("due_date", today);
  if (input.due === "upcoming") query = query.gt("due_date", today);
  if (input.due === "unscheduled") query = query.is("due_date", null);
  if (input.search) {
    const escaped = input.search.replace(/[%,()\\]/g, "");
    if (escaped) query = query.or(`title.ilike.%${escaped}%,related_name.ilike.%${escaped}%`);
  }
  if (input.date) query = query.eq("due_date", input.date);
  if (input.relatedType && input.relatedId)
    query = query.eq("related_type", input.relatedType).eq("related_id", input.relatedId);
  if (input.includeOverdue) query = query.eq("status", "pending").lte("due_date", today);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { tasks: (data ?? []) as Array<Record<string, unknown>>, total: count ?? 0 };
}

export async function createRevenueTask(
  supabase: SupabaseClient,
  input: {
    title: string;
    description?: string | null;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    priority?: "high" | "medium" | "low";
    relatedType?: string | null;
    relatedId?: string | null;
    relatedName?: string | null;
    opportunityId?: string | null;
    source: string;
    dedupeKey?: string | null;
    actorEmail: string;
  },
) {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");
  let contactId: string | null = null;
  if (input.relatedType === "contact") {
    if (!input.relatedId) throw new Error("Select a contact for this follow-up");
    const tenantId = tenantIdForDatabase(supabase);
    if (!tenantId) throw new Error("Contact follow-up requires a tenant-bound workspace");
    const { data: contact, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", input.relatedId)
      .maybeSingle();
    if (error || !contact) throw new Error("This contact is unavailable in your workspace");
    contactId = contact.id;
  }
  if (input.assigneeUserId) {
    if (!tenantIdForDatabase(supabase))
      throw new Error("Assignment requires a tenant-bound workspace");
    const { data: member, error: memberError } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("user_id", input.assigneeUserId)
      .eq("status", "active")
      .maybeSingle();
    if (memberError || !member)
      throw new Error("Task assignee must be an active member of this workspace");
  }
  const findExisting = async () => {
    if (!input.dedupeKey) return null;
    let query = supabase.from("tasks").select("*").eq("dedupe_key", input.dedupeKey);
    query = ["delivery_handoff", "proposal_response", "admin_leads"].includes(input.source)
      ? query.eq("source", input.source).order("created_at", { ascending: true }).limit(1)
      : query.in("status", ["pending", "snoozed"]);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };
  const existing = await findExisting();
  if (existing) return { task: existing, deduplicated: true };
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      ...(input.assigneeUserId ? { assigned_to: input.assigneeUserId } : {}),
      description: input.description || null,
      due_date: input.dueDate || null,
      due_time: input.dueTime || null,
      priority: input.priority || "medium",
      related_type: input.relatedType || null,
      related_id: input.relatedId || null,
      related_name: input.relatedName || null,
      contact_id: contactId,
      opportunity_id: input.opportunityId || null,
      source: input.source,
      dedupe_key: input.dedupeKey || null,
    })
    .select("*")
    .single();
  // A concurrent writer may have won the dedupe-key race (two requests for
  // the same idempotent action landing close together - e.g. a replayed
  // proposal decision). Re-read before surfacing failure for any dedupeKey
  // caller, not just delivery_handoff, so a duplicate-key conflict resolves
  // to the winner's task instead of a 500.
  if (error?.code === "23505" && input.dedupeKey) {
    const concurrent = await findExisting();
    if (concurrent) return { task: concurrent, deduplicated: true };
  }
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    after: task,
    metadata: { source: input.source, dedupe_key: input.dedupeKey || null },
  });
  await recordActivity(supabase, {
    activityType: "task_created",
    title: `Task created: ${title}`,
    summary: input.description || null,
    opportunityId: input.opportunityId || null,
    source: input.source,
    actorEmail: input.actorEmail,
    externalId: `task:${task.id}:created`,
    metadata: { task_id: task.id, priority: task.priority },
  }).catch((error) =>
    console.error(
      "[revenue-os/tasks] activity receipt failed",
      error instanceof Error ? error.message : error,
    ),
  );
  return { task, deduplicated: false };
}

export async function completeOperatorTask(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; expectedState?: TaskReviewState },
) {
  return patchOperatorTask(supabase, { ...input, status: "completed" }, true);
}

export async function snoozeOperatorTask(
  supabase: SupabaseClient,
  input: { id: string; until: string; actorEmail: string; expectedState?: TaskReviewState },
) {
  return patchOperatorTask(
    supabase,
    {
      id: input.id,
      snoozed_until: input.until,
      actorEmail: input.actorEmail,
      expectedState: input.expectedState,
    },
    true,
  );
}

/** AI task edits retain the open-task precondition through the shared service.
 * Description edits travel the same path so executor undo restores them. */
export async function updateOperatorTask(
  supabase: SupabaseClient,
  input: {
    id: string;
    title?: string;
    description?: string | null;
    priority?: "high" | "medium" | "low";
    dueDate?: string | null;
    actorEmail: string;
    expectedState?: TaskReviewState;
  },
) {
  if (
    input.title === undefined &&
    input.description === undefined &&
    input.priority === undefined &&
    input.dueDate === undefined
  )
    throw new Error("No task fields were changed");
  return patchOperatorTask(
    supabase,
    {
      id: input.id,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_date: input.dueDate,
      actorEmail: input.actorEmail,
      expectedState: input.expectedState,
    },
    true,
  );
}

/** Compatibility payload adapter. All operator task routes share these domain
 * transitions with AI execution; HTTP adapters never write task rows. */
export async function patchOperatorTask(
  supabase: SupabaseClient,
  input: {
    id: string;
    status?: string;
    snoozed_until?: string | null;
    title?: string;
    description?: string | null;
    due_date?: string | null;
    priority?: string;
    actorEmail: string;
    expectedState?: TaskReviewState;
  },
  requireOpen = false,
): Promise<OperatorTask> {
  validateOperatorTaskPatch(input);
  const { data: before, error: readError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (
    input.expectedState &&
    (!before ||
      TASK_REVIEW_FIELDS.some((field) => (before[field] ?? null) !== input.expectedState![field]))
  )
    throw new Error(
      "This task changed since the proposal. Review a fresh proposal before applying it.",
    );
  const patch = prepareOperatorTaskPatch(before, input, requireOpen);
  const changed = Object.keys(patch).filter((key) => patch[key] !== before[key]);
  if (!changed.length) return before;
  let write = supabase.from("tasks").update(patch).eq("id", input.id).eq("status", before.status);
  // Check the reviewed values in the write itself, including same-status edits.
  // A read-time check alone leaves a window for another operator's update.
  if (input.expectedState) {
    for (const field of TASK_REVIEW_FIELDS) {
      const value = input.expectedState[field];
      write = value === null ? write.is(field, null) : write.eq(field, value);
    }
  }
  const { data: task, error } = await write.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("This task changed while you were working. Refresh and try again.");
  const action =
    patch.status === "completed" ? "completed" : patch.status === "snoozed" ? "snoozed" : "updated";
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: `task.${action}`,
    entityType: "task",
    entityId: input.id,
    before,
    after: task,
    metadata: { changed },
  });
  await recordActivity(supabase, {
    activityType: `task_${action}`,
    title: `Task ${action}: ${task.title}`,
    opportunityId: task.opportunity_id,
    source: "admin",
    actorEmail: input.actorEmail,
    externalId: `task:${input.id}:${action}:${task.completed_at ?? Date.now()}`,
    metadata: { task_id: input.id, changed },
  });
  return task;
}

export async function deleteOperatorTask(supabase: SupabaseClient, id: string, actorEmail: string) {
  if (!id || typeof id !== "string") throw new Error("Task id is required");
  const { data: before, error: readError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before) return;
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("status", before.status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task changed before deletion");
  await recordAudit(supabase, {
    actorEmail,
    action: "task.deleted",
    entityType: "task",
    entityId: id,
    before,
  });
}
