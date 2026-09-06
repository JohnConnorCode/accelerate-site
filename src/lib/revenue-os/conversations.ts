import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { createRevenueTask } from "./tasks";
import { createOpportunity } from "./pipeline";
import { isMissingRevenueSchema } from "./db";
import { findCanonicalContactByEmail, exactIlike } from "./identity";
import { recordEvidence } from "./claims";
import { proposeAction } from "./actions";

export const CONVERSATIONS_CONTRACT = "revenue-os-conversations.v1";

export type ConversationStatus = "open" | "waiting" | "resolved" | "archived";
export type ConversationChannel = "gmail" | "resend" | "form" | "chat" | "manual";

export interface ConversationFilter {
  status?: ConversationStatus | "all";
  channel?: ConversationChannel | "all";
  intent?: string;
  record?: "all" | "linked" | "unlinked";
  campaign?: "all" | "linked" | "unlinked";
  unreadOnly?: boolean;
  /**
   * Threads with at least one non-completed task linked by related_id.
   * Follow-up commitments are created from the inbox itself
   * (createTaskFromConversation), so the link is exact, not guessed.
   */
  followUp?: boolean;
  /**
   * Assignment filter without a schema migration: the operator assignee lives
   * at metadata.assigned_to (see assignConversation). "unassigned" matches
   * threads with no assignee; any other value matches that exact email;
   * absent means no assignment filtering.
   */
  assignee?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationItem {
  id: string;
  channel: string;
  external_id: string | null;
  subject: string | null;
  status: ConversationStatus;
  intent: string | null;
  unread_count: number;
  last_message_at: string | null;
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  campaign_id: string | null;
  /** Operator assignee email from metadata.assigned_to; null when unassigned. */
  assignee_email: string | null;
  metadata: Record<string, unknown>;
  contact?: {
    id: string;
    full_name: string;
    primary_email: string | null;
    phone?: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
    domain?: string | null;
  } | null;
  opportunity?: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  external_id?: string | null;
  provider_id?: string | null;
  direction: "inbound" | "outbound";
  sender_email: string | null;
  recipient_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface ConversationDetail {
  contract: typeof CONVERSATIONS_CONTRACT;
  conversation: ConversationItem;
  messages: ConversationMessage[];
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  opportunity: Record<string, unknown> | null;
  tasks: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  suggestedReply: {
    body: string;
    intent: string;
    confidence: number;
  } | null;
}

export interface InboxStats {
  total: number;
  open: number;
  unread: number;
  waiting: number;
  resolved: number;
  archived: number;
}

/**
 * List conversations with rich filters, attached identity/pipeline records, and computed inbox stats.
 */
export async function listConversations(
  supabase: SupabaseClient,
  filter: ConversationFilter = {},
): Promise<{
  conversations: ConversationItem[];
  stats: InboxStats;
  schemaReady: boolean;
  /** Distinct intents across the loaded window, for building the filter. */
  intents: string[];
}> {
  const { data: allRaw, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      channel,
      external_id,
      subject,
      contact_id,
      company_id,
      opportunity_id,
      campaign_id,
      status,
      intent,
      unread_count,
      last_message_at,
      metadata,
      created_at,
      updated_at
    `,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);

  if (error) {
    if (isMissingRevenueSchema(error)) {
      return {
        conversations: [],
        stats: { total: 0, open: 0, unread: 0, waiting: 0, resolved: 0, archived: 0 },
        schemaReady: false,
        intents: [],
      };
    }
    throw new Error(`Could not load conversations: ${error.message}`);
  }

  const rows = (allRaw || []) as Array<Record<string, unknown>>;

  // Compute overall stats across all rows
  const stats: InboxStats = {
    total: rows.length,
    open: 0,
    unread: 0,
    waiting: 0,
    resolved: 0,
    archived: 0,
  };

  for (const row of rows) {
    const status = (row.status as ConversationStatus) || "open";
    const unread = Number(row.unread_count) || 0;
    if (status === "open") stats.open += 1;
    if (status === "waiting") stats.waiting += 1;
    if (status === "resolved") stats.resolved += 1;
    if (status === "archived") stats.archived += 1;
    if (unread > 0) stats.unread += 1;
  }

  // Collect linked IDs for efficient batch hydration
  const contactIds = [...new Set(rows.map((r) => r.contact_id as string).filter(Boolean))];
  const companyIds = [...new Set(rows.map((r) => r.company_id as string).filter(Boolean))];
  const opportunityIds = [...new Set(rows.map((r) => r.opportunity_id as string).filter(Boolean))];

  const [contactsRes, companiesRes, oppsRes] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, full_name, primary_email, phone").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? supabase.from("companies").select("id, name, domain").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    opportunityIds.length
      ? supabase
          .from("opportunities")
          .select("id, name, stage, estimated_value")
          .in("id", opportunityIds)
      : Promise.resolve({ data: [] }),
  ]);

  const contactMap = new Map((contactsRes.data || []).map((c) => [c.id, c]));
  const companyMap = new Map((companiesRes.data || []).map((c) => [c.id, c]));
  const oppMap = new Map((oppsRes.data || []).map((o) => [o.id, o]));

  const mapped: ConversationItem[] = rows.map((r) => {
    const contact = r.contact_id ? contactMap.get(r.contact_id as string) || null : null;
    const company = r.company_id ? companyMap.get(r.company_id as string) || null : null;
    const opp = r.opportunity_id ? oppMap.get(r.opportunity_id as string) || null : null;

    return {
      id: r.id as string,
      channel: (r.channel as string) || "manual",
      external_id: (r.external_id as string) || null,
      subject: (r.subject as string) || null,
      status: (r.status as ConversationStatus) || "open",
      intent: (r.intent as string) || null,
      unread_count: Number(r.unread_count) || 0,
      last_message_at: (r.last_message_at as string) || null,
      contact_id: (r.contact_id as string) || null,
      company_id: (r.company_id as string) || null,
      opportunity_id: (r.opportunity_id as string) || null,
      campaign_id: (r.campaign_id as string) || null,
      assignee_email:
        ((r.metadata as Record<string, unknown> | null)?.assigned_to as string) || null,
      metadata: (r.metadata as Record<string, unknown>) || {},
      contact,
      company,
      opportunity: opp
        ? {
            id: opp.id,
            name: opp.name,
            stage: opp.stage,
            estimated_value: Number(opp.estimated_value) || 0,
          }
        : null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    };
  });

  // Apply in-memory filters
  let filtered = mapped;

  if (filter.status && filter.status !== "all") {
    filtered = filtered.filter((c) => c.status === filter.status);
  }

  if (filter.channel && filter.channel !== "all") {
    filtered = filtered.filter((c) => c.channel === filter.channel);
  }

  if (filter.intent && filter.intent !== "all") {
    filtered = filtered.filter(
      (c) => (c.intent || "").toLowerCase() === (filter.intent || "").toLowerCase(),
    );
  }

  if (filter.unreadOnly) {
    filtered = filtered.filter((c) => c.unread_count > 0);
  }

  if (filter.record === "linked") {
    filtered = filtered.filter((c) => Boolean(c.opportunity_id || c.contact_id));
  } else if (filter.record === "unlinked") {
    filtered = filtered.filter((c) => !c.opportunity_id && !c.contact_id);
  }

  if (filter.campaign === "linked") {
    filtered = filtered.filter((c) => Boolean(c.campaign_id));
  } else if (filter.campaign === "unlinked") {
    filtered = filtered.filter((c) => !c.campaign_id);
  }

  if (filter.assignee !== undefined) {
    if (filter.assignee === "unassigned") {
      filtered = filtered.filter((c) => !c.assignee_email);
    } else if (filter.assignee.trim()) {
      const wanted = filter.assignee.trim().toLowerCase();
      filtered = filtered.filter((c) => (c.assignee_email || "").toLowerCase() === wanted);
    }
  }

  if (filter.followUp) {
    const ids = filtered.map((c) => c.id);
    const { data: openTasks, error: tasksError } = ids.length
      ? await supabase
          .from("tasks")
          .select("related_id")
          .in("related_id", ids)
          .neq("status", "completed")
      : { data: [], error: null };
    if (tasksError) throw new Error(`Could not load follow-up tasks: ${tasksError.message}`);
    const followUpIds = new Set(
      ((openTasks ?? []) as Array<Record<string, unknown>>).map((t) => t.related_id as string),
    );
    filtered = filtered.filter((c) => followUpIds.has(c.id));
  }

  if (filter.search?.trim()) {
    const q = filter.search.trim().toLowerCase();
    filtered = filtered.filter((c) => {
      const email = (c.metadata?.contact_email as string) || c.contact?.primary_email || "";
      const name = c.contact?.full_name || "";
      const company = c.company?.name || "";
      const subject = c.subject || "";
      const intent = c.intent || "";
      return (
        email.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        intent.toLowerCase().includes(q)
      );
    });
  }

  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const paged = filtered.slice(offset, offset + limit);

  const intents = [
    ...new Set(mapped.map((c) => c.intent).filter((i): i is string => Boolean(i))),
  ].sort();

  return {
    conversations: paged,
    stats,
    schemaReady: true,
    intents,
  };
}

/**
 * Load complete conversation detail: ordered messages, linked identity records, tasks, and activity timeline.
 */
export async function getConversationDetail(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const id = conversationId.trim();
  if (!id) throw new Error("Conversation id is required");

  const { data: convRow, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (convErr) throw new Error(`Could not load conversation: ${convErr.message}`);
  if (!convRow) return null;

  const [messagesRes, contactRes, companyRes, oppRes, tasksRes, activitiesRes] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, conversation_id, external_id, provider_id, direction, sender_email, recipient_emails, subject, body_text, body_html, status, sent_at, received_at, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    convRow.contact_id
      ? supabase
          .from("contacts")
          .select(
            "id, full_name, primary_email, alternate_emails, phone, title, lifecycle_stage, communication_status, created_at",
          )
          .eq("id", convRow.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    convRow.company_id
      ? supabase
          .from("companies")
          .select("id, name, domain, website, industry, size_band, location")
          .eq("id", convRow.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    convRow.opportunity_id
      ? supabase
          .from("opportunities")
          .select(
            "id, name, stage, pipeline, estimated_value, won_value, probability, next_action, next_action_at, created_at",
          )
          .eq("id", convRow.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("tasks")
      .select("id, title, description, due_date, due_time, priority, status, created_at")
      .or(
        `opportunity_id.eq.${convRow.opportunity_id || "00000000-0000-0000-0000-000000000000"},related_id.eq.${id}`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("activities")
      .select("id, activity_type, title, summary, occurred_at, created_at")
      .or(
        `conversation_id.eq.${id},opportunity_id.eq.${convRow.opportunity_id || "00000000-0000-0000-0000-000000000000"}`,
      )
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  const messages = (messagesRes.data || []) as ConversationMessage[];
  const contact = (contactRes.data as Record<string, unknown>) || null;
  const company = (companyRes.data as Record<string, unknown>) || null;
  const opportunity = (oppRes.data as Record<string, unknown>) || null;
  const tasks = (tasksRes.data || []) as Array<Record<string, unknown>>;
  const activity = (activitiesRes.data || []) as Array<Record<string, unknown>>;

  // Generate deterministic draft suggestion based on last message
  let suggestedReply: ConversationDetail["suggestedReply"] = null;
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  if (lastInbound && lastInbound.body_text) {
    const text = lastInbound.body_text.toLowerCase();
    if (text.includes("pricing") || text.includes("cost") || text.includes("rate")) {
      suggestedReply = {
        intent: "pricing_inquiry",
        body: `Hi there,\n\nThanks for reaching out regarding pricing. We offer tailored packages structured around your exact operating scope. I'd be glad to walk through the options. Would you have 10 minutes this week for a quick discussion?`,
        confidence: 0.9,
      };
    } else if (text.includes("book") || text.includes("schedule") || text.includes("meet")) {
      suggestedReply = {
        intent: "meeting_request",
        body: `Hi,\n\nThanks for getting in touch. I'd love to connect. What day and time works best for you this week?`,
        confidence: 0.92,
      };
    } else {
      suggestedReply = {
        intent: convRow.intent || "general_inquiry",
        body: `Hi,\n\nThank you for your message. I've reviewed your request and am looking into the details. I'll follow up shortly.`,
        confidence: 0.75,
      };
    }
  }

