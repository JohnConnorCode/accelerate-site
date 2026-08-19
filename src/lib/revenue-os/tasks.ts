import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

type OperatorTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
};

export async function createRevenueTask(supabase: SupabaseClient, input: {
  title: string; description?: string | null; dueDate?: string | null; dueTime?: string | null; priority?: "high" | "medium" | "low";
  relatedType?: string | null; relatedId?: string | null; relatedName?: string | null; opportunityId?: string | null;
  source: string; dedupeKey?: string | null; actorEmail: string;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");
  if (input.dedupeKey) {
    const { data: existing, error } = await supabase.from("tasks").select("*").eq("dedupe_key", input.dedupeKey).in("status", ["pending", "snoozed"]).maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) return { task: existing, deduplicated: true };
  }
  const { data: task, error } = await supabase.from("tasks").insert({ title, description: input.description || null, due_date: input.dueDate || null, due_time: input.dueTime || null, priority: input.priority || "medium", related_type: input.relatedType || null, related_id: input.relatedId || null, related_name: input.relatedName || null, opportunity_id: input.opportunityId || null, source: input.source, dedupe_key: input.dedupeKey || null }).select("*").single();
  if (error) throw new Error(error.message);
  await recordAudit(supabase, { actorEmail: input.actorEmail, action: "task.created", entityType: "task", entityId: task.id, after: task, metadata: { source: input.source, dedupe_key: input.dedupeKey || null } });
  const { error: activityError } = await supabase.from("activities").insert({ activity_type: "task_created", title: `Task created: ${title}`, summary: input.description || null, opportunity_id: input.opportunityId || null, source: input.source, actor_email: input.actorEmail, external_id: `task:${task.id}:created`, metadata: { task_id: task.id, priority: task.priority } });
  if (activityError) console.error("[revenue-os/tasks] activity receipt failed", activityError.message);
  return { task, deduplicated: false };
}

async function loadOpenTask(supabase: SupabaseClient, id: string): Promise<OperatorTask> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,due_date,snoozed_until,completed_at")
    .eq("id", id)
    .in("status", ["pending", "snoozed"])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This task was already completed or is no longer available");
  return data;
}

export async function completeOperatorTask(supabase: SupabaseClient, input: { id: string; actorEmail: string }) {
  const before = await loadOpenTask(supabase, input.id);
  const completedAt = new Date().toISOString();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: completedAt, snoozed_until: null })
    .eq("id", input.id)
    .eq("status", before.status)
    .select("id,title,status,due_date,snoozed_until,completed_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("This task changed while you were working. Refresh and try again.");
  await recordAudit(supabase, { actorEmail: input.actorEmail, action: "task.completed", entityType: "task", entityId: input.id, before, after: task });
  await supabase.from("activities").insert({ activity_type: "task_completed", title: `Task completed: ${task.title}`, source: "admin", actor_email: input.actorEmail, external_id: `task:${task.id}:completed`, metadata: { task_id: task.id } });
  return task;
}

export async function snoozeOperatorTask(supabase: SupabaseClient, input: { id: string; until: string; actorEmail: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until)) throw new Error("Choose a valid snooze date");
  const today = new Date().toISOString().slice(0, 10);
  if (input.until <= today) throw new Error("Choose a snooze date after today");
  const before = await loadOpenTask(supabase, input.id);
  const { data: task, error } = await supabase
    .from("tasks")
    .update({ status: "snoozed", snoozed_until: input.until })
    .eq("id", input.id)
    .eq("status", before.status)
    .select("id,title,status,due_date,snoozed_until,completed_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("This task changed while you were working. Refresh and try again.");
  await recordAudit(supabase, { actorEmail: input.actorEmail, action: "task.snoozed", entityType: "task", entityId: input.id, before, after: task, metadata: { until: input.until } });
  await supabase.from("activities").insert({ activity_type: "task_snoozed", title: `Task snoozed: ${task.title}`, source: "admin", actor_email: input.actorEmail, external_id: `task:${task.id}:snoozed:${input.until}`, metadata: { task_id: task.id, until: input.until } });
  return task;
}
