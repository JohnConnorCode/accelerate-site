import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { calculateLeadScore } from "@/lib/admin/lead-scoring";
import { recordLegacyAdapterUse } from "@/lib/revenue-os/legacy-adapter";
import type { AdminInboxItem, AdminInboxKind } from "@/lib/admin/inbox";

const VALID_KINDS = new Set<AdminInboxKind>(["lead", "chat", "partner", "proposal"]);
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
  const stalledBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [leads, chats, partners, proposals] = await Promise.all([
    supabase
      .from("solution_requests")
      .select(
        "id, contact_name, contact_email, contact_phone, business_name, industry, lead_status, created_at, ai_plan, intake_data, view_count",
      )
      .eq("lead_status", "new")
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
      .from("proposals")
      .select("id, title, client_name, status, sent_at, created_at")
      .in("status", ["sent", "viewed"])
      .is("responded_at", null)
      .lt("sent_at", stalledBefore)
      .order("sent_at", { ascending: true })
      .limit(25),
  ]);

  const items: AdminInboxItem[] = [];

  // Inbox reads legacy source tables directly (no adapter): record the read
  // so the retirement ledger knows this consumer. Best-effort, never throws.
  await recordLegacyAdapterUse(supabase, {
    route: "admin-inbox",
    rows: (leads.data?.length ?? 0) + (chats.data?.length ?? 0) + (partners.data?.length ?? 0),
    linked: 0,
  });

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

  const counts = {
    all: items.length,
    lead: items.filter((item) => item.kind === "lead").length,
    chat: items.filter((item) => item.kind === "chat").length,
    partner: items.filter((item) => item.kind === "partner").length,
    proposal: items.filter((item) => item.kind === "proposal").length,
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
