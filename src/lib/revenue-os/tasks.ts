import "server-only";
import { prepareOperatorTaskPatch, validateOperatorTaskPatch } from "./operator-task-patch";
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
    query = ["delivery_handoff", "proposal_response"].includes(input.source)
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
  input: { id: string; actorEmail: string },
) {
  return patchOperatorTask(supabase, { ...input, status: "completed" }, true);
}

export async function snoozeOperatorTask(
  supabase: SupabaseClient,
  input: { id: string; until: string; actorEmail: string },
) {
  return patchOperatorTask(
    supabase,
    { id: input.id, snoozed_until: input.until, actorEmail: input.actorEmail },
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
  const patch = prepareOperatorTaskPatch(before, input, requireOpen);
  const changed = Object.keys(patch).filter((key) => patch[key] !== before[key]);
  if (!changed.length) return before;
  const { data: task, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", input.id)
    .eq("status", before.status)
    .select("*")
    .maybeSingle();
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
