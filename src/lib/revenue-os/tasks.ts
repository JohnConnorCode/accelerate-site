import "server-only";
import { validateOperatorTaskPatch } from "./operator-task-patch";
import type { SupabaseClient } from "@supabase/supabase-js";

type OperatorTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  opportunity_id: string | null;
};

export type RevenueTaskInput = {
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
  execution?: { actionId: string; payload: Record<string, unknown> };
};

export async function createRevenueTask(supabase: SupabaseClient, input: RevenueTaskInput) {
  const { executeTaskCreation } = await import("./action-executor");
  return executeTaskCreation(supabase, input);
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
