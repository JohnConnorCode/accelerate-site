import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperatorQueueItem } from "./types";
import { loadOperationalHealth } from "./health";

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
    const deadline = (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
    if (deadline) return deadline;
    const kind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kind) return kind;
    const source = a.sourceTimestamp.localeCompare(b.sourceTimestamp);
    if (source) return source;
    return a.id.localeCompare(b.id);
  });
}

export function summarizeOperatorQueue(items: OperatorQueueItem[]) {
  const byKind = { reply: 0, approval: 0, task: 0, follow_up: 0, meeting: 0, proposal: 0, system: 0 } satisfies Record<OperatorQueueItem["kind"], number>;
  for (const item of items) byKind[item.kind] += 1;
  return {
    total: items.length,
    urgent: items.filter((item) => item.urgency === "critical" || item.urgency === "high").length,
    critical: items.filter((item) => item.urgency === "critical").length,
    byKind,
  };
}

export function validateOperatorQueue(items: OperatorQueueItem[]): OperatorQueueItem[] {
  for (const item of items) {
    if (!item.id || !item.priorityReason?.trim() || !item.sourceTimestamp?.trim() || !item.recommendedNextAction?.trim() || !item.href?.startsWith("/admin/")) {
      throw new Error(`Priority item ${item.id || "without an id"} does not satisfy the operator queue contract`);
    }
  }
  return items;
}

export function operatorTaskQueuePresentation(task: { source?: string | null; title: string; priority: string; dueDate: string | null }, today: string) {
  const isRecovery = task.source === "recovery";
  if (isRecovery) {
    const booking = task.title.startsWith("Confirm recovery booking:");
    return {
      kind: "reply" as const,
      priorityReason: booking ? "Recovery booking needs immediate confirmation" : "Recovery reply needs a personal response",
      recommendedNextAction: booking
        ? "Open the contact, confirm the appointment, prepare the conversation, then complete the task."
        : "Open the contact, respond personally while intent is fresh, then complete the task.",
    };
  }
  const priorityReason = task.dueDate && task.dueDate < today ? "Overdue commitment"
    : task.priority === "high" ? "High-priority commitment"
      : task.dueDate ? `Due ${task.dueDate}` : "Open operator commitment";
  return {
    kind: "task" as const,
    priorityReason,
    recommendedNextAction: "Open the linked record and complete the commitment, or snooze it with a reason.",
  };
}

export function operatorTaskRecordHref(task: { related_type: string | null; related_id: string | null; opportunity_id: string | null }): string {
  if (task.opportunity_id) return `/admin/pipeline/${task.opportunity_id}`;
  if (!task.related_id) return "/admin/today";
  if (task.related_type === "proposal") return `/admin/proposals?proposal=${task.related_id}`;
  if (task.related_type === "client") return `/admin/clients/${task.related_id}`;
  if (task.related_type === "contact") return `/admin/contacts?contact=${task.related_id}`;
  if (task.related_type === "campaign") return `/admin/campaigns?campaign=${task.related_id}`;
  if (task.related_type === "lead") return "/admin/leads";
  return "/admin/today";
}

