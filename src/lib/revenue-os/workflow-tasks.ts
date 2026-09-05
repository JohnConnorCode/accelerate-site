import "server-only";
import { createHash } from "node:crypto";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workflowTaskBatchSchema as batchSchema } from "./workflow-task-contract";
import { createRevenueTask } from "./tasks";
import { checkpointActionResult } from "./actions";
import { requireEnabledPlugin } from "./plugin-host";
export async function reviewWorkflowTasks(db: SupabaseClient, payload: Record<string, unknown>) {
  if (!tenantIdForDatabase(db)) throw new Error("Task workflows require a tenant-bound database");
  const input = batchSchema.parse(
    Object.fromEntries(
      ["opportunityId", "meetingId", "tasks"]
        .filter((key) => payload[key] !== undefined)
        .map((key) => [key, payload[key]]),
    ),
  );
  const ids = [...new Set(input.tasks.map((task) => task.assigneeUserId))];
  const { data: members, error } = await db
    .from("tenant_memberships")
    .select("user_id")
    .in("user_id", ids)
    .eq("status", "active");
  if (error || !members || ids.some((id) => !members.some((member) => member.user_id === id)))
    throw new Error("Every task needs an active workspace assignee");
  const table = input.opportunityId ? "opportunities" : "calendar_events";
  const { data: source, error: sourceError } = await db
    .from(table)
    .select(input.opportunityId ? "id,stage,name" : "id,title,status")
    .eq("id", input.opportunityId ?? input.meetingId)
    .maybeSingle();
  if (sourceError || !source) throw new Error("Workflow source record is unavailable");
  const row = source as unknown as Record<string, unknown>;
  const expectedState = input.opportunityId ? row.stage : row.status;
  if (payload.expectedState !== undefined && payload.expectedState !== expectedState)
    throw new Error("Source state changed after preview; prepare a fresh workflow");
  if (input.opportunityId && expectedState !== "won")
    throw new Error("Client onboarding requires a won opportunity");
  if (input.meetingId && expectedState === "cancelled")
    throw new Error("A cancelled meeting cannot create commitments");
  return {
    ...input,
    expectedState: expectedState ?? null,
    sourceLabel: input.opportunityId ? row.name : row.title,
  };
}
export async function executeWorkflowTaskBatch(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
) {
  const { data: action, error } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .eq("status", "executing")
    .eq("action_type", "create_task_batch")
    .maybeSingle();
  if (error || !action || action.approved_by !== actorEmail)
    throw new Error("A current approved workflow is required");
  if (!action.expires_at || Date.parse(action.expires_at) <= Date.now())
    throw new Error("Workflow approval expired");
  const previousTasks = (action.result?.tasks ?? []) as { id: string }[];
  for (const previous of previousTasks) {
    const { data: task, error: readError } = await db
      .from("tasks")
      .select("id")
      .eq("id", previous.id)
      .maybeSingle();
    if (readError || !task)
      throw new Error(
        "A previously recorded task is missing. Reconcile the workflow before retrying.",
      );
  }
  const raw = action.payload as Record<string, unknown>;
  const pluginId = (raw.pluginOrigin as { id: string })?.id;
  await requireEnabledPlugin(db, pluginId);
  const batch = await reviewWorkflowTasks(db, raw);
  const tasks: { id: string; title: string; dueDate: string; assigneeUserId: string }[] = [];
  await checkpointActionResult(db, actionId, { kind: "task_batch", tasks, complete: false });
  for (const item of batch.tasks) {
    await requireEnabledPlugin(db, pluginId);
    // Exact repeated business effects reuse even completed tasks. A changed
    // commitment is a distinct effect; existing tasks are never overwritten.
    const dedupeKey = `plugin:${createHash("sha256")
      .update(JSON.stringify({ pluginId, source: batch.opportunityId ?? batch.meetingId, ...item }))
      .digest("hex")}`;
    const { data: existing, error: readError } = await db
      .from("tasks")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .eq("source", "plugin")
      .maybeSingle();
    if (readError) throw new Error("Existing workflow task receipt could not be read");
    const result =
      existing ??
      (
        await createRevenueTask(db, {
          ...item,
          source: "plugin",
          dedupeKey,
          actorEmail,
          opportunityId: batch.opportunityId ?? null,
          relatedType: batch.opportunityId ? "opportunity" : "calendar_event",
          relatedId: batch.opportunityId ?? batch.meetingId,
          relatedName: String(batch.sourceLabel ?? ""),
        })
      ).task;
    if (!result || typeof result.id !== "string")
      throw new Error("Task creation returned no durable identity");
    tasks.push({
      id: result.id,
      title: item.title,
      dueDate: item.dueDate,
      assigneeUserId: item.assigneeUserId,
    });
    await checkpointActionResult(db, actionId, {
      kind: "task_batch",
      tasks: [...tasks],
      complete: false,
    });
  }
  return { kind: "task_batch", tasks, complete: true };
}
