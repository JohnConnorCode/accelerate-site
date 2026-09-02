import { DEMO_SCENARIOS, type DemoScenarioId, type DemoScenarioPack } from "./scenarios";
import { clearDemoAppearance } from "./appearance-state";
import {
  REVENUE_OS_MODULES,
  getActiveModules,
  validateModuleSettingsInput,
} from "@/lib/revenue-os/modules";

type DemoEmailBlock = {
  id: string;
  type: "heading" | "paragraph" | "button" | "divider" | "spacer";
  text?: string;
  url?: string;
  height?: number;
};
type DemoEmailDraft = { subjectTemplate: string; previewText: string; blocks: DemoEmailBlock[] };
type DemoGeneratedAiRun = {
  id: string;
  surface: string;
  provider: string;
  model: string;
  toolPack: string;
  conversationId: string;
  status: string;
  toolNames: string[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  promptPreview: string;
  resultPreview: string;
  error: null;
  startedAt: string;
  finishedAt: string;
  feedback: null;
};
type DemoEmailStudioDetail = {
  schemaReady: true;
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  variables: string[];
  hasDraft: boolean;
  source: "published" | "built_in" | "draft";
  updatedAt: string;
  subjectTemplate: string;
  bodyTemplate: string;
  blocks: DemoEmailBlock[];
  previewText: string;
  sampleData: Record<string, string>;
  html: string;
};
type DemoEmailStudioList = { schemaReady: true; emails: Array<Record<string, unknown>> };
type DemoState = {
  completedActions: string[];
  completedTasks: string[];
  stageOverrides: Record<string, string>;
  opportunityOverrides: Record<
    string,
    { nextAction?: string | null; nextActionAt?: string | null; estimatedValue?: number }
  >;
  clientOverrides: Record<string, Record<string, unknown>>;
  generatedAiRuns: DemoGeneratedAiRun[];
  sentReplies: Record<string, string[]>;
  readNotifications: string[];
  emailDrafts: Record<string, DemoEmailDraft>;
  featureOverrides: Record<string, { status: string; sort_order: number }>;
  moduleOverrides: Partial<Record<string, boolean>>;
  moduleSettings: Record<string, Record<string, unknown>>;
};
const initialState = (): DemoState => ({
  completedActions: [],
  completedTasks: [],
  stageOverrides: {},
  opportunityOverrides: {},
  clientOverrides: {},
  generatedAiRuns: [],
  sentReplies: {},
  readNotifications: [],
  emailDrafts: {},
  featureOverrides: {},
  moduleOverrides: {},
  moduleSettings: {},
});
const keyFor = (id: DemoScenarioId) => `accelerate:admin-demo:${id}:v3`;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const eventStreamResponse = (events: unknown[]) =>
  new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
const dateOffset = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function loadState(id: DemoScenarioId): DemoState {
  try {
    return { ...initialState(), ...JSON.parse(sessionStorage.getItem(keyFor(id)) || "{}") };
  } catch {
    return initialState();
  }
}
function saveState(id: DemoScenarioId, state: DemoState) {
  sessionStorage.setItem(keyFor(id), JSON.stringify(state));
}

function person(pack: DemoScenarioPack, id: string) {
  return pack.people.find((item) => item.id === id)!;
}
function opportunityRows(pack: DemoScenarioPack, state: DemoState) {
  return pack.opportunities.map((item, index) => {
    const contact = person(pack, item.personId);
    const stage = state.stageOverrides[item.id] || item.stage;
    const override = state.opportunityOverrides[item.id] || {};
    const estimatedValue = override.estimatedValue ?? item.value;
    return {
      id: item.id,
      name: item.name,
      email: contact.email,
      stage,
      canonical_stage: stage,
      estimated_value: estimatedValue,
      won_value: stage === "won" ? estimatedValue : 0,
      probability:
        {
          new: 10,
          contacted: 20,
          qualified: 40,
          meeting: 55,
          proposal: 70,
          negotiation: 85,
          won: 100,
          lost: 0,
          nurture: 10,
        }[stage] || 10,
      next_action: override.nextAction === undefined ? item.nextAction : override.nextAction,
      next_action_at:
        override.nextActionAt === undefined ? dateOffset(index % 7) : override.nextActionAt,
      source: item.source,
      owner_email: pack.tenant.founder.email,
      last_activity_at: new Date(Date.now() - index * 7_200_000).toISOString(),
      created_at: new Date(Date.now() - (index + 4) * 86_400_000).toISOString(),
      updated_at: ago(index + 1),
      contact: { full_name: contact.name, primary_email: contact.email },
      company: { name: item.company, domain: null, industry: pack.category },
    };
  });
}

function opportunityRecord(pack: DemoScenarioPack, state: DemoState, id: string) {
  const row = opportunityRows(pack, state).find((item) => item.id === id);
  const source = pack.opportunities.find((item) => item.id === id);
  if (!row || !source) return null;
  const contact = person(pack, source.personId);
  const relatedConversation = pack.conversations.find((item) => item.personId === contact.id);
  const relatedTasks = pack.tasks
    .filter((item) => item.personId === contact.id)
    .slice(0, 4)
    .map((item, index) => ({
      id: item.id,
      title: item.title,
      status: state.completedTasks.includes(item.id) ? "completed" : item.status,
      priority: item.priority,
      due_date: dateOffset(item.dueOffset),
      created_at: ago(48 + index),
    }));
  const relatedProposals = proposals(pack)
    .filter((item) => item.lead_id === contact.id)
    .map((item) => ({ ...item, subject: item.title }));
  const conversationRows = relatedConversation
    ? [
        {
          id: relatedConversation.id,
          subject: relatedConversation.subject,
          channel: "gmail",
          status: "open",
          created_at: relatedConversation.messages[0]?.at,
        },
      ]
    : [];
  return {
    contract: "revenue-os.opportunity-record.v1",
    activityContract: "revenue-os.activity.v1",
    opportunity: row,
    contact: {
      id: contact.id,
      full_name: contact.name,
      primary_email: contact.email,
      phone: contact.phone,
      title: contact.role,
      lifecycle_stage: row.canonical_stage,
      communication_status: "active",
    },
    company: {
      id: `company-${contact.id}`,
      name: source.company,
      domain: `${source.company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      website: `https://${source.company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      industry: pack.category,
      size_band: "small_business",
      location: "Fictional service area",
      research_summary: `Fictional ${pack.category.toLowerCase()} account with a recorded next action and linked operating history.`,
    },
    tasks: relatedTasks,
    conversations: conversationRows,
    meetings: [
      {
        id: `meeting-${id}`,
        title: `${source.company} review`,
        status: "confirmed",
        start_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      },
    ],
    proposals: relatedProposals,
    activity: [
      {
        id: `activity-${id}-1`,
        activity_type: "opportunity_updated",
        title: `Pipeline moved to ${row.canonical_stage.replace(/_/g, " ")}`,
        summary: `The current next action is ${row.next_action || "not yet set"}.`,
        source: "admin",
        actor_email: pack.tenant.founder.email,
        occurred_at: row.updated_at,
      },
      {
        id: `activity-${id}-2`,
        activity_type: "conversation_received",
        title: relatedConversation?.subject || "Relationship context recorded",
        summary:
          relatedConversation?.messages.at(-1)?.body ||
          `A fictional operating note for ${contact.name}.`,
        source: "gmail_sync",
        actor_email: null,
        occurred_at: relatedConversation?.messages.at(-1)?.at || ago(6),
      },
    ],
  };
}
function auditHistory(pack: DemoScenarioPack, params: URLSearchParams) {
  const founder = pack.tenant.founder.email;
  const system = pack.tenant.founder.systemActorEmail;
  const samples: Array<{
    action: string;
    entityType: string;
    source: string;
    actor: string;
    after: Record<string, string>;
  }> = [
    {
      action: "opportunity.updated",
      entityType: "opportunity",
      source: "admin",
      actor: founder,
      after: { stage: "proposal" },
    },
    {
      action: "email.sent",
      entityType: "conversation",
      source: "admin",
      actor: founder,
      after: { channel: "gmail" },
    },
    {
      action: "task.completed",
      entityType: "task",
      source: "admin",
      actor: founder,
      after: { status: "done" },
    },
    {
      action: "proposal.viewed",
      entityType: "proposal",
      source: "public",
      actor: "",
      after: { status: "viewed" },
    },
    {
      action: "feature.updated",
      entityType: "feature_request",
      source: "admin",
      actor: founder,
      after: { status: "in_progress" },
    },
    {
      action: "calendar.synced",
      entityType: "integration",
      source: "automation",
      actor: system,
      after: { stored: "12" },
    },
  ];
  const entries = pack.people.slice(0, 24).map((_, index) => {
    const sample = samples[index % samples.length]!;
    const opportunity = pack.opportunities[index % pack.opportunities.length]!;
    return {
      id: `audit-${pack.id}-${index}`,
      actorEmail: sample.actor || null,
      action: sample.action,
      entityType: sample.entityType,
      entityId:
        sample.entityType === "opportunity" ? opportunity.id : `${sample.entityType}-${index}`,
      source: sample.source,
      before:
        sample.action === "proposal.viewed"
          ? { status: "sent" }
          : sample.action === "opportunity.updated"
            ? { stage: "qualified" }
            : sample.action === "task.completed"
              ? { status: "open" }
              : null,
      after: { ...sample.after },
      metadata: {},
      createdAt: ago(index * 3 + 1),
    };
  });
  const filtered = entries.filter((entry) => {
    if (params.get("actor") && entry.actorEmail !== params.get("actor")) return false;
    if (params.get("entity") && entry.entityType !== params.get("entity")) return false;
    if (params.get("action") && entry.action !== params.get("action")) return false;
    if (params.get("source") && entry.source !== params.get("source")) return false;
    const created = entry.createdAt.slice(0, 10);
    if (params.get("from") && created < params.get("from")!) return false;
    if (params.get("to") && created > params.get("to")!) return false;
    return true;
  });
  return {
    entries: filtered,
    filterOptions: {
      actors: [
        ...new Set(
          entries
            .map((entry) => entry.actorEmail)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      entityTypes: [...new Set(entries.map((entry) => entry.entityType))],
      actions: [...new Set(entries.map((entry) => entry.action))],
      sources: [...new Set(entries.map((entry) => entry.source))],
    },
  };
}

function queue(pack: DemoScenarioPack, state: DemoState) {
  const approvals = pack.actions
    .slice(0, 2)
    .filter((item) => !state.completedActions.includes(item.id))
    .map((item, index) => ({
      id: `action:${item.id}`,
      kind: "approval",
      title: item.title,
      summary: item.description,
      urgency: index === 0 ? "high" : "normal",
      dueAt: dateOffset(0),
      sourceTimestamp: ago(index + 1),
      priorityReason: "A consequential simulated change is staged for operator review.",
      recommendedNextAction: "Review the exact simulated change",
      href: `/admin/today?focus=approval&action=${item.id}`,
    }));
  const replies = pack.conversations.slice(0, 2).map((item, index) => {
    const contact = person(pack, item.personId);
    return {
      id: `reply:${item.id}`,
      kind: "reply",
      title: `Reply to ${contact.name}`,
      summary: item.messages.at(-1)!.body,
      urgency: index === 0 ? "high" : "normal",
      dueAt: dateOffset(0),
      sourceTimestamp: item.messages.at(-1)!.at,
      priorityReason: "An unread customer message is waiting for a response.",
      recommendedNextAction: "Open the conversation and reply",
      href: "/admin/conversations",
    };
  });
  const proposalOpportunities = [
    ...pack.opportunities.filter((item) =>
      ["proposal", "negotiation"].includes(state.stageOverrides[item.id] || item.stage),
    ),
    ...pack.opportunities,
  ]
    .filter(
      (item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .slice(0, 2);
  const proposals = proposalOpportunities.map((item, index) => ({
    id: `proposal:${item.id}`,
    kind: "proposal",
    title: item.nextAction,
    summary: `${item.company} has an active scope worth $${item.value.toLocaleString()}.`,
    urgency: index === 0 ? "high" : "normal",
    dueAt: dateOffset(index),
    sourceTimestamp: ago(index + 3),
    priorityReason: "An open commercial decision has a recorded next step.",
    recommendedNextAction: "Review the proposal and advance the decision",
    href: "/admin/proposals",
  }));
  const commitments = pack.tasks
    .slice(0, 6)
    .filter((item) => item.status === "pending" && !state.completedTasks.includes(item.id))
    .map((item, index) => ({
      id: `task:${item.id}`,
      kind: index % 2 === 0 ? "task" : "follow_up",
      title: item.title,
      summary: "Linked to the latest conversation and opportunity context.",
      urgency: item.priority === "high" ? "high" : "normal",
      dueAt: dateOffset(item.dueOffset),
      sourceTimestamp: ago(index + 2),
      priorityReason:
        item.dueOffset < 0 ? "The commitment is overdue." : "The next action is due soon.",
      recommendedNextAction: "Complete or snooze this task",
      href: "/admin/today",
    }));
  return [...approvals, ...replies, ...proposals, ...commitments];
}
function priority(pack: DemoScenarioPack, state: DemoState) {
  const items = queue(pack, state);
  return {
    status: "ready",
    summary: {
      total: items.length,
      urgent: items.filter((item) => item.urgency === "high").length,
      critical: 0,
    },
    items,
  };
}
function notifications(pack: DemoScenarioPack, state: DemoState) {
  const rows = [
    {
      id: "demo-notice-1",
      type: "new_lead",
      title: `New ${pack.tenant.pipeline.stageLabels.new || "inquiry"}`,
      description: `${pack.people[0]!.name} replied with a clear next step.`,
      link: "/admin/pipeline",
      priority: "urgent",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-notice-2",
      type: "proposal_viewed",
      title: "Proposal viewed",
      description: `${pack.people[1]!.company} opened the latest scope.`,
      link: "/admin/proposals",
      priority: "important",
      created_at: new Date(Date.now() - 4_500_000).toISOString(),
    },
    {
      id: "demo-notice-3",
      type: "task_overdue",
      title: "Commitment needs attention",
      description: pack.tasks[0]!.title,
      link: "/admin/today",
      priority: "important",
      created_at: new Date(Date.now() - 9_000_000).toISOString(),
    },
  ].map((item) => ({ ...item, read: state.readNotifications.includes(item.id) }));
  return {
    notifications: rows,
    unreadCount: rows.filter((item) => !item.read).length,
    urgentCount: rows.filter((item) => !item.read && item.priority === "urgent").length,
    priority: priority(pack, state),
  };
}
function conversations(pack: DemoScenarioPack, state: DemoState, selected: string | null) {
  const rows = pack.conversations.map((item) => {
    const contact = person(pack, item.personId);
    return {
      id: item.id,
      channel: "gmail",
      external_id: `demo-${item.id}`,
      subject: item.subject,
      status: "open",
      intent: item.intent,
      unread_count: item.unread,
      last_message_at: item.messages.at(-1)!.at,
      metadata: { contact_email: contact.email },
    };
  });
  // Mirrors the stats loop in src/lib/revenue-os/conversations.ts so the demo
  // tab counts (Open/Waiting/Resolved/Archived/Unread) aren't stuck at zero
  // while the list beside them is visibly full.
  const stats = {
    total: rows.length,
    open: rows.filter((row) => row.status === "open").length,
    waiting: rows.filter((row) => row.status === "waiting").length,
    resolved: rows.filter((row) => row.status === "resolved").length,
    archived: rows.filter((row) => row.status === "archived").length,
    unread: rows.filter((row) => row.unread_count > 0).length,
  };
  const active = selected
    ? pack.conversations.find((item) => item.id === selected)
    : pack.conversations[0];
  if (!active) return { schemaReady: true, conversations: rows, stats, messages: [] };
  const contact = person(pack, active.personId);
  const messages = [
    ...active.messages,
    ...(state.sentReplies[active.id] || []).map((body, index) => ({
      id: `local-${index}`,
      direction: "outbound" as const,
      body,
      at: new Date().toISOString(),
    })),
  ].map((item) => ({
    id: item.id,
    direction: item.direction,
    sender_email: item.direction === "inbound" ? contact.email : pack.tenant.founder.email,
    recipient_emails: [item.direction === "inbound" ? pack.tenant.founder.email : contact.email],
    subject: active.subject,
    body_text: item.body,
    status: "delivered",
    sent_at: item.direction === "outbound" ? item.at : null,
    received_at: item.direction === "inbound" ? item.at : null,
    created_at: item.at,
  }));
  return { schemaReady: true, conversations: rows, stats, messages };
}
function analytics(pack: DemoScenarioPack, state: DemoState) {
  const rows = opportunityRows(pack, state);
  const open = rows.filter((item) => !["won", "lost"].includes(item.canonical_stage));
  const won = rows.filter((item) => item.canonical_stage === "won");
  const pipelineValue = open.reduce((sum, item) => sum + item.estimated_value, 0);
  const wonRevenue = won.reduce((sum, item) => sum + item.won_value, 0);
  return {
    schemaReady: true,
    windowDays: 30,
    cohort: "Fictional opportunities created in the selected window.",
    funnel: {
      opportunities: rows.length,
      qualified: rows.filter((item) => !["new", "contacted"].includes(item.canonical_stage)).length,
      meetings: rows.filter((item) =>
        ["meeting", "proposal", "negotiation", "won"].includes(item.canonical_stage),
      ).length,
      proposals: rows.filter((item) =>
        ["proposal", "negotiation", "won"].includes(item.canonical_stage),
      ).length,
      won: won.length,
      wonRevenue,
      pipelineValue,
    },
    rates: {
      qualified: 72,
      meeting: 69,
      proposal: 64,
      win: 40,
      inquiryToWin: Math.round((won.length / rows.length) * 100),
    },
    attribution: { missing: 0 },
    forecast: {
      weightedPipeline: Math.round(pipelineValue * 0.54),
      unweightedPipeline: pipelineValue,
      method: "Recorded stage probability applied to open fictional opportunities.",
    },
    communication: {
      status: "ready",
      inboundConversations: 10,
      repliedConversations: 10,
      replyRate: 100,
      medianResponseHours: 2.4,
    },
    quality: {
      missingAttribution: 0,
      missingOwner: 0,
      missingNextAction: 0,
      unrecognizedStage: 0,
      impossibleStageSequences: 0,
    },
    filterOptions: {
      sources: ["Website inquiry", "Referral", "Email", "Community partner"],
      owners: [pack.tenant.founder.email],
      campaigns: ["Seasonal follow-up", "Referral thank-you"],
      stages: [
        "new",
        "contacted",
        "qualified",
        "meeting",
        "proposal",
        "negotiation",
        "won",
        "lost",
        "nurture",
      ],
    },
    appliedFilters: { source: null, owner: null, campaign: null, stage: null },
    sources: ["Website inquiry", "Referral", "Email", "Community partner"].map((source, index) => ({
      source,
      opportunities: rows.filter((item) => item.source === source).length,
      won: index === 1 ? won.length : 0,
      revenue: index === 1 ? wonRevenue : 0,
    })),
    web: {
      status: "ready",
      pageViews: 1840,
      visitors: 1126,
      conversions: 74,
      engagementEvents: 462,
      conversionRate: 6.6,
      topPages: [
        { label: "/", count: 620 },
        { label: "/services", count: 384 },
        { label: "/book", count: 211 },
      ],
      sources: [
        { label: "Google", count: 540 },
        { label: "Direct", count: 312 },
        { label: "Referral", count: 188 },
      ],
      conversionEvents: [
        { label: "Form submitted", count: 31 },
        { label: "Booking started", count: 24 },
        { label: "Email clicked", count: 19 },
      ],
      eventCount: 2302,
      lastCapturedAt: new Date().toISOString(),
    },
  };
}

function inbox(pack: DemoScenarioPack) {
  const kinds = ["lead", "contact", "chat", "task", "proposal", "partner"] as const;
  const items = kinds.flatMap((kind, kindIndex) =>
    Array.from({ length: kind === "task" ? 3 : 2 }, (_, index) => {
      const contact = pack.people[kindIndex * 3 + index]!;
      return {
        id: kind === "task" ? pack.tasks[index]!.id : `inbox-${kind}-${index}`,
        kind,
        title: kind === "task" ? pack.tasks[index]!.title : `${contact.name} · ${contact.company}`,
        summary:
          pack.conversations[(kindIndex + index) % pack.conversations.length]!.messages[0]!.body,
        priority: kindIndex === 0 && index === 0 ? "urgent" : index === 0 ? "important" : "normal",
        createdAt: ago(kindIndex * 3 + index + 1),
        dueAt: kind === "task" ? dateOffset(index - 1) : null,
        href:
          kind === "proposal"
            ? "/admin/proposals"
            : kind === "task"
              ? "/admin/today"
              : "/admin/conversations",
        person: { name: contact.name, email: contact.email, phone: contact.phone },
        meta:
          kind === "proposal"
            ? `$${pack.opportunities[kindIndex]!.value.toLocaleString()} scope`
            : pack.category,
      };
    }),
  );
  const counts = {
    all: items.length,
    lead: 0,
    contact: 0,
    chat: 0,
    task: 0,
    proposal: 0,
    partner: 0,
  };
  for (const item of items) counts[item.kind] += 1;
  return { items, counts, updatedAt: new Date().toISOString() };
}

const escapeEmailHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
const interpolateDemoEmail = (value: string, data: Record<string, string>) =>
  value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => data[key] || `{{${key}}}`);
function demoEmailHtml(
  blocks: DemoEmailBlock[],
  data: Record<string, string>,
  brand: DemoScenarioPack["tenant"]["brand"],
) {
  const initials =
    brand.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || brand.logoMark;
  const body = blocks
    .map((block) => {
      if (block.type === "heading")
        return `<h1 style="margin:0 0 20px;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;letter-spacing:-0.6px;line-height:1.18">${escapeEmailHtml(interpolateDemoEmail(block.text || "", data))}</h1>`;
      if (block.type === "paragraph")
        return `<p style="margin:0 0 17px;color:#566176;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65">${escapeEmailHtml(interpolateDemoEmail(block.text || "", data)).replace(/\n/g, "<br>")}</p>`;
      if (block.type === "button")
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 30px"><tr><td style="border-radius:9px;background:${brand.accentColor}"><a href="${escapeEmailHtml(interpolateDemoEmail(block.url || `${brand.siteUrl}/contact`, data))}" style="display:inline-block;border-radius:9px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.1px;padding:14px 20px;text-decoration:none">${escapeEmailHtml(interpolateDemoEmail(block.text || "Book a call", data))}<span style="padding-left:10px">→</span></a></td></tr></table>`;
      if (block.type === "divider")
        return `<div style="border-top:1px solid #e6eaf0;margin:28px 0"></div>`;
      return `<div style="height:${Math.max(8, Math.min(96, Number(block.height) || 24))}px"></div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@media only screen and (max-width:620px){.email-shell{padding:18px 10px!important}.email-card{border-radius:14px!important}.email-content{padding:30px 24px!important}.email-brand{padding:22px 24px!important}}</style></head><body style="margin:0;background:#eef2f7;padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7"><tr><td class="email-shell" style="padding:36px 16px"><table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;margin:0 auto;border-collapse:separate;border-radius:18px;background:#ffffff;box-shadow:0 14px 42px rgba(21,32,51,.12);overflow:hidden"><tr><td class="email-brand" style="background:#172033;padding:25px 34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle"><span style="display:inline-block;border-radius:8px;background:${brand.accentColor};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:.7px;line-height:32px;text-align:center;width:32px">${escapeEmailHtml(initials)}</span><span style="padding-left:11px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;vertical-align:middle">${escapeEmailHtml(brand.name)}</span></td><td align="right" style="color:#b9c4d5;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Service update</td></tr></table></td></tr><tr><td class="email-content" style="padding:40px 34px 32px">${body}</td></tr><tr><td style="border-top:1px solid #e6eaf0;padding:21px 34px 25px"><p style="margin:0 0 7px;color:#3e4a5e;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700">${escapeEmailHtml(brand.name)}</p><p style="margin:0;color:#7b8798;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6">${escapeEmailHtml(brand.domain)} · You received this operational update because you are in conversation with ${escapeEmailHtml(brand.name)}.</p></td></tr></table></td></tr></table></body></html>`;
}

function defaultEmailBlocks(templateId: string, pack: DemoScenarioPack): DemoEmailBlock[] {
  const owner = pack.tenant.founder.fullName;
  const contact = `${pack.tenant.brand.siteUrl}/contact`;
  if (templateId === "appointment-confirmation")
    return [
      { id: "title", type: "heading", text: "Your time is confirmed" },
      {
        id: "intro",
        type: "paragraph",
        text: "Hi {{first_name}},\n\nYour conversation with {{owner_name}} is set for {{appointment_time}}. We will use the time to understand the context, answer the practical questions, and agree on the next useful step.",
      },
      { id: "cta", type: "button", text: "Review appointment details", url: contact },
      {
        id: "signoff",
        type: "paragraph",
        text: `If anything changes before then, reply here and ${owner} will help.`,
      },
    ];
  if (templateId === "proposal-follow-up")
    return [
      { id: "title", type: "heading", text: "A quick follow-up on your scope" },
      {
        id: "intro",
        type: "paragraph",
        text: "Hi {{first_name}},\n\nI wanted to make sure the {{proposal_name}} is clear enough to evaluate. The scope is built around the decisions and constraints we discussed, not a generic package.",
      },
      { id: "cta", type: "button", text: "Review the scope", url: contact },
      {
        id: "signoff",
        type: "paragraph",
        text: `If a short review would be helpful, ${owner} can walk through the tradeoffs with you.`,
      },
    ];
  if (templateId === "welcome")
    return [
      { id: "title", type: "heading", text: "Welcome. Here is what happens next." },
      {
        id: "intro",
        type: "paragraph",
        text: "Hi {{first_name}},\n\nWe are glad to be working together. Your first milestone begins {{start_date}}, with a clear owner, a practical plan, and a direct line for questions.",
      },
      { id: "cta", type: "button", text: "See your next step", url: contact },
      {
        id: "signoff",
        type: "paragraph",
        text: `Reply to this email at any point. ${owner} and the team will keep the work moving.`,
      },
    ];
  return [
    { id: "title", type: "heading", text: "A clear next step" },
    {
      id: "intro",
      type: "paragraph",
      text: "Hi {{first_name}},\n\nThanks for getting in touch about {{company_name}}. I reviewed your note and pulled together the most useful next move.",
    },
    { id: "detail", type: "paragraph", text: "{{next_step}}" },
    { id: "cta", type: "button", text: "Choose a time", url: contact },
    {
      id: "signoff",
      type: "paragraph",
      text: `If you would rather reply here, ${owner} will take it from there.`,
    },
  ];
}
function emailStudio(pack: DemoScenarioPack, id: string, state: DemoState): DemoEmailStudioDetail;
function emailStudio(
  pack: DemoScenarioPack,
  id?: string | null,
  state?: DemoState,
): DemoEmailStudioList | DemoEmailStudioDetail;
function emailStudio(
  pack: DemoScenarioPack,
  id?: string | null,
  state: DemoState = initialState(),
): DemoEmailStudioList | DemoEmailStudioDetail {
  const templates = [
    {
      id: "inquiry-reply",
      name: "New inquiry response",
      description: "A prompt, personal first response with one clear next step.",
      category: "Revenue",
      subject: `Next steps with ${pack.name}`,
      variables: ["first_name", "company_name", "next_step"],
      hasDraft: false,
      source: "published" as const,
      updatedAt: ago(26),
    },
    {
      id: "appointment-confirmation",
      name: "Appointment confirmation",
      description: "Confirms the time, owner, and what the customer should expect.",
      category: "Operations",
      subject: "Your appointment is confirmed",
      variables: ["first_name", "appointment_time", "owner_name"],
      hasDraft: true,
      source: "published" as const,
      updatedAt: ago(8),
    },
    {
      id: "proposal-follow-up",
      name: "Proposal follow-up",
      description: "Moves an open decision forward without generic pressure.",
      category: "Revenue",
      subject: "A quick follow-up on your scope",
      variables: ["first_name", "proposal_name", "owner_name"],
      hasDraft: false,
      source: "built_in" as const,
      updatedAt: ago(54),
    },
    {
      id: "welcome",
      name: "Customer welcome",
      description: "Sets expectations immediately after a win or enrollment.",
      category: "Customer",
      subject: `Welcome to ${pack.name}`,
      variables: ["first_name", "start_date", "owner_name"],
      hasDraft: false,
      source: "published" as const,
      updatedAt: ago(74),
    },
  ].map((template) => ({
    ...template,
    hasDraft: template.hasDraft || Boolean(state.emailDrafts[template.id]),
  }));
  if (!id) return { schemaReady: true, emails: templates };
  const template = templates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown demo email template: ${id}`);
  const defaultBlocks = defaultEmailBlocks(template.id, pack);
  const draft = state.emailDrafts[template.id];
  const blocks = draft?.blocks || defaultBlocks;
  const sampleData = {
    first_name: pack.people[0]!.name.split(" ")[0]!,
    company_name: pack.people[0]!.company,
    next_step: "a short operating review",
    appointment_time: "Thursday at 10:00 AM",
    owner_name: pack.tenant.founder.fullName,
    proposal_name: "your scope",
    start_date: "next week",
  };
  const subjectTemplate = draft?.subjectTemplate || template.subject;
  const previewText = draft?.previewText || `A clear next step from ${pack.name}.`;
  return {
    schemaReady: true,
    ...template,
    subjectTemplate,
    bodyTemplate: blocks.map((block) => block.text || "").join("\n\n"),
    blocks,
    previewText,
    sampleData,
    subject: interpolateDemoEmail(subjectTemplate, sampleData),
    html: demoEmailHtml(blocks, sampleData, pack.tenant.brand),
    source: draft || template.hasDraft ? ("draft" as const) : template.source,
  } satisfies DemoEmailStudioDetail;
}

function campaigns(pack: DemoScenarioPack) {
  return pack.content.campaignNames.map((name, index) => ({
    id: `campaign-${index + 1}`,
    name,
    status: index === 0 ? "active" : index === 1 ? "paused" : "review",
    version: 2,
    approved_version: index < 2 ? 2 : null,
    approved_at: index < 2 ? ago(48 + index * 12) : null,
    sender_email: pack.tenant.founder.email,
    policy: {
      daily_limit: 25,
      stop_on_reply: true,
      stop_on_booking: true,
      stop_on_bounce: true,
      stop_on_unsubscribe: true,
    },
    campaign_steps: [0, 1, 2].map((step) => ({
      id: `campaign-${index + 1}-step-${step}`,
      step_order: step + 1,
      delay_days: step * 3,
      subject_template: ["A useful next step", "Any questions I can answer?", "Closing the loop"][
        step
      ]!,
    })),
    campaign_members: pack.people.slice(index * 5, index * 5 + 8).map((contact, memberIndex) => ({
      id: `member-${index}-${memberIndex}`,
      status: memberIndex < 5 ? "active" : "completed",
      current_step: Math.min(3, memberIndex % 4),
      next_send_at:
        memberIndex < 5
          ? new Date(Date.now() + (memberIndex + 1) * 86_400_000).toISOString()
          : null,
      stop_reason: memberIndex >= 5 ? "replied" : null,
      send_attempts: memberIndex % 3,
    })),
    created_at: ago(240 + index * 60),
  }));
}

function bookings(pack: DemoScenarioPack) {
  const opportunities = opportunityRows(pack, initialState())
    .slice(0, 12)
    .map((item, index) => ({
      id: item.id,
      email: item.email,
      company_website: `https://${item.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      role: person(pack, pack.opportunities[index]!.personId)
        .role.toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
      revenue_band: ["under_500k", "500k_to_2m", "2m_to_10m"][index % 3]!,
      primary_leak: ["slow_follow_up", "manual_scheduling", "unclear_attribution"][index % 3]!,
      qualified: index !== 10,
      stage: ["qualified", "booked", "showed", "proposal", "won", "no_show"][index % 6]!,
      scheduled_at:
        index % 4 === 0 ? null : new Date(Date.now() + (index - 2) * 86_400_000).toISOString(),
      utm_source: ["google", "referral", "email"][index % 3]!,
      utm_campaign: "demo-growth-loop",
      estimated_value: item.estimated_value,
      won_value: index % 6 === 4 ? item.estimated_value : 0,
      created_at: item.created_at,
    }));
  const count = (stage: string) => opportunities.filter((item) => item.stage === stage).length;
  return {
    opportunities,
    metrics: {
      total: opportunities.length,
      qualified: opportunities.filter((item) => item.qualified).length,
      booked: count("booked"),
      showed: count("showed"),
      noShow: count("no_show"),
      won: count("won"),
      pipelineValue: opportunities.reduce((sum, item) => sum + item.estimated_value, 0),
      wonRevenue: opportunities.reduce((sum, item) => sum + item.won_value, 0),
      qualifiedToBooked: 67,
      bookedToShowed: 83,
    },
  };
}

function aiRuns(pack: DemoScenarioPack, state: DemoState = initialState()) {
  const runs = [
    ...state.generatedAiRuns,
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `ai-run-${index}`,
      surface: ["command_center", "conversation_brief", "pipeline_review"][index % 3]!,
      provider: "openrouter",
      model: "bounded-demo-model",
      toolPack: index % 2 ? "pipeline" : "core",
      conversationId: `ai-${pack.id}`,
      status: index === 6 ? "failed" : "completed",
      toolNames: index % 2 ? ["search_pipeline", "get_record_timeline"] : ["get_today_snapshot"],
      inputTokens: 680 + index * 91,
      outputTokens: 210 + index * 37,
      durationMs: 1200 + index * 180,
      promptPreview: `Review the next best action for ${pack.people[index]!.company}.`,
      resultPreview: `Reviewed the relevant fictional records and prepared a grounded next step for ${pack.people[index]!.name}.`,
      error: index === 6 ? "Simulated provider timeout; no external action occurred." : null,
      startedAt: ago(index * 8 + 1),
      finishedAt: ago(index * 8 + 0.9),
      feedback: index % 4 === 0 ? "helpful" : null,
    })),
  ];
  const completed = runs.filter((run) => run.status === "completed").length;
  return {
    schemaReady: true,
    degraded: false,
    degradationReasons: [],
    runs,
    metrics: {
      runs: runs.length,
      completed,
      partial: 0,
      failed: runs.length - completed,
      cancelled: 0,
      successRate: Math.round((completed / runs.length) * 100),
      totalTokens: runs.reduce((sum, run) => sum + run.inputTokens + run.outputTokens, 0),
      medianDurationMs: 1830,
      feedbackCoverage: 25,
    },
    facets: {
      surfaces: [...new Set(runs.map((run) => run.surface))],
      models: ["bounded-demo-model"],
      packs: ["core", "pipeline"],
      tools: [...new Set(runs.flatMap((run) => run.toolNames))],
    },
    nextCursor: null,
    summaryTruncated: false,
    generatedAt: new Date().toISOString(),
  };
}