export async function loadOperatorQueue(supabase: SupabaseClient): Promise<OperatorQueueItem[]> {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const inFortyEightHours = new Date(nowDate.getTime() + 48 * 3_600_000).toISOString();
  const inSevenDays = new Date(nowDate.getTime() + 7 * 86_400_000).toISOString();
  const [actions, tasks, conversations, proposals, meetings, campaignExceptions, health] = await Promise.all([
    supabase.from("action_queue").select("id,title,description,urgency,entity_type,entity_id,created_at").eq("status", "pending").or(`expires_at.is.null,expires_at.gt.${now}`).limit(50),
    supabase.from("tasks").select("id,title,description,priority,due_date,snoozed_until,related_type,related_id,opportunity_id,source,created_at").in("status", ["pending", "snoozed"]).lte("due_date", inSevenDays.slice(0, 10)).limit(50),
    supabase.from("conversations").select("id,subject,unread_count,last_message_at,intent").gt("unread_count", 0).order("last_message_at", { ascending: false }).limit(30),
    supabase.from("proposals").select("id,title,status,expires_at,updated_at").in("status", ["sent", "viewed"]).limit(30),
    supabase.from("calendar_events").select("id,title,start_at,updated_at,opportunity_id,status").gte("start_at", now).lte("start_at", inFortyEightHours).neq("status", "cancelled").limit(30),
    supabase.from("campaign_members").select("id,campaign_id,stop_reason,updated_at,campaigns!campaign_members_campaign_id_tenant_fkey(name)").eq("status", "stopped").eq("stop_reason", "send_failed_requires_reconciliation").limit(30),
    loadOperationalHealth(supabase),
  ]);
  const firstError = [actions.error, tasks.error, conversations.error, proposals.error, meetings.error, campaignExceptions.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const items: OperatorQueueItem[] = [];
  for (const action of actions.data ?? []) items.push({
    id: `action:${action.id}`,
    kind: "approval",
    title: action.title,
    summary: action.description || "Review the proposed action before it runs.",
    urgency: action.urgency,
    dueAt: action.created_at,
    sourceTimestamp: action.created_at,
    priorityReason: "Approval required before execution",
    recommendedNextAction: "Review the exact action and approve or reject it.",
    href: `/admin/today?focus=approval&action=${action.id}`,
    entityType: action.entity_type || undefined,
    entityId: action.entity_id || undefined,
  });
  for (const task of tasks.data ?? []) {
    if (task.snoozed_until && task.snoozed_until > now.slice(0, 10)) continue;
    const presentation = operatorTaskQueuePresentation({ source: task.source, title: task.title, priority: task.priority, dueDate: task.due_date }, now.slice(0, 10));
    items.push({
    id: `task:${task.id}`,
    kind: task.related_type === "lead" ? "follow_up" : presentation.kind,
    title: task.title,
    summary: task.description || "An operator task is due.",
    urgency: task.priority === "high" ? "high" : task.due_date && task.due_date < now.slice(0, 10) ? "critical" : "normal",
    dueAt: task.due_date,
    sourceTimestamp: task.created_at,
    priorityReason: presentation.priorityReason,
    recommendedNextAction: task.related_id ? presentation.recommendedNextAction : "Complete the commitment, or snooze it to a specific date.",
    href: operatorTaskRecordHref(task),
    entityType: task.related_type || undefined,
    entityId: task.related_id || undefined,
    });
  }
  for (const conversation of conversations.data ?? []) items.push({
    id: `conversation:${conversation.id}`,
    kind: "reply",
    title: conversation.subject || "Unread conversation",
    summary: `${conversation.unread_count} unread message${conversation.unread_count === 1 ? "" : "s"}${conversation.intent ? ` · ${conversation.intent}` : ""}`,
    urgency: conversation.intent === "buying" || conversation.intent === "complaint" ? "high" : "normal",
    dueAt: conversation.last_message_at,
    sourceTimestamp: conversation.last_message_at || "unknown",
    priorityReason: conversation.intent === "buying" ? "Buying signal needs a reply" : conversation.intent === "complaint" ? "Complaint needs a reply" : "Unread customer reply",
    recommendedNextAction: "Open the conversation, read the latest message, and send or stage a grounded reply.",
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
    sourceTimestamp: proposal.updated_at,
    priorityReason: proposal.expires_at && proposal.expires_at < inSevenDays ? "Proposal expires within seven days" : proposal.status === "viewed" ? "Client viewed; follow up deliberately" : "Proposal is awaiting a response",
    recommendedNextAction: proposal.status === "viewed" ? "Review the proposal activity and send a deliberate follow-up." : "Confirm delivery and schedule the next follow-up before expiry.",
    href: `/admin/proposals?proposal=${proposal.id}`,
    entityType: "proposal",
    entityId: proposal.id,
  });
  for (const meeting of meetings.data ?? []) items.push({
    id: `meeting:${meeting.id}`,
    kind: "meeting",
    title: meeting.title,
    summary: "Upcoming calendar event that may need preparation.",
    urgency: meeting.start_at && meeting.start_at <= new Date(nowDate.getTime() + 24 * 3_600_000).toISOString() ? "high" : "normal",
    dueAt: meeting.start_at,
    sourceTimestamp: meeting.updated_at,
    priorityReason: meeting.start_at && meeting.start_at <= new Date(nowDate.getTime() + 24 * 3_600_000).toISOString() ? "Meeting starts within 24 hours" : "Meeting starts within 48 hours",
    recommendedNextAction: "Review the linked opportunity and prepare objectives, context, and open questions.",
    href: meeting.opportunity_id ? `/admin/pipeline/${meeting.opportunity_id}` : "/admin/bookings",
    entityType: "calendar_event",
    entityId: meeting.id,
  });
  for (const member of campaignExceptions.data ?? []) {
    const campaign = Array.isArray(member.campaigns) ? member.campaigns[0] : member.campaigns;
    items.push({
      id: `campaign:${member.id}`,
      kind: "system",
      title: `${campaign?.name || "Campaign"} delivery needs reconciliation`,
      summary: "Delivery retries were exhausted and this recipient was stopped safely.",
      urgency: "high",
      dueAt: member.updated_at,
      sourceTimestamp: member.updated_at,
      priorityReason: "Campaign delivery stopped after bounded retries",
      recommendedNextAction: "Open the campaign, inspect the delivery receipt, and decide whether to correct or suppress the recipient.",
      href: `/admin/campaigns?campaign=${member.campaign_id}`,
      entityType: "campaign_member",
      entityId: member.id,
    });
  }
  for (const concern of health.concerns) items.push({
    id: `system:${concern.kind}:${concern.key}`,
    kind: "system",
    title: `${concern.key.replaceAll("_", " ")} needs attention`,
    summary: concern.detail,
    urgency: concern.kind === "webhook" || concern.kind === "job" ? "critical" : "high",
    dueAt: concern.observedAt,
    sourceTimestamp: concern.observedAt || "unknown",
    priorityReason: concern.kind === "webhook" ? "Inbound event failed to process" : concern.kind === "job" ? "Automated work did not complete cleanly" : concern.kind === "source" ? "Source synchronization is degraded" : "Integration health is degraded",
    recommendedNextAction: "Open Setup Center, inspect the failing receipt, and run the listed behavioral recovery check.",
    href: "/admin/setup",
    entityType: concern.kind,
  });
  return sortOperatorQueue(validateOperatorQueue(items)).slice(0, 75);
}
