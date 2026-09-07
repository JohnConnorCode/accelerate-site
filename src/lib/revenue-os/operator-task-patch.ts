export interface OperatorTaskPatchInput {
  id: string;
  status?: string;
  snoozed_until?: string | null;
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string;
}

function validTaskDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateOperatorTaskPatch(input: OperatorTaskPatchInput) {
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
}

export function prepareOperatorTaskPatch(
  before: Record<string, unknown> | null,
  input: OperatorTaskPatchInput,
  requireOpen = false,
): Record<string, unknown> {
  validateOperatorTaskPatch(input);
  if (!before || (requireOpen && !["pending", "snoozed"].includes(String(before.status))))
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
  return patch;
}