function aiRunDetail(pack: DemoScenarioPack, state: DemoState, runId: string) {
  const run = aiRuns(pack, state).runs.find((item) => item.id === runId);
  if (!run)
    return {
      schemaReady: true,
      degraded: false,
      degradationReasons: [],
      run: null,
      events: [],
      eventsTruncated: false,
      affectedRecords: [],
    };
  const parsedIndex = Number(run.id.split("-").at(-1));
  const opportunity =
    pack.opportunities[
      (Number.isFinite(parsedIndex) ? parsedIndex : 0) % pack.opportunities.length
    ]!;
  return {
    schemaReady: true,
    degraded: false,
    degradationReasons: [],
    run,
    events: [
      {
        id: `${run.id}-context`,
        type: "context_loaded",
        label: "Business context",
        summary: "Loaded a bounded fictional priority and pipeline snapshot.",
        toolName: null,
        status: "recorded",
        createdAt: run.startedAt,
      },
      {
        id: `${run.id}-tool`,
        type: run.status === "failed" ? "tool_error" : "tool_result",
        label: run.toolNames[0]!.replace(/_/g, " "),
        summary:
          run.status === "failed"
            ? "The simulated provider timed out without changing data."
            : "Completed with bounded fictional evidence.",
        toolName: run.toolNames[0],
        status: run.status === "failed" ? "failed" : "completed",
        createdAt: run.finishedAt || run.startedAt,
      },
      {
        id: `${run.id}-response`,
        type: "model_response",
        label: "Model response",
        summary: "Recorded a bounded answer and its operating metadata.",
        toolName: null,
        status: "recorded",
        createdAt: run.finishedAt || run.startedAt,
      },
    ],
    eventsTruncated: false,
    affectedRecords: [
      { type: "opportunity", id: opportunity.id, href: `/admin/pipeline/${opportunity.id}` },
    ],
  };
}