  const conversationItem: ConversationItem = {
    id: convRow.id,
    channel: convRow.channel,
    external_id: convRow.external_id,
    subject: convRow.subject,
    status: convRow.status as ConversationStatus,
    intent: convRow.intent,
    unread_count: Number(convRow.unread_count) || 0,
    last_message_at: convRow.last_message_at,
    contact_id: convRow.contact_id,
    company_id: convRow.company_id,
    opportunity_id: convRow.opportunity_id,
    campaign_id: convRow.campaign_id,
    assignee_email:
      ((convRow.metadata as Record<string, unknown> | null)?.assigned_to as string) || null,
    metadata: convRow.metadata || {},
    contact: contact
      ? {
          id: contact.id as string,
          full_name: contact.full_name as string,
          primary_email: (contact.primary_email as string) || null,
          phone: (contact.phone as string) || null,
        }
      : null,
    company: company
      ? {
          id: company.id as string,
          name: company.name as string,
          domain: (company.domain as string) || null,
        }
      : null,
    opportunity: opportunity
      ? {
          id: opportunity.id as string,
          name: opportunity.name as string,
          stage: opportunity.stage as string,
          estimated_value: Number(opportunity.estimated_value) || 0,
        }
      : null,
    created_at: convRow.created_at,
    updated_at: convRow.updated_at,
  };

