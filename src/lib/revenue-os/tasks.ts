import "server-only";
import { validateOperatorTaskPatch } from "./operator-task-patch";
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
    query =
      input.source === "delivery_handoff"
        ? query.eq("source", "delivery_handoff")
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
  if (error?.code === "23505" && input.source === "delivery_handoff") {
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

/** AI task edits retain the open-task precondition through the shared service. */
export async function updateOperatorTask(
  supabase: SupabaseClient,
  input: {
    id: string;
    title?: string;
    priority?: "high" | "medium" | "low";
    dueDate?: string | null;
    actorEmail: string;
  },
) {
  if (input.title === undefined && input.priority === undefined && input.dueDate === undefined)
    throw new Error("No task fields were changed");
  return patchOperatorTask(
    supabase,
    {
      id: input.id,
      title: input.title,
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
  const { runOperatorAction } = await import("./action-executor");
  const patch = Object.fromEntries(
    ["status", "snoozed_until", "title", "description", "due_date", "priority"]
      .filter((key) => input[key as keyof typeof input] !== undefined)
      .map((key) => [key, input[key as keyof typeof input]]),
  );
  return runOperatorAction(supabase, {
    actionType: "update_task",
    title: "Update task",
    actorEmail: input.actorEmail,
    payload: { taskId: input.id, changeType: "patch", patch, requireOpen },
  });
}

export async function deleteOperatorTask(supabase: SupabaseClient, id: string, actorEmail: string) {
  const { runOperatorAction } = await import("./action-executor");
  return runOperatorAction(supabase, {
    actionType: "delete_task",
    title: "Delete task",
    actorEmail,
    payload: { taskId: id },
  });
}