/** Mirrors the `label()` helper in
 *  src/app/api/admin/revenue-os/ai/capabilities/route.ts so a demo card reads
 *  identically to the real one. Keep both in sync if either changes. */
function capabilityLabel(name: string): string {
  return name
    .replace(/^get_/, "Read ")
    .replace(/^search_/, "Search ")
    .replace(/^propose_/, "Stage ")
    .replace(/_/g, " ");
}

/** Kept in sync by hand with the real registry in
 *  src/lib/revenue-os/ai-tools.ts (AI_TOOL_REGISTRY_VERSION,
 *  registry, PACK_TOOL_NAMES) since the demo has no server context to read
 *  it from live. Every real tool is available in the fictional workspace. */
function aiCapabilities() {
  const rows: Array<
    [
      name: string,
      description: string,
      impact: "read" | "internal_write" | "external_action",
      confirmationRequired: boolean,
      packs: string[],
      serviceTarget: string,
    ]
  > = [
    [
      "get_today_snapshot",
      "Read the founder's prioritized operator queue and a summary of current revenue state. Returns counts and the top items, not the full database.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.operator-queue",
    ],
    [
      "search_pipeline",
      "Search live opportunities by company or email. Never invent a record or metric.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.pipeline-search",
    ],
    [
      "get_record_timeline",
      "Read the bounded canonical activity timeline for one contact, company, or opportunity. Every item includes its source receipt and occurrence time.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.activity-ledger",
    ],
    [
      "search_knowledge_base",
      "Query grounded knowledge with provenance across companies, contacts, opportunities, founder notes, and activity timeline. Returns tagged chunks with confidence and recency or refuses cleanly.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.knowledge-retrieval",
    ],
    [
      "search_contacts",
      "Search contacts and associated company details by name, email, or phone.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.contact-search",
    ],
    [
      "search_conversations",
      "Search omnichannel conversations and inbound messages by status or unread state.",
      "read",
      false,
      ["outreach"],
      "revenue-os.conversations-search",
    ],
    [
      "get_pending_actions",
      "List pending proposals currently in the action_queue awaiting founder review.",
      "read",
      false,
      ["core", "pipeline", "outreach"],
      "revenue-os.action-queue-read",
    ],
    [
      "propose_task",
      "Stage a concrete operator task for approval.",
      "internal_write",
      true,
      ["core", "pipeline", "outreach"],
      "revenue-os.action-queue",
    ],
    [
      "propose_task_update",
      "Stage a change to an existing task for approval: mark it complete, snooze it to a later date, or edit its title, priority, or due date. Never changes the task directly; the founder approves it from the review queue like every other proposal.",
      "internal_write",
      true,
      ["core", "pipeline", "outreach"],
      "revenue-os.action-queue",
    ],
    [
      "propose_founder_note",
      "Stage a founder note for approval. Once approved it is saved as an immutable timeline entry, optionally attached to a contact, company, or opportunity.",
      "internal_write",
      true,
      ["core"],
      "revenue-os.action-queue",
    ],
    [
      "propose_layout_change",
      "Stage a reorder or show/hide change to a bounded admin layout region (sidebar navigation or the Today page) for founder approval. Only known ids for the given scope may be referenced; required regions can never be hidden.",
      "internal_write",
      true,
      ["core"],
      "revenue-os.action-queue",
    ],
    [
      "propose_stage_change",
      "Stage a pipeline movement for founder approval. Evidence must be included.",
      "internal_write",
      true,
      ["pipeline"],
      "revenue-os.action-queue",
    ],
    [
      "propose_send_email",
      "Stage an outbound email for founder approval. This never sends directly.",
      "external_action",
      true,
      ["outreach"],
      "revenue-os.action-queue",
    ],
    [
      "propose_conversation_reply",
      "Stage a reply to an active conversation thread for founder approval. This never sends directly.",
      "external_action",
      true,
      ["outreach"],
      "revenue-os.action-queue",
    ],
    [
      "propose_campaign_activation",
      "Stage activation of a reviewed campaign version for founder approval.",
      "external_action",
      true,
      ["outreach"],
      "revenue-os.action-queue",
    ],
  ];
  const capabilities = rows.map(
    ([name, description, impact, confirmationRequired, packs, serviceTarget]) => ({
      name,
      label: capabilityLabel(name),
      description,
      impact,
      confirmationRequired,
      packs,
      serviceTarget,
      connectionRequirement: "none" as const,
      state: "available" as const,
      operationalReadiness: "ready" as const,
      availabilityReason:
        "Available through the bounded Revenue OS service; no provider connection is called directly.",
    }),
  );
  return {
    registryVersion: "revenue-os-tools.v4",
    scope: "runtime_registry",
    readinessEvaluated: true,
    capabilities,
    safety: {
      registeredReads: capabilities.filter((c) => c.impact === "read").length,
      registeredInternalWrites: capabilities.filter((c) => c.impact === "internal_write").length,
      registeredExternalActions: capabilities.filter((c) => c.impact === "external_action").length,
      registeredDestructiveActions: 0,
      readsMayExecuteDirectly: capabilities.some(
        (c) => c.impact === "read" && !c.confirmationRequired,
      ),
      writesRequireApproval: capabilities
        .filter((c) => c.impact === "internal_write")
        .every((c) => c.confirmationRequired),
      externalActionsRequireApproval: capabilities
        .filter((c) => c.impact === "external_action")
        .every((c) => c.confirmationRequired),
      destructiveActionsAvailable: false,
    },
  };
}