  return {
    contract: CONVERSATIONS_CONTRACT,
    conversation: conversationItem,
    messages,
    contact,
    company,
    opportunity,
    tasks,
    activity,
    suggestedReply,
  };
}

/**
 * Update conversation status (open, waiting, resolved, archived).
 */
export async function updateConversationStatus(
  supabase: SupabaseClient,
  input: {
    id: string;
    status: ConversationStatus;
    actorEmail: string;
  },
): Promise<ConversationItem> {
  const id = input.id.trim();
  if (!id) throw new Error("Conversation id is required");

  const validStatuses: ConversationStatus[] = ["open", "waiting", "resolved", "archived"];
  if (!validStatuses.includes(input.status)) {
    throw new Error(`Invalid status: ${input.status}`);
  }

  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.status === "resolved" || input.status === "archived") {
    patch.unread_count = 0;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update conversation status: ${error.message}`);

  await Promise.all([
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: `conversation.status_${input.status}`,
      entityType: "conversation",
      entityId: id,
      after: data,
    }),
    recordActivity(supabase, {
      activityType: "conversation_status_updated",
      title: `Conversation marked as ${input.status}`,
      summary: `Operator updated conversation status to ${input.status}.`,
      conversationId: id,
      opportunityId: data.opportunity_id || null,
      contactId: data.contact_id || null,
      companyId: data.company_id || null,
      actorEmail: input.actorEmail,
      source: "operator",
      externalId: `conv_status:${id}:${input.status}:${Date.now()}`,
      occurredAt: new Date().toISOString(),
    }),
  ]);

  return data as ConversationItem;
}

/**
 * Assign a conversation to an operator (or clear with null). The assignee
 * lives at metadata.assigned_to rather than a dedicated column: assignment
 * is an operational overlay, not canonical identity, so it rides the
 * existing JSONB metadata instead of costing every capability a migration.
 * Every change carries audit and activity receipts.
 */
export async function assignConversation(
  supabase: SupabaseClient,
  input: {
    id: string;
    assigneeEmail: string | null;
    actorEmail: string;
  },
): Promise<ConversationItem> {
  const id = input.id.trim();
  if (!id) throw new Error("Conversation id is required");
  let assignee: string | null = null;
  if (input.assigneeEmail !== null) {
    assignee = input.assigneeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(assignee))
      throw new Error(`Invalid assignee email ${JSON.stringify(input.assigneeEmail)}`);
  }

  const { data: current, error: readError } = await supabase
    .from("conversations")
    .select("id,metadata,opportunity_id,contact_id,company_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(`Could not load conversation: ${readError.message}`);
  if (!current) throw new Error("Conversation not found");
  const before =
    ((current.metadata as Record<string, unknown> | null)?.assigned_to as string) || null;

  const { data, error } = await supabase
    .from("conversations")
    .update({
      metadata: { ...((current.metadata as Record<string, unknown>) || {}), assigned_to: assignee },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not assign conversation: ${error.message}`);

  await Promise.all([
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: assignee ? "conversation.assigned" : "conversation.unassigned",
      entityType: "conversation",
      entityId: id,
      before: { assigned_to: before },
      after: { assigned_to: assignee },
    }),
    recordActivity(supabase, {
      activityType: "conversation_assigned",
      title: assignee ? `Conversation assigned to ${assignee}` : "Conversation unassigned",
      summary: assignee
        ? `Operator routed the thread to ${assignee}.`
        : "Operator cleared the thread assignment.",
      conversationId: id,
      opportunityId: data.opportunity_id || null,
      contactId: data.contact_id || null,
      companyId: data.company_id || null,
      actorEmail: input.actorEmail,
      source: "operator",
      externalId: `conv_assign:${id}:${assignee || "none"}:${Date.now()}`,
      occurredAt: new Date().toISOString(),
    }),
  ]);

  return { ...(data as Record<string, unknown>), assignee_email: assignee } as ConversationItem;
}

