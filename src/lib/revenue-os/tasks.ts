import "server-only";
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
  if (input.dedupeKey) {
    const { data: existing, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("dedupe_key", input.dedupeKey)
      .in("status", ["pending", "snoozed"])
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) return { task: existing, deduplicated: true };
  }
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
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

function validTaskDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
  if (!input.id || typeof input.id !== "string") throw new Error("Task id is required");
  if (input.status !== undefined && !["pending", "completed", "snoozed"].includes(input.status))
    throw new Error("Invalid task status");
  if (input.priority !== undefined && !["high", "medium", "low"].includes(input.priority))
    throw new Error("Invalid task priority");
  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim()))
    throw new Error("Task title cannot be empty");
  if (
    input.description !== undefined &&
    input.description !== null &&
    typeof input.description !== "string"
  )
    throw new Error("Invalid task description");
  if (input.due_date !== undefined && input.due_date !== null && !validTaskDate(input.due_date))
    throw new Error("Invalid due date");
  if (
    input.snoozed_until &&
    (!validTaskDate(input.snoozed_until) ||
      input.snoozed_until <= new Date().toISOString().slice(0, 10))
  )
    throw new Error("Choose a snooze date after today");
  const { data: before, error: readError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before || (requireOpen && !["pending", "snoozed"].includes(before.status)))
    throw new Error("This task was already completed or is no longer available");
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "description", "due_date", "priority"] as const) {
    if (input[key] !== undefined) patch[key] = key === "title" ? input.title!.trim() : input[key];
  }
  if (input.status) {
    patch.status = input.status;
    if (input.status === "completed") {
      patch.completed_at = before.completed_at ?? new Date().toISOString();
      patch.snoozed_until = null;
    }
    if (input.status === "pending") {
      patch.completed_at = null;
      patch.snoozed_until = null;
    }
  }
  if (input.snoozed_until) {
    patch.status = "snoozed";
    patch.snoozed_until = input.snoozed_until;
    patch.completed_at = null;
  }
  if (patch.status === "snoozed" && !input.snoozed_until && !before.snoozed_until)
    throw new Error("A snooze date is required");
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