function integrationCatalog(pack: DemoScenarioPack) {
  const providers = [
    [
      "supabase",
      "Supabase",
      "System of record",
      "Canonical records, authentication, receipts, and realtime state.",
      "ready",
    ],
    [
      "google",
      "Google Workspace",
      "Primary operating context",
      "Gmail, Calendar, and selected Drive knowledge.",
      "ready",
    ],
    [
      "resend",
      "Resend",
      "Auditable delivery",
      "Transactional and campaign email with delivery receipts.",
      "ready",
    ],
    [
      "openrouter",
      "OpenRouter",
      "Model gateway",
      "Bounded analysis, drafting, and registered tools.",
      "ready",
    ],
    [
      "stripe",
      "Stripe",
      "Payment truth",
      "Payments and invoices linked to revenue context.",
      "available",
    ],
    [
      "slack",
      "Slack",
      "Approval surface",
      "Briefs and alerts that link back to canonical work.",
      "planned",
    ],
  ].map(([id, name, strategicRole, description, status], index) => ({
    id,
    name,
    category: index < 4 ? "foundation" : "revenue",
    maturity: index < 4 ? "native" : "next",
    priority: index + 1,
    description,
    strategicRole,
    cost: {
      tier: "free",
      label: index === 3 ? "Usage based" : "Free-first",
      detail: "The demo models a measured free-first operating posture.",
    },
    auth: "Scoped credentials with least privilege",
    transports: ["api"],
    dataClasses: ["Bounded operating data"],
    setupHref: "/admin/setup",
    docsHref: "/admin/setup",
    limits: ["Receipts are required", "External actions remain approval-gated"],
    guardrail: "The integration cannot bypass domain services or human confirmation.",
    status,
    statusReason:
      status === "ready"
        ? "Behavior verified in this fictional workspace"
        : status === "available"
          ? "Available to configure"
          : "Planned by client demand",
    accountLabel: status === "ready" ? pack.tenant.founder.email : null,
    lastEvidenceAt: status === "ready" ? ago(index + 1) : null,
    capabilities: [
      {
        id: `${id}-core`,
        label: `${name} core`,
        description,
        direction: "bidirectional",
        impact: "internal_write",
        status,
        statusReason:
          status === "ready"
            ? "Behavior verified"
            : status === "available"
              ? "Available to configure"
              : "Planned",
        lastEvidenceAt: status === "ready" ? ago(index + 1) : null,
      },
    ],
  }));
  return {
    registryVersion: "demo-integrations.v1",
    generatedAt: new Date().toISOString(),
    evidenceAvailable: true,
    summary: {
      ready: 4,
      degraded: 0,
      action: 0,
      available: 1,
      planned: 1,
      total: 6,
      live: 4,
      attention: 0,
    },
    providers,
  };
}