/**
 * Link a conversation to an opportunity and/or contact record.
 */
export async function linkConversationRecord(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    opportunityId?: string | null;
    contactId?: string | null;
    companyId?: string | null;
    actorEmail: string;
  },
): Promise<ConversationItem> {
  const id = input.conversationId.trim();
  if (!id) throw new Error("Conversation id is required");

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.opportunityId !== undefined) patch.opportunity_id = input.opportunityId;
  if (input.contactId !== undefined) patch.contact_id = input.contactId;
  if (input.companyId !== undefined) patch.company_id = input.companyId;

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not link conversation record: ${error.message}`);
  if (!data) throw new Error("Conversation not found");

  // A manual link is human truth: it outranks any later automated inference,
  // so it is recorded on the evidence ledger as well as audit/activity.
  const manualLinks: Array<{ field: string; value: string }> = [];
  if (typeof input.contactId === "string" && input.contactId.trim())
    manualLinks.push({ field: "contact_id", value: input.contactId.trim() });
  if (typeof input.companyId === "string" && input.companyId.trim())
    manualLinks.push({ field: "company_id", value: input.companyId.trim() });
  if (typeof input.opportunityId === "string" && input.opportunityId.trim())
    manualLinks.push({ field: "opportunity_id", value: input.opportunityId.trim() });
  for (const link of manualLinks) {
    await recordEvidence(supabase, {
      entityType: "conversation",
      entityId: id,
      field: link.field,
      proposedValue: link.value,
      sourceType: "operator_link",
      observation: `Founder linked conversation to ${link.field} ${link.value}`,
      strength: "human_entered",
      provenance: { conversation_id: id },
      actorEmail: input.actorEmail,
    });
  }

  await Promise.all([
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "conversation.linked_record",
      entityType: "conversation",
      entityId: id,
      after: data,
    }),
    recordActivity(supabase, {
      activityType: "conversation_linked",
      title: "Conversation linked to business record",
      summary: `Linked to opportunity: ${input.opportunityId || "none"}, contact: ${input.contactId || "none"}.`,
      conversationId: id,
      opportunityId: data.opportunity_id || null,
      contactId: data.contact_id || null,
      companyId: data.company_id || null,
      actorEmail: input.actorEmail,
      source: "operator",
      externalId: `conv_link:${id}:${Date.now()}`,
      occurredAt: new Date().toISOString(),
    }),
  ]);

  return data as ConversationItem;
}

/**
 * Create a new opportunity directly from a conversation and link it.
 */
export async function createOpportunityFromConversation(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    name: string;
    email?: string;
    estimatedValue?: number;
    nextAction?: string;
    actorEmail: string;
  },
): Promise<{ opportunity: Record<string, unknown>; conversation: ConversationItem }> {
  const convId = input.conversationId.trim();
  if (!convId) throw new Error("Conversation id is required");

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", convId)
    .single();

  if (convErr || !conv) throw new Error("Conversation not found");

  const email =
    input.email || (conv.metadata?.contact_email as string) || "inquiry@conversation.local";

  const opp = await createOpportunity(supabase, {
    actorEmail: input.actorEmail,
    name: input.name,
    email,
    opportunityName: input.name,
    estimatedValue: input.estimatedValue ?? 0,
    nextAction: input.nextAction ?? "Follow up on conversation inquiry",
    nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    source: `conversation_${conv.channel || "inbox"}`,
  });

  const updatedConv = await linkConversationRecord(supabase, {
    conversationId: convId,
    opportunityId: opp.id,
    contactId: (opp.contact_id as string) || null,
    companyId: (opp.company_id as string) || null,
    actorEmail: input.actorEmail,
  });

  return {
    opportunity: opp,
    conversation: updatedConv,
  };
}

/**
 * Create a deduplicated task from a conversation.
 */
export async function createTaskFromConversation(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    title: string;
    dueDate?: string;
    priority?: "high" | "medium" | "low";
    description?: string;
    actorEmail: string;
  },
): Promise<{ task: Record<string, unknown> }> {
  const convId = input.conversationId.trim();
  if (!convId) throw new Error("Conversation id is required");

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", convId)
    .single();

  if (convErr || !conv) throw new Error("Conversation not found");

  const dedupeKey = `conversation_task:${convId}:${input.title.trim().toLowerCase().replace(/\s+/g, "_")}`;

  const res = await createRevenueTask(supabase, {
    title: input.title,
    description:
      input.description || `Follow-up commitment for conversation "${conv.subject || convId}".`,
    dueDate: input.dueDate || new Date().toISOString().split("T")[0],
    priority: input.priority || "medium",
    relatedType: "conversation",
    relatedId: convId,
    relatedName: conv.subject || "Conversation",
    opportunityId: conv.opportunity_id || null,
    source: "conversations_inbox",
    dedupeKey,
    actorEmail: input.actorEmail,
  });

  return { task: res.task };
}

export const CONVERSATION_ASSOCIATION_CONTRACT = "revenue-os-conversation-association.v1";

export type ParticipantOutcome = "linked" | "ambiguous" | "unknown";

export interface ParticipantAssociation {
  email: string;
  outcome: ParticipantOutcome;
  contactId: string | null;
  candidates: Array<{ id: string; full_name: string; primary_email: string | null }>;
}

export interface AssociateConversationResult {
  contract: typeof CONVERSATION_ASSOCIATION_CONTRACT;
  conversationId: string;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  participants: ParticipantAssociation[];
  reviewActionIds: string[];
}

/**
 * Deterministically associate thread participants with canonical records.
 *
 * Exactly one exact email match links automatically with recorded evidence.
 * Ambiguous or unknown participants never merge and never throw: each one
 * enters a deduplicated founder review action. Existing conversation links
 * are human or previously verified truth and are only ever filled when
 * blank, never overwritten. No company is created here: a participant links
 * to the canonical company already on their contact record, and a missing
 * company stays missing rather than being invented from an email domain.
 */
export async function associateConversationParticipants(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    participantEmails: string[];
    threadExternalId?: string | null;
    actorEmail?: string;
  },
): Promise<AssociateConversationResult> {
  const conversationId = input.conversationId.trim();
  if (!conversationId) throw new Error("Conversation id is required");
  const actorEmail = input.actorEmail?.trim() || "system";
  const threadId = input.threadExternalId?.trim() || null;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id,contact_id,company_id,opportunity_id,metadata")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conversation) throw new Error("Conversation not found");

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of input.participantEmails) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  const participants: ParticipantAssociation[] = [];
  for (const email of emails) {
    let contact: { id: string; full_name: string; primary_email: string | null } | null = null;
    let ambiguous: Array<{ id: string; full_name: string; primary_email: string | null }> = [];
    try {
      contact = await findCanonicalContactByEmail(supabase, email);
    } catch (error) {
      if (!(error instanceof Error) || !/^Ambiguous contact identity/.test(error.message))
        throw error;
      const [primary, alternate] = await Promise.all([
        supabase
          .from("contacts")
          .select("id,full_name,primary_email")
          .ilike("primary_email", exactIlike(email))
          .limit(5),
        supabase
          .from("contacts")
          .select("id,full_name,primary_email")
          .contains("alternate_emails", [email])
          .limit(5),
      ]);
      if (primary.error) throw new Error(primary.error.message);
      if (alternate.error) throw new Error(alternate.error.message);
      const deduped = new Map<
        string,
        { id: string; full_name: string; primary_email: string | null }
      >();
      for (const row of [...(primary.data ?? []), ...(alternate.data ?? [])]) {
        if (row && typeof row.id === "string") {
          deduped.set(row.id, {
            id: row.id,
            full_name: String(row.full_name ?? ""),
            primary_email: (row.primary_email as string) ?? null,
          });
        }
      }
      ambiguous = [...deduped.values()];
    }
    participants.push({
      email,
      outcome: contact ? "linked" : ambiguous.length ? "ambiguous" : "unknown",
      contactId: contact?.id ?? null,
      candidates: ambiguous,
    });
  }

  const primary = participants.find((p) => p.contactId) ?? null;
  let companyId: string | null = (conversation.company_id as string) ?? null;
  if (!companyId && primary?.contactId) {
    const { data: contactRow, error: contactError } = await supabase
      .from("contacts")
      .select("id,company_id")
      .eq("id", primary.contactId)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);
    companyId = (contactRow?.company_id as string) ?? null;
  }

  let opportunityId: string | null = (conversation.opportunity_id as string) ?? null;
  if (!opportunityId && primary?.contactId) {
    const { data: openOpps, error: oppError } = await supabase
      .from("opportunities")
      .select("id,stage,created_at")
      .eq("contact_id", primary.contactId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (oppError) throw new Error(oppError.message);
    opportunityId =
      (openOpps ?? []).find(
        (opp) =>
          (opp as Record<string, unknown>).stage !== "won" &&
          (opp as Record<string, unknown>).stage !== "lost",
      )?.id ?? null;
  }

  const contactId = primary?.contactId ?? (conversation.contact_id as string) ?? null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!conversation.contact_id && contactId) patch.contact_id = contactId;
  if (!conversation.company_id && companyId) patch.company_id = companyId;
  if (!conversation.opportunity_id && opportunityId) patch.opportunity_id = opportunityId;
  const association = {
    contract: CONVERSATION_ASSOCIATION_CONTRACT,
    status: contactId
      ? "linked"
      : participants.some((p) => p.outcome !== "linked")
        ? "needs_review"
        : "unlinked",
    thread_id: threadId,
    participants: participants.map((p) => ({
      email: p.email,
      outcome: p.outcome,
      contact_id: p.contactId,
    })),
    associated_at: new Date().toISOString(),
  };
  patch.metadata = { ...((conversation.metadata as Record<string, unknown>) ?? {}), association };
  const { error: patchError } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", conversationId);
  if (patchError) throw new Error(patchError.message);

  for (const participant of participants) {
    if (!participant.contactId) continue;
    await recordEvidence(supabase, {
      entityType: "conversation",
      entityId: conversationId,
      field: "contact_id",
      proposedValue: participant.contactId,
      sourceType: "gmail_thread",
      sourceId: threadId,
      observation: `Exact email match for ${participant.email}${threadId ? ` in Gmail thread ${threadId}` : ""}`,
      strength: "verified_external",
      provenance: {
        participant_email: participant.email,
        thread_id: threadId,
        contract: CONVERSATION_ASSOCIATION_CONTRACT,
      },
      actorEmail,
    });
  }

  const reviewActionIds: string[] = [];
  for (const participant of participants) {
    if (participant.outcome === "linked") continue;
    const reason =
      participant.outcome === "ambiguous"
        ? `More than one contact matches ${participant.email}; merging would be a guess`
        : `No canonical contact matches ${participant.email}`;
    const proposed = await proposeAction(supabase, {
      actionType: "identity_review",
      title:
        participant.outcome === "ambiguous"
          ? `Review ambiguous participant ${participant.email}`
          : `Review unknown participant ${participant.email}`,
      description: `${reason}. Open the conversation, confirm the right contact or create one, then link it.`,
      urgency: "normal",
      payload: {
        conversation_id: conversationId,
        participant_email: participant.email,
        reason: participant.outcome,
        candidates: participant.candidates,
        thread_id: threadId,
      },
      reasoning: reason,
      sourceContext: "gmail_record_association",
      entityType: "conversation",
      entityId: conversationId,
      dedupeKey: `identity-review:${conversationId}:${participant.email}`,
      proposedBy: actorEmail,
    });
    if (
      proposed &&
      typeof proposed === "object" &&
      typeof (proposed as Record<string, unknown>).id === "string"
    ) {
      reviewActionIds.push((proposed as Record<string, unknown>).id as string);
    }
  }

  if (contactId) {
    await recordActivity(supabase, {
      activityType: "conversation_associated",
      title: "Conversation linked to canonical records",
      summary: `Deterministic Gmail association linked ${participants.filter((p) => p.contactId).length} participant(s); ${reviewActionIds.length} review action(s) proposed.`,
      contactId,
      companyId,
      opportunityId,
      conversationId,
      actorEmail,
      source: "gmail_sync",
      externalId: `gmail_assoc:${conversationId}:${primary?.email ?? threadId ?? "thread"}`,
      metadata: { thread_id: threadId, contract: CONVERSATION_ASSOCIATION_CONTRACT },
    });
  }
  if (reviewActionIds.length) {
    await recordActivity(supabase, {
      activityType: "conversation_association_needs_review",
      title: "Conversation participants need identity review",
      summary: `${reviewActionIds.length} participant(s) could not be linked deterministically and entered founder review.`,
      contactId,
      companyId,
      opportunityId,
      conversationId,
      actorEmail,
      source: "gmail_sync",
      externalId: `gmail_assoc_review:${conversationId}`,
      metadata: { thread_id: threadId, contract: CONVERSATION_ASSOCIATION_CONTRACT },
    });
  }
  await recordAudit(supabase, {
    actorEmail,
    action: "conversation.associated",
    entityType: "conversation",
    entityId: conversationId,
    source: "automation",
    after: {
      contact_id: contactId,
      company_id: companyId,
      opportunity_id: opportunityId,
      participants: association.participants,
      review_actions: reviewActionIds,
    },
  });

  return {
    contract: CONVERSATION_ASSOCIATION_CONTRACT,
    conversationId,
    contactId,
    companyId,
    opportunityId,
    participants,
    reviewActionIds,
  };
}
