import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperatorQueueItem } from "./types";

const URGENCY_RANK = { critical: 0, high: 1, normal: 2, low: 3 } as const;
const KIND_RANK: Record<OperatorQueueItem["kind"], number> = {
  reply: 0,
  approval: 1,
  task: 2,
  follow_up: 3,
  meeting: 4,
  proposal: 5,
  system: 6,
};

export function sortOperatorQueue(items: OperatorQueueItem[]): OperatorQueueItem[] {
  return [...items].sort((a, b) => {
    const urgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (urgency) return urgency;
    const kind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kind) return kind;
    return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
  });
}

export async function loadOperatorQueue(supabase: SupabaseClient): Promise<OperatorQueueItem[]> {
  const now = new Date().toISOString();
  const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  const [actions, tasks, conversations, proposals] = await Promise.all([
    supabase.from("action_queue").select("id,title,description,urgency,entity_type,entity_id,created_at").eq("status", "pending").limit(50),
    supabase.from("tasks").select("id,title,description,priority,due_date,related_type,related_id").in("status", ["pending", "snoozed"]).lte("due_date", inSevenDays.slice(0, 10)).limit(50),
    supabase.from("conversations").select("id,subject,unread_count,last_message_at,intent").gt("unread_count", 0).order("last_message_at", { ascending: false }).limit(30),
    supabase.from("proposals").select("id,title,status,expires_at,updated_at").in("status", ["sent", "viewed"]).limit(30),
  ]);
  const firstError = [actions.error, tasks.error, conversations.error, proposals.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const items: OperatorQueueItem[] = [];
  for (const action of actions.data ?? []) items.push({
    id: `action:${action.id}`,
    kind: "approval",
    title: action.title,
    summary: action.description || "Review the proposed action before it runs.",
    urgency: action.urgency,
    dueAt: action.created_at,
    href: "/admin/today?focus=approvals",
    entityType: action.entity_type || undefined,
    entityId: action.entity_id || undefined,
  });
  for (const task of tasks.data ?? []) items.push({
    id: `task:${task.id}`,
    kind: task.related_type === "lead" ? "follow_up" : "task",
    title: task.title,
    summary: task.description || "An operator task is due.",
    urgency: task.priority === "high" ? "high" : task.due_date && task.due_date < now.slice(0, 10) ? "critical" : "normal",
    dueAt: task.due_date,
    href: task.related_id ? `/admin/pipeline?opportunity=${task.related_id}` : "/admin/today",
    entityType: task.related_type || undefined,
    entityId: task.related_id || undefined,
  });
  for (const conversation of conversations.data ?? []) items.push({
    id: `conversation:${conversation.id}`,
    kind: "reply",
    title: conversation.subject || "Unread conversation",
    summary: `${conversation.unread_count} unread message${conversation.unread_count === 1 ? "" : "s"}${conversation.intent ? ` · ${conversation.intent}` : ""}`,
    urgency: conversation.intent === "buying" || conversation.intent === "complaint" ? "high" : "normal",
    dueAt: conversation.last_message_at,
    href: `/admin/conversations?thread=${conversation.id}`,
    entityType: "conversation",
    entityId: conversation.id,
  });
  for (const proposal of proposals.data ?? []) items.push({
    id: `proposal:${proposal.id}`,
    kind: "proposal",
    title: proposal.title,
    summary: proposal.status === "viewed" ? "Viewed and awaiting a response." : "Sent and awaiting a response.",
    urgency: proposal.expires_at && proposal.expires_at < inSevenDays ? "high" : "normal",
    dueAt: proposal.expires_at || proposal.updated_at,
    href: "/admin/proposals",
    entityType: "proposal",
    entityId: proposal.id,
  });
  return sortOperatorQueue(items).slice(0, 75);
}