function setup(pack: DemoScenarioPack) {
  const checks = [
    [
      "supabase",
      "core",
      "Canonical database",
      "Stores operating records and receipts.",
      "ready",
      true,
    ],
    [
      "email",
      "email",
      "Email delivery",
      "Sends approved transactional and campaign email.",
      "ready",
      true,
    ],
    [
      "google",
      "google",
      "Google Workspace",
      "Links Gmail, Calendar, and selected Drive knowledge.",
      "ready",
      true,
    ],
    [
      "openrouter",
      "ai",
      "Governed AI",
      "Runs bounded intelligence with tool and usage receipts.",
      "ready",
      true,
    ],
    [
      "campaigns",
      "campaigns",
      "Campaign safety",
      "Previews exclusions and stops automatically on replies.",
      "ready",
      true,
    ],
    [
      "payments",
      "operations",
      "Payment connection",
      "Adds verified payment truth when the business is ready.",
      "optional",
      false,
    ],
  ].map(([id, group, label, accomplishes, status, required]) => ({
    id,
    group,
    label,
    description: accomplishes,
    accomplishes,
    status,
    required,
    lastSuccessAt: status === "ready" ? ago(2) : null,
    lastFailure: null,
    action: {
      label: status === "ready" ? "Review evidence" : "Plan connection",
      href: "/admin/integrations",
    },
  }));
  return {
    checks,
    bookingMode: "manual",
    google: {
      accountEmail: pack.tenant.founder.email,
      connected: true,
      settings: { drive_folder_ids: ["fictional-selected-folder"] },
      scopes: ["gmail.readonly", "calendar.events", "drive.readonly"],
      tokenHealth: {
        accessEnvelopeValid: true,
        refreshEnvelopeValid: true,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    },
    summary: {
      requiredReady: 5,
      requiredTotal: 5,
      optionalReady: 0,
      optionalTotal: 1,
      launchReady: true,
      percent: 100,
      degraded: 0,
    },
  };
}

function proposals(pack: DemoScenarioPack) {
  return pack.opportunities.slice(0, 7).map((opportunity, index) => {
    const contact = person(pack, opportunity.personId);
    return {
      id: `proposal-${index + 1}`,
      lead_id: contact.id,
      client_name: opportunity.company,
      share_token: `fictional-${index + 1}`,
      title: opportunity.name,
      content: {
        sections: [
          { title: "Executive summary", content: `A focused scope for ${opportunity.company}.` },
          { title: "Recommended solution", content: opportunity.nextAction },
          {
            title: "Success measures",
            content: "Faster response, clearer ownership, and measurable follow-through.",
          },
        ],
      },
      total_one_time: opportunity.value,
      total_monthly: index % 3 === 0 ? 950 + index * 125 : 0,
      status: ["viewed", "sent", "accepted", "draft"][index % 4]!,
      sent_at: index % 4 === 3 ? null : ago(30 + index * 11),
      viewed_at: index % 4 < 2 ? ago(20 + index * 8) : null,
      responded_at: index % 4 === 2 ? ago(12 + index) : null,
      created_at: ago(120 + index * 24),
    };
  });
}

function emailSequences(pack: DemoScenarioPack) {
  const sequences = pack.people.slice(0, 16).map((contact, index) => ({
    id: `sequence-${index}`,
    email: contact.email,
    sequence_type: ["plan_nurture", "resource_welcome", "grader_followup"][index % 3]!,
    current_step: (index % 5) + 1,
    status:
      index < 9 ? "active" : index < 13 ? "completed" : index < 15 ? "paused" : "unsubscribed",
    metadata: { resend_email_ids: [`fictional-email-${index}`] },
    created_at: ago(80 + index * 9),
  }));
  return {
    sequences,
    stats: { active: 9, completed: 4, paused: 2, unsubscribed: 1, total: 16 },
    totalPages: 1,
  };
}

function clientRows(pack: DemoScenarioPack, state: DemoState) {
  return pack.people.slice(0, 9).map((contact, index) => ({
    id: `client-${index}`,
    lead_id: contact.id,
    business_name: contact.company,
    contact_name: contact.name,
    contact_email: contact.email,
    contact_phone: contact.phone,
    industry: pack.category,
    status: index < 6 ? "active" : index === 6 ? "onboarding" : index === 7 ? "paused" : "churned",
    monthly_value: index < 7 ? 1200 + index * 275 : 0,
    one_time_value: 1800 + index * 450,
    contract_start: dateOffset(-120 + index * 9),
    contract_end: dateOffset(245 + index * 12),
    services: ["Operating review", "Workflow implementation"],
    onboarding_checklist: [
      { label: "Kickoff complete", done: true },
      { label: "Systems access confirmed", done: index !== 6 },
      { label: "First workflow verified", done: index < 6 },
    ],
    notes: `Fictional client record for the ${pack.name} demonstration.`,
    created_at: ago(900 + index * 120),
    updated_at: ago(index + 2),
    ...(state.clientOverrides[`client-${index}`] || {}),
  }));
}

function clients(pack: DemoScenarioPack, state: DemoState, requestedId?: string | null) {
  const rows = clientRows(pack, state);
  if (requestedId)
    return {
      client: rows.find((item) => item.id === requestedId) || null,
      canonicalSchemaReady: true,
    };
  return {
    clients: rows,
    canonicalSchemaReady: true,
    totalMRR: rows
      .filter((item) => item.status === "active")
      .reduce((sum, item) => sum + Number(item.monthly_value || 0), 0),
    activeCount: rows.filter((item) => item.status === "active").length,
  };
}

function contentItems(pack: DemoScenarioPack) {
  return pack.content.contentTitles.map((title, index) => ({
    id: `content-${index}`,
    title,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    status: ["idea", "outline", "draft", "review", "published"][index % 5]!,
    category: ["lead-generation", "operations", "industry", "foundational"][index % 4]!,
    target_keywords: [pack.category.toLowerCase(), ...title.toLowerCase().split(" ").slice(0, 2)],
    pillar: ["Demand", "Operations", "Industry", "Foundational"][index % 4]!,
    funnel_stage: ["awareness", "consideration", "decision"][index % 3]!,
    target_publish_date: dateOffset(index * 5 - 8),
    actual_publish_date: index % 5 === 4 ? dateOffset(-index) : undefined,
    author: pack.tenant.founder.fullName,
    notes: `Fictional editorial brief grounded in the current ${pack.category.toLowerCase()} workspace.`,
    seo_title: `${title} | ${pack.name}`,
    seo_description: `A specific operating resource from ${pack.name}.`,
    word_count_target: 900 + index * 100,
    created_at: ago(240 + index * 24),
    updated_at: ago(index * 5 + 1),
  }));
}

function featureBoard(pack: DemoScenarioPack, state: DemoState) {
  const titles = pack.content.roadmapTitles;
  return titles.map((title, index) => {
    const id = `feature-${index}`;
    const defaultStatus = ["backlog", "planned", "in_progress", "blocked", "shipped"][index % 5]!;
    const defaultSortOrder = (index + 1) * 1000;
    // Dragging a card on the demo board writes here (see the PATCH handler
    // below); without this override the board always re-rendered the
    // scenario's fixed default on the next read and every drag snapped back.
    const override = state.featureOverrides[id];
    return {
      id,
      seed_key: `demo-${index}`,
      title,
      description: `${title} adapted to the operating model for ${pack.name}.`,
      status: override?.status ?? defaultStatus,
      priority: index < 3 ? "high" : index < 10 ? "medium" : "low",
      labels: [
        `milestone:${index % 5 === 4 ? "done" : index < 7 ? "now" : "next"}`,
        `category:${["revenue", "delivery", "intelligence", "system"][index % 4]}`,
        `capability:${["automation", "reporting", "integration"][index % 3]}`,
      ],
      sort_order: override?.sort_order ?? defaultSortOrder,
      owner: index % 2 ? pack.tenant.founder.fullName : "Implementation partner",
      target_date: dateOffset(index * 6 + 10),
      acceptance_criteria:
        "The workflow is observable, reversible, and verified on desktop and mobile.",
      notes: "Fictional roadmap item for demonstration.",
      source: "demo_scenario",
      archived_at: null,
      created_at: ago(700 + index * 20),
      updated_at: override ? new Date().toISOString() : ago(index * 4 + 1),
    };
  });
}

function settings(pack: DemoScenarioPack) {
  const values: Array<[string, string, boolean, string]> = [
    ["OPENROUTER_API_KEY", "••••••••demo", true, "Bounded model gateway credential"],
    ["RESEND_API_KEY", "••••••••demo", true, "Recorded email delivery credential"],
    ["CRON_SECRET", "••••••••demo", true, "Authenticated scheduler secret"],
    ["RESEND_FROM_EMAIL", pack.tenant.founder.email, false, "Verified sender identity"],
    ["ADMIN_EMAIL", pack.tenant.founder.email, false, "Primary operator inbox"],
    [
      "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
      pack.tenant.brand.domain,
      false,
      "Privacy-minimized analytics domain",
    ],
    ["SITE_URL", pack.tenant.brand.siteUrl, false, "Fictional public site"],
    ["BUSINESS_NAME", pack.name, false, "Workspace business name"],
    ["NOTIFY_NEW_LEADS", "true", false, "Notify on new inquiries"],
    ["NOTIFY_NEW_CONTACTS", "true", false, "Notify on contact forms"],
    ["NOTIFY_HOT_LEADS", "true", false, "Notify on high-fit inquiries"],
    ["NOTIFY_PROPOSAL_VIEWED", "true", false, "Notify on proposal views"],
    ["NOTIFY_TASK_OVERDUE", "true", false, "Notify on overdue tasks"],
    ["NOTIFY_CONTRACT_EXPIRING", "false", false, "Notify on expiring agreements"],
  ];
  return {
    settings: values.map(([key, value, is_secret, description], index) => ({
      key,
      value,
      is_secret,
      description,
      updated_at: ago(index + 2),
    })),
  };
}

function importBatch(pack: DemoScenarioPack) {
  const rows = pack.people.slice(0, 5).map((contact, index) => ({
    id: `import-row-${index}`,
    row_index: index + 1,
    status: "proposed",
    action: index === 3 ? "update" : "create",
    included: true,
    confidence: index === 4 ? "medium" : "high",
    reviewed_data: {
      fullName: contact.name,
      email: contact.email,
      phone: contact.phone,
      companyName: contact.company,
      role: contact.role,
      website: null,
      industry: pack.category,
      source: "community event",
      notes: "Fictional import candidate",
    },
    warnings: index === 4 ? ["Confirm the company name before approval"] : [],
    errors: [],
    match_reason: index === 3 ? "Matched an existing email" : null,
    matched_contact_id: index === 3 ? contact.id : null,
    imported_contact_id: null,
    error: null,
  }));
  return {
    id: "demo-import-batch",
    status: "needs_review",
    source_type: "pasted_text",
    original_filename: "community-contacts.csv",
    source_row_count: 5,
    proposed_row_count: 5,
    selected_row_count: 5,
    review_digest: "fictional-review-digest",
    approval_digest: null,
    ai_model: "bounded-demo-model",
    summary: { create: 4, update: 1, skip: 0 },
    error: null,
    approved_by: null,
    approved_at: null,
    completed_at: null,
    created_at: ago(20),
    updated_at: ago(2),
    rows,
  };
}
function legacy(pack: DemoScenarioPack, path: string) {
  const contacts = pack.people.map((item, index) => {
    const resource = pack.content.resourceTitles[index % pack.content.resourceTitles.length]!;
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      contact_name: item.name,
      contact_email: item.email,
      phone: item.phone,
      contact_phone: item.phone,
      business_name: item.company,
      business_type: pack.category,
      industry: pack.category.toLowerCase().replace(/\s/g, "_"),
      message: pack.conversations[index % pack.conversations.length]!.messages[0]!.body,
      lead_status: pack.opportunities[index % pack.opportunities.length]!.stage,
      status: index % 4 === 0 ? "new" : "active",
      created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
      subscribed_at: new Date(Date.now() - index * 86_400_000).toISOString(),
      resource_id: resource.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      resource_name: resource,
      downloaded_at: new Date(Date.now() - index * 86_400_000).toISOString(),
      company: item.company,
      website: `https://${item.company.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
      score: 68 + (index % 28),
    };
  });
  if (path === "/api/admin/leads")
    return { leads: contacts.slice(0, 18), total: 18, totalPages: 1, page: 1 };
  if (path === "/api/admin/contacts")
    return {
      contacts: contacts.slice(0, 16),
      total: 16,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
    };
  if (path === "/api/admin/chat-leads")
    return {
      leads: contacts.slice(2, 10),
      total: 8,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
    };
  if (path === "/api/admin/subscribers")
    return {
      subscribers: contacts.slice(0, 20),
      total: 20,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
      stats: { total: 20, active: 18, unsubscribed: 2 },
    };
  if (path === "/api/admin/resources")
    return {
      downloads: contacts.slice(0, 14),
      total: 14,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
      stats: { totalDownloads: 14, uniqueUsers: 12 },
    };
  if (path === "/api/admin/partners")
    return {
      partners: contacts
        .filter((item) => item.id)
        .slice(0, 8)
        .map((item, index) => ({
          ...item,
          organization: item.business_name,
          partnership_type: index % 2 ? "referral" : "community",
          status: index < 3 ? "new" : "contacted",
        })),
      total: 8,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
    };
  if (path === "/api/admin/website-grades")
    return {
      grades: contacts.slice(0, 10).map((item) => ({
        ...item,
        url: item.website,
        overall_score: item.score,
        email: item.contact_email,
      })),
      total: 10,
      totalPages: 1,
      page: 1,
      canonicalSchemaReady: true,
    };
  return null;
}

let activeRuntime: { scenarioId: DemoScenarioId; restore: () => void; reset: () => void } | null =
  null;

export function installAdminDemoRuntime(scenarioId: DemoScenarioId) {
  if (activeRuntime?.scenarioId === scenarioId) return activeRuntime;
  activeRuntime?.restore();
  const pack = DEMO_SCENARIOS[scenarioId];
  const state = loadState(scenarioId);
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = window.open.bind(window);
  const reset = () => {
    sessionStorage.removeItem(keyFor(scenarioId));
    clearDemoAppearance(scenarioId);
    window.location.reload();
  };
  const demoFetch: typeof window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    const path = url.pathname;
    const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (!path.startsWith("/api/admin")) {
      if (
        ["/api/chat", "/api/analytics/events"].includes(path) ||
        path.startsWith("/api/cron") ||
        path.startsWith("/api/webhooks")
      )
        return jsonResponse({ error: "Blocked by the fictional demo runtime" }, 403);
      return nativeFetch(input, init);
    }
    const body =
      init?.body && typeof init.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};
    const emailTemplateIds = [
      "inquiry-reply",
      "appointment-confirmation",
      "proposal-follow-up",
      "welcome",
    ];
    if (method === "GET" && path === "/api/admin/inbox") return jsonResponse(inbox(pack));
    if (method === "GET" && path === "/api/admin/emails/preview") {
      const id = url.searchParams.get("id");
      if (id && !emailTemplateIds.includes(id))
        return jsonResponse({ error: "Email template not found" }, 404);
      return jsonResponse(id ? emailStudio(pack, id, state) : emailStudio(pack, null, state));
    }
    if (method === "POST" && path === "/api/admin/emails/preview" && body.action === "render") {
      const id = String(body.id || "");
      if (!emailTemplateIds.includes(id))
        return jsonResponse({ error: "Email template not found" }, 404);
      const template = emailStudio(pack, id, state);
      const blocks = Array.isArray(body.blocks)
        ? (body.blocks as DemoEmailBlock[])
        : template.blocks;
      return jsonResponse({
        subject: interpolateDemoEmail(
          String(body.subjectTemplate || template.subjectTemplate),
          template.sampleData,
        ),
        html: demoEmailHtml(blocks, template.sampleData, pack.tenant.brand),
        text: blocks.map((block) => block.text || "").join("\n\n"),
      });
    }
    if (method === "PATCH" && path === "/api/admin/emails/preview") {
      const id = String(body.id || "");
      if (!id || !Array.isArray(body.blocks))
        return jsonResponse({ error: "A complete simulated email is required." }, 400);
      if (!emailTemplateIds.includes(id))
        return jsonResponse({ error: "Email template not found" }, 404);
      const current = emailStudio(pack, id, state);
      state.emailDrafts[id] = {
        subjectTemplate: String(body.subjectTemplate || current.subjectTemplate),
        previewText: String(body.previewText || current.previewText),
        blocks: body.blocks as DemoEmailBlock[],
      };
      saveState(scenarioId, state);
      return jsonResponse({ success: true, simulated: true });
    }
    if (
      method === "POST" &&
      path === "/api/admin/emails/preview" &&
      (body.action === "test" || body.action === "publish")
    )
      return jsonResponse({ success: true, simulated: true, to: `${pack.tenant.founder.email}` });
    if (method === "DELETE" && path === "/api/admin/emails/preview") {
      delete state.emailDrafts[url.searchParams.get("id") || ""];
      saveState(scenarioId, state);
      return jsonResponse({ success: true, simulated: true });
    }
    if (method === "GET" && path === "/api/admin/emails/history")
      return jsonResponse({
        history: pack.conversations.flatMap((conversation, index) =>
          conversation.messages
            .filter((message) => message.direction === "outbound")
            .map((message) => {
              const contact = person(pack, conversation.personId);
              return {
                id: message.id,
                to: contact.email,
                toName: contact.name,
                subject: conversation.subject,
                body: message.body,
                status: "delivered",
                providerId: `demo-provider-${index}`,
                template: index % 2 ? "appointment-confirmation" : "inquiry-reply",
                sentAt: message.at,
                source: "fictional_demo",
              };
            }),
        ),
      });
    if (method === "GET" && path === "/api/admin/revenue-os/campaigns")
      return jsonResponse({ schemaReady: true, campaigns: campaigns(pack) });
    if (method === "GET" && path === "/api/admin/revenue-os/recovery") {
      if (url.searchParams.get("batchId"))
        return jsonResponse({
          totals: { candidates: 24, eligible: 18, excluded: 6, estimatedValue: 18400 },
          samples: [
            {
              email: `active@${pack.tenant.brand.domain}`,
              status: "eligible",
              reason: null,
              estimatedValue: 1200,
            },
            {
              email: `suppressed@${pack.tenant.brand.domain}`,
              status: "excluded",
              reason: "Contact is suppressed or inactive",
              estimatedValue: 0,
            },
            {
              email: `open-deal@${pack.tenant.brand.domain}`,
              status: "excluded",
              reason: "Contact already has an active or advanced opportunity",
              estimatedValue: 2000,
            },
          ],
        });
      const campaign = campaigns(pack)[0]!;
      return jsonResponse({
        schemaReady: true,
        batches: [
          {
            id: `import-${scenarioId}`,
            original_filename: `${scenarioId}-past-contacts.csv`,
            status: "completed",
            completed_at: ago(4),
            selected_row_count: 24,
            created_at: ago(4),
          },
        ],
        playbooks: [
          {
            id: `recovery-${scenarioId}`,
            campaign_id: campaign.id,
            motion_key: "stale_lead",
            offer_label: `Book a focused ${pack.category.toLowerCase()} review`,
            booking_url: pack.tenant.booking.url,
            timezone: "America/Detroit",
            outcome_window_days: 60,
            created_at: ago(3),
            campaigns: campaign,
            metrics: {
              eligible: 18,
              excluded: 6,
              replied: 4,
              booked: 2,
              won: 1,
              estimatedValue: 18400,
              wonRevenue: 6400,
            },
          },
        ],
      });
    }
    if (method === "GET" && path === "/api/admin/revenue-os/campaigns/preview") {
      const campaign = campaigns(pack).find((item) => item.id === url.searchParams.get("id"));
      if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);
      return jsonResponse({
        campaign,
        policy: campaign.policy,
        steps: campaign.campaign_steps.map((step) => ({
          ...step,
          body_template: "Hi {{first_name}}, here is the useful next step we discussed.",
        })),
        totals: {
          members: campaign.campaign_members.length,
          eligible: campaign.campaign_members.filter((item) => item.status === "active").length,
          excluded: campaign.campaign_members.filter((item) => item.status !== "active").length,
        },
        exclusions: pack.people
          .slice(20, 22)
          .map((item) => ({ email: item.email, reason: "Existing reply or suppression" })),
        samples: pack.people.slice(0, 3).map((item) => ({
          email: item.email,
          subject: campaign.campaign_steps[0]!.subject_template,
          body: `Hi ${item.name.split(" ")[0]}, here is the useful next step we discussed.`,
        })),
      });
    }
    if (method === "GET" && path === "/api/admin/bookings") return jsonResponse(bookings(pack));
    if (method === "GET" && path === "/api/admin/revenue-os/ai/runs")
      return jsonResponse(aiRuns(pack, state));
    if (method === "GET" && path.startsWith("/api/admin/revenue-os/ai/runs/"))
      return jsonResponse(
        aiRunDetail(pack, state, decodeURIComponent(path.split("/").at(-1) || "")),
      );
    if (method === "GET" && path === "/api/admin/revenue-os/ai/capabilities")
      return jsonResponse(aiCapabilities());
    if (method === "GET" && path === "/api/admin/tenant/providers")
      return jsonResponse({
        providers: [
          {
            id: `demo-openrouter-${scenarioId}`,
            provider: "openrouter",
            account_email: null,
            reply_to_email: null,
            status: "connected",
            credential_version: 3,
            connected_at: ago(12),
            credential_source: "tenant",
            key_metadata: {
              label: `${pack.name} demo key`,
              limit: 50,
              limit_remaining: 38.25,
              limit_reset: "monthly",
              usage: 11.75,
              is_free_tier: false,
              expires_at: null,
              verified_at: ago(12),
            },
          },
          {
            id: `demo-resend-${scenarioId}`,
            provider: "resend",
            account_email: pack.tenant.founder.email,
            reply_to_email: pack.tenant.founder.email,
            status: "connected",
            credential_version: 2,
            connected_at: ago(24),
            credential_source: "tenant",
            key_metadata: null,
          },
          {
            id: `demo-calendly-${scenarioId}`,
            provider: "calendly",
            account_email: null,
            reply_to_email: null,
            status: "connected",
            credential_version: 1,
            connected_at: ago(36),
            credential_source: "tenant",
            key_metadata: null,
          },
        ],
      });
    if (method === "GET" && path === "/api/admin/integrations")
      return jsonResponse(integrationCatalog(pack));
    if (method === "GET" && path === "/api/admin/setup") return jsonResponse(setup(pack));
    if (method === "GET" && path === "/api/admin/proposals") {
      const rows = proposals(pack);
      const requested = url.searchParams.get("id");
      return jsonResponse(
        requested
          ? { proposal: rows.find((item) => item.id === requested) || null }
          : {
              proposals: rows,
              totalOneTime: rows.reduce((sum, item) => sum + item.total_one_time, 0),
              totalMonthly: rows.reduce((sum, item) => sum + item.total_monthly, 0),
            },
      );
    }
    if (method === "GET" && path === "/api/admin/email-sequences")
      return jsonResponse(emailSequences(pack));
    if (method === "GET" && path === "/api/admin/clients")
      return jsonResponse(clients(pack, state, url.searchParams.get("id")));
    if (method === "GET" && path === "/api/admin/content")
      return jsonResponse({ items: contentItems(pack) });
    if (method === "GET" && path === "/api/admin/features")
      return jsonResponse({ schemaReady: true, features: featureBoard(pack, state) });
    if (method === "PATCH" && path === "/api/admin/features") {
      // Mirrors the real route's bulk-reorder contract: { reorder: [{ id,
      // status, sortOrder }, ...] }. Previously unhandled, so every request
      // here fell through to the generic 403 below and every optimistic
      // drag on the demo board reverted the instant its PATCH landed.
      const reorder = Array.isArray((body as { reorder?: unknown })?.reorder)
        ? (body as { reorder: Array<{ id: string; status: string; sortOrder: number }> }).reorder
        : [];
      for (const item of reorder) {
        if (!item?.id) continue;
        state.featureOverrides[item.id] = { status: item.status, sort_order: item.sortOrder };
      }
      saveState(scenarioId, state);
      return jsonResponse({ schemaReady: true, updated: reorder.length });
    }
    if (method === "GET" && path === "/api/admin/tenant/modules") {
      const tenantConfig = { modules: state.moduleOverrides };
      return jsonResponse({
        modules: getActiveModules(tenantConfig).map((mod) => mod.id),
        overrides: state.moduleOverrides,
        moduleSettings: state.moduleSettings,
      });
    }
    if (method === "PATCH" && path === "/api/admin/tenant/modules") {
      // Mirrors the real route so the flagship demo can actually show off
      // the thing it is meant to demonstrate: toggling and configuring a
      // module. Previously unhandled entirely, so every request here fell
      // through to the generic 404 below and the Modules tab looked broken
      // on the one surface reachable without logging in.
      const payload = body as { moduleId?: string; enabled?: boolean; settings?: unknown };
      const moduleId = String(payload?.moduleId || "");
      const moduleDef = REVENUE_OS_MODULES.find((mod) => mod.id === moduleId);
      if (!moduleDef) return jsonResponse({ error: "Unknown module" }, 404);
      if (typeof payload.enabled === "boolean") {
        if (moduleDef.isCore)
          return jsonResponse({ error: "Core modules cannot be disabled" }, 400);
        state.moduleOverrides[moduleId] = payload.enabled;
        saveState(scenarioId, state);
        return jsonResponse({
          moduleId,
          enabled: payload.enabled,
          modules: getActiveModules({ modules: state.moduleOverrides }).map((mod) => mod.id),
        });
      }
      if (payload.settings && typeof payload.settings === "object") {
        if (!moduleDef.settings?.length)
          return jsonResponse({ error: `${moduleDef.name} does not declare any settings.` }, 400);
        const validated = validateModuleSettingsInput(
          moduleId,
          payload.settings as Record<string, unknown>,
        );
        if (!validated.valid) return jsonResponse({ error: validated.error }, 400);
        state.moduleSettings[moduleId] = { ...state.moduleSettings[moduleId], ...validated.value };
        saveState(scenarioId, state);
        return jsonResponse({ moduleId, settings: state.moduleSettings[moduleId] });
      }
      return jsonResponse({ error: "Invalid module request" }, 400);
    }
    if (method === "GET" && path === "/api/admin/settings") return jsonResponse(settings(pack));
    if (method === "GET" && path === "/api/admin/tenants")
      return jsonResponse({
        isPlatformAdmin: false,
        platformOwnerUserId: null,
        tenants: [],
        memberships: [],
      });
    if (method === "GET" && path === "/api/admin/revenue-os/contact-imports") {
      const batch = importBatch(pack);
      const requested = url.searchParams.get("id");
      return jsonResponse(
        requested
          ? { schemaReady: true, batch: requested === batch.id ? batch : null }
          : { schemaReady: true, batches: [{ ...batch, rows: undefined }] },
      );
    }
    if (method === "POST" && path === "/api/admin/revenue-os/ai/stream") {
      const conversationId = String(body.conversationId || `ai-${scenarioId}`);
      const runId = `demo-run-${crypto.randomUUID()}`;
      const answer = `For ${pack.name}, the highest-priority move is to handle ${pack.actions[0]!.title.toLowerCase()} first. It is grounded in the latest linked conversation, and this demo will stage—not send—any external action.`;
      const startedAt = new Date().toISOString();
      state.generatedAiRuns.unshift({
        id: runId,
        surface: "command_center",
        provider: "openrouter",
        model: "bounded-demo-model",
        toolPack: "operator_brief",
        conversationId,
        status: "completed",
        toolNames: ["build_priority_brief"],
        inputTokens: 640,
        outputTokens: 190,
        durationMs: 920,
        promptPreview: String(body.text || "Review the current priorities"),
        resultPreview: answer,
        error: null,
        startedAt,
        finishedAt: startedAt,
        feedback: null,
      });
      saveState(scenarioId, state);
      return eventStreamResponse([
        { type: "conversation", conversationId, userMessageId: `demo-user-${crypto.randomUUID()}` },
        { type: "run_started", runId, model: "bounded-demo-model", pack: "operator_brief" },
        { type: "tool_started", name: "build_priority_brief", index: 0 },
        {
          type: "tool_completed",
          name: "build_priority_brief",
          index: 0,
          summary: "Reviewed fictional priorities, conversations, and pipeline context.",
          failed: false,
        },
        { type: "assistant_delta", delta: answer },
        {
          type: "final",
          conversationId,
          messageId: `demo-assistant-${crypto.randomUUID()}`,
          runId,
          text: answer,
          proposedActions: [],
        },
      ]);
    }
    if (method === "POST" && path === "/api/admin/revenue-os/contact-imports")
      return jsonResponse({ schemaReady: true, batch: importBatch(pack) });
    if (method === "POST" && path === "/api/admin/settings/test")
      return jsonResponse({ success: true, simulated: true });
    const opportunityRecordMatch = path.match(
      /^\/api\/admin\/revenue-os\/records\/opportunity\/([^/]+)$/,
    );
    if (method === "GET" && opportunityRecordMatch)
      return jsonResponse({
        schemaReady: true,
        record: opportunityRecord(pack, state, decodeURIComponent(opportunityRecordMatch[1]!)),
      });
    if (method === "PATCH" && opportunityRecordMatch) {
      const opportunityId = decodeURIComponent(opportunityRecordMatch[1]!);
      if (!pack.opportunities.some((item) => item.id === opportunityId))
        return jsonResponse({ error: "Opportunity not found" }, 404);
      state.opportunityOverrides[opportunityId] = {
        nextAction:
          body.nextAction === undefined
            ? state.opportunityOverrides[opportunityId]?.nextAction
            : body.nextAction === null
              ? null
              : String(body.nextAction),
        nextActionAt:
          body.nextActionAt === undefined
            ? state.opportunityOverrides[opportunityId]?.nextActionAt
            : body.nextActionAt === null
              ? null
              : String(body.nextActionAt),
        estimatedValue:
          body.estimatedValue === undefined
            ? state.opportunityOverrides[opportunityId]?.estimatedValue
            : Number(body.estimatedValue),
      };
      saveState(scenarioId, state);
      window.dispatchEvent(new Event("admin:demo-state"));
      return jsonResponse({
        schemaReady: true,
        record: opportunityRecord(pack, state, opportunityId),
        simulated: true,
      });
    }
    if (method === "PATCH" && path === "/api/admin/clients") {
      const clientId = String(body.id || "");
      if (!clientRows(pack, state).some((item) => item.id === clientId))
        return jsonResponse({ error: "Client not found" }, 404);
      const allowed = [
        "status",
        "business_name",
        "contact_name",
        "contact_email",
        "contact_phone",
        "industry",
        "monthly_value",
        "one_time_value",
        "contract_start",
        "contract_end",
        "services",
        "onboarding_checklist",
        "notes",
      ];
      state.clientOverrides[clientId] = {
        ...(state.clientOverrides[clientId] || {}),
        ...Object.fromEntries(
          allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
        ),
        updated_at: new Date().toISOString(),
      };
      saveState(scenarioId, state);
      window.dispatchEvent(new Event("admin:demo-state"));
      return jsonResponse({
        client: clientRows(pack, state).find((item) => item.id === clientId),
        simulated: true,
      });
    }
    if (method !== "GET") {
      if (path === "/api/admin/revenue-os/actions") state.completedActions.push(String(body.id));
      if (["/api/admin/tasks", "/api/admin/revenue-os/tasks"].includes(path))
        state.completedTasks.push(String(body.id));
      if (path === "/api/admin/revenue-os/pipeline" && body.id && body.stage)
        state.stageOverrides[String(body.id)] = String(body.stage);
      if (path === "/api/admin/revenue-os/conversations/reply") {
        const id = String(body.conversationId);
        state.sentReplies[id] = [...(state.sentReplies[id] || []), String(body.body || "")];
      }
      if (path === "/api/admin/notifications" && body.id)
        state.readNotifications.push(String(body.id));
      saveState(scenarioId, state);
      window.dispatchEvent(new Event("admin:demo-state"));
      return jsonResponse({
        success: true,
        simulated: true,
        receipt: { id: `demo-${crypto.randomUUID()}`, status: "simulated", scenario: scenarioId },
      });
    }
    if (path === "/api/admin/revenue-os/priority") return jsonResponse(priority(pack, state));
    if (path === "/api/admin/notifications") return jsonResponse(notifications(pack, state));
    if (path === "/api/admin/search")
      return jsonResponse({
        results: pack.people
          .filter(
            (item) =>
              !url.searchParams.get("q") ||
              `${item.name} ${item.email} ${item.company}`
                .toLowerCase()
                .includes(url.searchParams.get("q")!.toLowerCase()),
          )
          .slice(0, 10)
          .map((item) => ({ name: item.name, email: item.email, type: item.role })),
      });
    if (path === "/api/admin/revenue-os/overview") {
      const rows = opportunityRows(pack, state);
      const open = rows.filter((item) => !["won", "lost"].includes(item.canonical_stage));
      return jsonResponse({
        schemaReady: true,
        generatedAt: new Date().toISOString(),
        metrics: {
          openOpportunities: open.length,
          pipelineValue: open.reduce((sum, item) => sum + item.estimated_value, 0),
          weightedValue: Math.round(
            open.reduce((sum, item) => sum + item.estimated_value, 0) * 0.54,
          ),
          wonRevenue: rows.reduce((sum, item) => sum + item.won_value, 0),
          unreadConversations: pack.conversations.reduce((sum, item) => sum + item.unread, 0),
          activeCampaigns: 3,
          pendingProposals: 4,
        },
        queue: queue(pack, state),
        integrations: [],
        health: {
          status: "attention",
          attentionCount: 1,
          integrations: [
            {
              provider: "Google Workspace",
              status: "ready",
              lastSuccessAt: new Date().toISOString(),
              lastError: null,
            },
            { provider: "Resend", status: "ready", lastSuccessAt: ago(2), lastError: null },
            {
              provider: "QuickBooks",
              status: "degraded",
              lastSuccessAt: ago(30),
              lastError: "A simulated sync needs review",
            },
          ],
          sourceRuns: [
            {
              key: "gmail-sync",
              status: "success",
              startedAt: ago(2),
              finishedAt: ago(2),
              error: null,
            },
          ],
          jobRuns: [
            {
              key: "daily-priority",
              status: "success",
              startedAt: ago(1),
              finishedAt: ago(1),
              error: null,
            },
          ],
        },
      });
    }
    if (path === "/api/admin/revenue-os/actions")
      return jsonResponse({
        actions: pack.actions
          .filter((item) => !state.completedActions.includes(item.id))
          .map((item, index) => ({
            id: item.id,
            action_type: item.type,
            title: item.title,
            description: item.description,
            urgency: index < 2 ? "high" : "normal",
            reasoning: item.description,
            status: "pending",
            created_at: ago(index + 1),
            expires_at: new Date(Date.now() + 4 * 86_400_000).toISOString(),
            payload:
              item.type === "send_gmail_reply"
                ? {
                    to: person(pack, item.personId).email,
                    subject: pack.conversations[index]!.subject,
                    body: item.body,
                  }
                : {
                    opportunityId: pack.opportunities[index]!.id,
                    stage: "proposal",
                    reason: item.description,
                  },
          })),
      });
    if (path === "/api/admin/revenue-os/pipeline")
      return jsonResponse({
        schemaReady: true,
        signalsReady: { calendar: true },
        opportunities: opportunityRows(pack, state),
      });
    if (path === "/api/admin/revenue-os/conversations")
      return jsonResponse(conversations(pack, state, url.searchParams.get("id")));
    if (path === "/api/admin/revenue-os/analytics") return jsonResponse(analytics(pack, state));
    if (path === "/api/admin/contacts/timeline") {
      const requestedEmail = (url.searchParams.get("email") || "").toLowerCase();
      const contact = pack.people.find((item) => item.email.toLowerCase() === requestedEmail);
      if (!contact)
        return jsonResponse({
          timeline: [],
          canonical: {
            schemaReady: true,
            status: "unlinked",
            contact: null,
            company: null,
            opportunities: [],
          },
        });
      const opportunity =
        pack.opportunities.find((item) => item.personId === contact.id) || pack.opportunities[0]!;
      const conversation =
        pack.conversations.find((item) => item.personId === contact.id) || pack.conversations[0]!;
      const contactTasks = pack.tasks.filter((item) => item.personId === contact.id).slice(0, 3);
      const timeline = [
        {
          type: "contact",
          title: `Website inquiry from ${contact.name}`,
          description: conversation.messages[0]!.body,
          timestamp: conversation.messages[0]!.at,
          sourceId: `submission-${contact.id}`,
          link: "/admin/contacts",
        },
        ...conversation.messages.map((message) => ({
          type: message.direction === "inbound" ? "message_inbound" : "message_outbound",
          title: `${message.direction === "inbound" ? "Received" : "Sent"}: ${conversation.subject}`,
          description: message.body,
          timestamp: message.at,
          sourceId: message.id,
          link: "/admin/conversations",
        })),
        {
          type: "opportunity",
          title: `Pipeline: ${opportunity.name}`,
          description: `Stage: ${opportunity.stage.replace(/_/g, " ")} · $${opportunity.value.toLocaleString()} · Next: ${opportunity.nextAction}`,
          timestamp: conversation.messages[0]!.at,
          sourceId: opportunity.id,
          link: `/admin/pipeline?search=${encodeURIComponent(contact.email)}`,
        },
        ...contactTasks.map((task, index) => ({
          type: "task",
          title: `Task: ${task.title}`,
          description: `${task.status} · ${task.priority} priority`,
          timestamp: ago(index + 2),
          sourceId: task.id,
          link: "/admin/today",
        })),
      ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      return jsonResponse({
        timeline,
        canonical: {
          schemaReady: true,
          status: "connected",
          contact: {
            id: contact.id,
            full_name: contact.name,
            lifecycle_stage: opportunity.stage,
            communication_status: "active",
            next_action: opportunity.nextAction,
            next_action_at: dateOffset(1),
          },
          company: {
            id: `company-${contact.id}`,
            name: contact.company,
            domain: `${contact.company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
            industry: pack.category,
          },
          opportunities: [
            {
              id: opportunity.id,
              stage: opportunity.stage,
              estimated_value: opportunity.value,
              won_value: opportunity.stage === "won" ? opportunity.value : 0,
            },
          ],
        },
      });
    }
    if (path === "/api/admin/revenue") {
      const rows = opportunityRows(pack, state);
      return jsonResponse({
        totalMRR: 18400,
        totalOneTime: rows.reduce((sum, item) => sum + item.won_value, 0),
        activeCount: 6,
        churnRate: 4,
        avgClientValue: 3067,
        industryBreakdown: [{ name: pack.category, value: 100 }],
        byClient: pack.people.slice(0, 6).map((item, index) => ({
          name: `${item.company} · ${item.name}`,
          monthly: 1800 + index * 425,
          oneTime: index * 900,
        })),
        mrrTimeline: ["Apr", "May", "Jun", "Jul", "Aug"].map((date, index) => ({
          date,
          mrr: 11200 + index * 1800,
        })),
        proposalRevenue: 24600,
      });
    }
    if (path === "/api/admin/activity") return jsonResponse(auditHistory(pack, url.searchParams));
    if (path === "/api/admin/revenue-os/ai/conversations")
      return jsonResponse({
        schemaReady: true,
        conversations: [
          {
            id: `ai-${scenarioId}`,
            title: `Morning review for ${pack.name}`,
            lastMessageAt: ago(1),
          },
        ],
      });
    if (path.startsWith("/api/admin/revenue-os/ai/conversations/")) {
      const requestedId = decodeURIComponent(path.split("/").at(-1) || "");
      if (requestedId !== `ai-${scenarioId}`)
        return jsonResponse({ error: "AI conversation not found" }, 404);
      return jsonResponse({
        messages: [
          {
            id: "ai-welcome",
            role: "assistant",
            content: `I am grounded in this fictional ${pack.name} workspace. ${pack.story[0]}.`,
            runId: null,
            createdAt: ago(1),
          },
        ],
      });
    }
    const legacyPayload = legacy(pack, path);
    if (legacyPayload) return jsonResponse(legacyPayload);
    if (path === "/api/admin/revenue-os/tasks")
      return jsonResponse({
        tasks: pack.tasks.filter((item) => !state.completedTasks.includes(item.id)),
      });
    if (path === "/api/admin/tasks")
      return jsonResponse({
        tasks: pack.tasks
          .filter((item) => !state.completedTasks.includes(item.id))
          .map((item) => ({
            ...item,
            due_date: dateOffset(item.dueOffset),
            contact_email: person(pack, item.personId).email,
          })),
      });
    if (path === "/api/admin/google/sync") return jsonResponse({ success: true, simulated: true });
    return jsonResponse(
      { error: "This fictional workspace has no handler for this request.", simulated: true },
      404,
    );
  };
  (window as Window & { __accelerateAdminDemoRuntime?: string }).__accelerateAdminDemoRuntime =
    scenarioId;
  window.fetch = demoFetch;
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const value = String(url || "");
    if (value.startsWith("/api/admin")) {
      const blob = new Blob(
        [
          `name,email,scenario\n${pack.people
            .slice(0, 8)
            .map((item) => `${item.name},${item.email},${scenarioId}`)
            .join("\n")}`,
        ],
        { type: "text/csv" },
      );
      return nativeOpen(URL.createObjectURL(blob), target, features);
    }
    return nativeOpen(url, target, features);
  }) as typeof window.open;
  const restore = () => {
    window.fetch = nativeFetch;
    window.open = nativeOpen;
    const marker = window as Window & { __accelerateAdminDemoRuntime?: string };
    if (marker.__accelerateAdminDemoRuntime === scenarioId)
      delete marker.__accelerateAdminDemoRuntime;
    if (activeRuntime?.scenarioId === scenarioId) activeRuntime = null;
  };
  activeRuntime = { scenarioId, restore, reset };
  return { pack, reset, restore };
}
