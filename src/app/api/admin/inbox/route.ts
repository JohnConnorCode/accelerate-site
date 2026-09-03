import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { calculateLeadScore } from "@/lib/admin/lead-scoring";
import type { AdminInboxItem, AdminInboxKind } from "@/lib/admin/inbox";

const VALID_KINDS = new Set<AdminInboxKind>([
  "lead",
  "contact",
  "chat",
  "partner",
  "task",
  "proposal",
  "coworker",
  "action",
]);
const priorityRank = { urgent: 0, important: 1, normal: 2 } as const;

function cleanSummary(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 180) : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const requestedKind = searchParams.get("kind") as AdminInboxKind | null;
  const kind = requestedKind && VALID_KINDS.has(requestedKind) ? requestedKind : null;
  const query = (searchParams.get("q") || "").trim().toLowerCase().slice(0, 100);
  const supabase = auth.database;
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const stalledBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [leads, contacts, chats, partners, tasks, proposals, coworkerWork, pendingActions] = await Promise.all([
    supabase
      .from("solution_requests")
      .select(
        "id, contact_name, contact_email, contact_phone, business_name, industry, lead_status, created_at, ai_plan, intake_data, view_count",
      )
      .eq("lead_status", "new")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("contact_submissions")
      .select("id, name, email, phone, business_type, message, created_at, read_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("chat_leads")
      .select("id, name, email, conversation, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("partner_applications")
      .select("id, name, email, company, partner_type, message, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tasks")
      .select(
        "id, title, description, due_date, due_time, priority, related_type, related_id, related_name, created_at",
      )
      .eq("status", "pending")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("proposals")
      .select("id, title, client_name, status, sent_at, created_at")
      .in("status", ["sent", "viewed"])
      .is("responded_at", null)
      .lt("sent_at", stalledBefore)
      .order("sent_at", { ascending: true })
      .limit(25),
    supabase
      .from("work_items")
      .select("id, kind, objective, reason, coworker_id, status, priority, created_at")
      .eq("surface_in_inbox", true)
      .in("status", ["pending", "claimed", "in_progress", "waiting", "completed"])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("action_queue")
      .select("id, action_key, label, summary, coworker_id, status, created_at, metadata")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const items: AdminInboxItem[] = [];

  for (const lead of leads.data || []) {
    const score = calculateLeadScore(lead);
    const age = now.getTime() - new Date(lead.created_at).getTime();
    items.push({
      id: lead.id,
      kind: "lead",
      title: lead.business_name || lead.contact_name || "New lead",
      summary:
        score >= 70
          ? "High-intent lead waiting for a response."
          : age > 48 * 60 * 60 * 1000
            ? "New lead has been waiting more than 48 hours."
            : "New growth-plan request ready to qualify.",
      priority: score >= 70 ? "urgent" : age > 48 * 60 * 60 * 1000 ? "important" : "normal",
      createdAt: lead.created_at,
      href: "/admin/leads",
      person: { name: lead.contact_name, email: lead.contact_email, phone: lead.contact_phone },
      meta: `${score} lead score${lead.industry ? ` · ${String(lead.industry).replace(/_/g, " ")}` : ""}`,
    });
  }

  for (const contact of contacts.data || []) {
    items.push({
      id: contact.id,
      kind: "contact",
      title: contact.name || "Contact request",
      summary: cleanSummary(contact.message, "New contact submission waiting for review."),
      priority: "important",
      createdAt: contact.created_at,
      href: `/admin/contacts/${encodeURIComponent(contact.email)}`,
      person: { name: contact.name, email: contact.email, phone: contact.phone },
      meta: contact.business_type
        ? String(contact.business_type).replace(/_/g, " ")
        : "Contact form",
    });
  }

  for (const chat of chats.data || []) {
    const conversation = Array.isArray(chat.conversation) ? chat.conversation : [];
    const finalMessage = [...conversation]
      .reverse()
      .find((message) => message && typeof message === "object" && "content" in message) as
      { content?: unknown } | undefined;
    items.push({
      id: chat.id,
      kind: "chat",
      title: chat.name || chat.email || "Chat handoff",
      summary: cleanSummary(
        finalMessage?.content,
        "A site conversation requested human follow-up.",
      ),
      priority: "important",
      createdAt: chat.created_at,
      href: "/admin/chat-leads",
      person: { name: chat.name, email: chat.email },
      meta: `${conversation.length} message${conversation.length === 1 ? "" : "s"}`,
    });
  }

  for (const partner of partners.data || []) {
    items.push({
      id: partner.id,
      kind: "partner",
      title: partner.company || partner.name || "Partner application",
      summary: cleanSummary(partner.message, "New partner application ready for review."),
      priority: "normal",
      createdAt: partner.created_at,
      href: "/admin/partners",
      person: { name: partner.name, email: partner.email },
      meta: partner.partner_type
        ? `${String(partner.partner_type).replace(/_/g, " ")} partner`
        : "Partner application",
    });
  }

  for (const task of tasks.data || []) {
    const overdue = Boolean(task.due_date && task.due_date < today);
    items.push({
      id: task.id,
      kind: "task",
      title: task.title,
      summary: cleanSummary(
        task.description,
        task.related_name
          ? `Follow-up connected to ${task.related_name}.`
          : "Operational follow-up.",
      ),
      priority:
        overdue || task.priority === "high"
          ? "urgent"
          : task.priority === "medium"
            ? "important"
            : "normal",
      createdAt: task.created_at,
      dueAt: task.due_date,
      href:
        task.related_type === "client" && task.related_id
          ? `/admin/clients/${task.related_id}`
          : task.related_type === "lead"
            ? "/admin/leads"
            : "/admin/inbox?kind=task",
      meta: overdue
        ? "Overdue"
        : task.due_date
          ? `Due ${task.due_date}${task.due_time ? ` at ${task.due_time}` : ""}`
          : `${task.priority || "medium"} priority`,
    });
  }

  for (const proposal of proposals.data || []) {
    items.push({
      id: proposal.id,
      kind: "proposal",
      title: proposal.title || proposal.client_name || "Stalled proposal",
      summary: "Proposal has been waiting at least three days without a response.",
      priority: "important",
      createdAt: proposal.sent_at || proposal.created_at,
      href: "/admin/proposals",
      person: { name: proposal.client_name },
      meta: proposal.status === "viewed" ? "Viewed, awaiting response" : "Sent, awaiting response",
    });
  }

  // Coworker work items that opted into inbox visibility.
  const COWORKER_WORK_LABELS: Record<string, string> = {
    proactive_intelligence_brief: "Intel Brief",
    review_trust_promotion: "Trust Promotion",
    qualify_lead: "Lead Qualify",
    draft_followup: "Follow-up Draft",
    daily_digest: "Daily Digest",
    daily_health_check: "Health Check",
    detect_stale_deals: "Stale Deals",
    detect_stage_bottleneck: "Bottleneck",
    detect_velocity_change: "Velocity Change",
    integration_status_audit: "Integration Audit",
    data_quality_scan: "Data Quality",
    detect_overdue_payments: "Overdue Payments",
    revenue_stage_audit: "Revenue Audit",
    pre_call_brief: "Pre-call Brief",
    post_meeting_process: "Meeting Process",
    update_crm_from_meeting: "CRM Update",
    weekly_reconciliation: "Weekly Recon",
  };

  for (const wi of coworkerWork.data || []) {
    const label = COWORKER_WORK_LABELS[wi.kind] || wi.kind.replace(/_/g, " ");
    const isCompleted = wi.status === "completed";
    items.push({
      id: wi.id,
      kind: "coworker",
      title: `${label}: ${wi.objective.slice(0, 80)}`,
      summary: cleanSummary(wi.reason, `Coworker work item (${wi.kind}).`),
      priority: wi.priority === "high" ? "urgent" : wi.priority === "medium" ? "important" : "normal",
      createdAt: wi.created_at,
      href: isCompleted ? `/admin/ai/runs` : `/admin/ai`,
      meta: `${wi.status.replace(/_/g, " ")} · ${label}`,
    });
  }

  // Pending action proposals from coworkers awaiting human approval.
  for (const action of pendingActions.data || []) {
    items.push({
      id: action.id,
      kind: "action",
      title: action.label || action.action_key || "Action proposal",
      summary: cleanSummary(action.summary, "Coworker action proposal needs your approval."),
      priority: "important",
      createdAt: action.created_at,
      href: "/admin/ai",
      meta: action.coworker_id
        ? `Coworker: ${action.coworker_id}`
        : "Pending approval",
    });
  }

  const counts = {
    all: items.length,
    lead: items.filter((item) => item.kind === "lead").length,
    contact: items.filter((item) => item.kind === "contact").length,
    chat: items.filter((item) => item.kind === "chat").length,
    partner: items.filter((item) => item.kind === "partner").length,
    task: items.filter((item) => item.kind === "task").length,
    proposal: items.filter((item) => item.kind === "proposal").length,
    coworker: items.filter((item) => item.kind === "coworker").length,
    action: items.filter((item) => item.kind === "action").length,
  };

  const filtered = items
    .filter((item) => !kind || item.kind === kind)
    .filter(
      (item) =>
        !query ||
        `${item.title} ${item.summary} ${item.meta || ""} ${item.person?.name || ""} ${item.person?.email || ""}`
          .toLowerCase()
          .includes(query),
    )
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        new Date(a.dueAt || a.createdAt).getTime() - new Date(b.dueAt || b.createdAt).getTime(),
    )
    .slice(0, 75);

  return NextResponse.json({ items: filtered, counts, updatedAt: now.toISOString() });
}
