import { DEMO_SCENARIOS, type DemoScenarioId, type DemoScenarioPack } from "./scenarios";
import { clearDemoAppearance } from "./appearance-state";

type DemoEmailBlock = { id: string; type: "heading" | "paragraph" | "button" | "divider" | "spacer"; text?: string; url?: string; height?: number };
type DemoEmailDraft = { subjectTemplate: string; previewText: string; blocks: DemoEmailBlock[] };
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
type DemoState = { completedActions: string[]; completedTasks: string[]; stageOverrides: Record<string, string>; sentReplies: Record<string, string[]>; readNotifications: string[]; emailDrafts: Record<string, DemoEmailDraft> };
const initialState = (): DemoState => ({ completedActions: [], completedTasks: [], stageOverrides: {}, sentReplies: {}, readNotifications: [], emailDrafts: {} });
const keyFor = (id: DemoScenarioId) => `accelerate:admin-demo:${id}:v3`;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const eventStreamResponse = (events: unknown[]) => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
const dateOffset = (days: number) => { const value = new Date(); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function loadState(id: DemoScenarioId): DemoState {
  try { return { ...initialState(), ...JSON.parse(sessionStorage.getItem(keyFor(id)) || "{}") }; } catch { return initialState(); }
}
function saveState(id: DemoScenarioId, state: DemoState) { sessionStorage.setItem(keyFor(id), JSON.stringify(state)); }

function person(pack: DemoScenarioPack, id: string) { return pack.people.find((item) => item.id === id)!; }
function opportunityRows(pack: DemoScenarioPack, state: DemoState) {
  return pack.opportunities.map((item, index) => {
    const contact = person(pack, item.personId); const stage = state.stageOverrides[item.id] || item.stage;
    return { id: item.id, name: item.name, email: contact.email, stage, canonical_stage: stage, estimated_value: item.value, won_value: stage === "won" ? item.value : 0, probability: { new: 10, contacted: 20, qualified: 40, meeting: 55, proposal: 70, negotiation: 85, won: 100, lost: 0, nurture: 10 }[stage] || 10, next_action: item.nextAction, next_action_at: dateOffset(index % 7), source: item.source, owner_email: pack.tenant.founder.email, last_activity_at: new Date(Date.now() - index * 7_200_000).toISOString(), created_at: new Date(Date.now() - (index + 4) * 86_400_000).toISOString(), contact: { full_name: contact.name, primary_email: contact.email }, company: { name: item.company, domain: null, industry: pack.category } };
  });
}
function queue(pack: DemoScenarioPack, state: DemoState) {
  const approvals = pack.actions.slice(0, 2).filter((item) => !state.completedActions.includes(item.id)).map((item, index) => ({ id: `action:${item.id}`, kind: "approval", title: item.title, summary: item.description, urgency: index === 0 ? "high" : "normal", dueAt: dateOffset(0), sourceTimestamp: ago(index + 1), priorityReason: "A consequential simulated change is staged for operator review.", recommendedNextAction: "Review the exact simulated change", href: `/admin/today?focus=approval&action=${item.id}` }));
  const replies = pack.conversations.slice(0, 2).map((item, index) => { const contact = person(pack, item.personId); return { id: `reply:${item.id}`, kind: "reply", title: `Reply to ${contact.name}`, summary: item.messages.at(-1)!.body, urgency: index === 0 ? "high" : "normal", dueAt: dateOffset(0), sourceTimestamp: item.messages.at(-1)!.at, priorityReason: "An unread customer message is waiting for a response.", recommendedNextAction: "Open the conversation and reply", href: "/admin/conversations" }; });
  const proposalOpportunities = [...pack.opportunities.filter((item) => ["proposal", "negotiation"].includes(state.stageOverrides[item.id] || item.stage)), ...pack.opportunities].filter((item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 2);
  const proposals = proposalOpportunities.map((item, index) => ({ id: `proposal:${item.id}`, kind: "proposal", title: item.nextAction, summary: `${item.company} has an active scope worth $${item.value.toLocaleString()}.`, urgency: index === 0 ? "high" : "normal", dueAt: dateOffset(index), sourceTimestamp: ago(index + 3), priorityReason: "An open commercial decision has a recorded next step.", recommendedNextAction: "Review the proposal and advance the decision", href: "/admin/proposals" }));
  const commitments = pack.tasks.slice(0, 6).filter((item) => item.status === "pending" && !state.completedTasks.includes(item.id)).map((item, index) => ({ id: `task:${item.id}`, kind: index % 2 === 0 ? "task" : "follow_up", title: item.title, summary: "Linked to the latest conversation and opportunity context.", urgency: item.priority === "high" ? "high" : "normal", dueAt: dateOffset(item.dueOffset), sourceTimestamp: ago(index + 2), priorityReason: item.dueOffset < 0 ? "The commitment is overdue." : "The next action is due soon.", recommendedNextAction: "Complete or snooze this task", href: "/admin/today" }));
  return [...approvals, ...replies, ...proposals, ...commitments];
}
function priority(pack: DemoScenarioPack, state: DemoState) { const items = queue(pack, state); return { status: "ready", summary: { total: items.length, urgent: items.filter((item) => item.urgency === "high").length, critical: 0 }, items }; }
function notifications(pack: DemoScenarioPack, state: DemoState) {
  const rows = [
    { id: "demo-notice-1", type: "new_lead", title: `New ${pack.tenant.pipeline.stageLabels.new || "inquiry"}`, description: `${pack.people[0]!.name} replied with a clear next step.`, link: "/admin/pipeline", priority: "urgent", created_at: new Date().toISOString() },
    { id: "demo-notice-2", type: "proposal_viewed", title: "Proposal viewed", description: `${pack.people[1]!.company} opened the latest scope.`, link: "/admin/proposals", priority: "important", created_at: new Date(Date.now() - 4_500_000).toISOString() },
    { id: "demo-notice-3", type: "task_overdue", title: "Commitment needs attention", description: pack.tasks[0]!.title, link: "/admin/today", priority: "important", created_at: new Date(Date.now() - 9_000_000).toISOString() },
  ].map((item) => ({ ...item, read: state.readNotifications.includes(item.id) }));
  return { notifications: rows, unreadCount: rows.filter((item) => !item.read).length, urgentCount: rows.filter((item) => !item.read && item.priority === "urgent").length, priority: priority(pack, state) };
}
function conversations(pack: DemoScenarioPack, state: DemoState, selected: string | null) {
  const rows = pack.conversations.map((item) => { const contact = person(pack, item.personId); return { id: item.id, channel: "gmail", external_id: `demo-${item.id}`, subject: item.subject, status: "open", intent: item.intent, unread_count: item.unread, last_message_at: item.messages.at(-1)!.at, metadata: { contact_email: contact.email } }; });
  const active = pack.conversations.find((item) => item.id === selected) || pack.conversations[0]!; const contact = person(pack, active.personId);
  const messages = [...active.messages, ...(state.sentReplies[active.id] || []).map((body, index) => ({ id: `local-${index}`, direction: "outbound" as const, body, at: new Date().toISOString() }))].map((item) => ({ id: item.id, direction: item.direction, sender_email: item.direction === "inbound" ? contact.email : pack.tenant.founder.email, recipient_emails: [item.direction === "inbound" ? pack.tenant.founder.email : contact.email], subject: active.subject, body_text: item.body, status: "delivered", sent_at: item.direction === "outbound" ? item.at : null, received_at: item.direction === "inbound" ? item.at : null, created_at: item.at }));
  return { schemaReady: true, conversations: rows, messages };
}
function analytics(pack: DemoScenarioPack, state: DemoState) {
  const rows = opportunityRows(pack, state); const open = rows.filter((item) => !["won", "lost"].includes(item.canonical_stage)); const won = rows.filter((item) => item.canonical_stage === "won"); const pipelineValue = open.reduce((sum, item) => sum + item.estimated_value, 0); const wonRevenue = won.reduce((sum, item) => sum + item.won_value, 0);
  return { schemaReady: true, windowDays: 30, cohort: "Fictional opportunities created in the selected window.", funnel: { opportunities: rows.length, qualified: rows.filter((item) => !["new", "contacted"].includes(item.canonical_stage)).length, meetings: rows.filter((item) => ["meeting", "proposal", "negotiation", "won"].includes(item.canonical_stage)).length, proposals: rows.filter((item) => ["proposal", "negotiation", "won"].includes(item.canonical_stage)).length, won: won.length, wonRevenue, pipelineValue }, rates: { qualified: 72, meeting: 69, proposal: 64, win: 40, inquiryToWin: Math.round(won.length / rows.length * 100) }, attribution: { missing: 0 }, forecast: { weightedPipeline: Math.round(pipelineValue * .54), unweightedPipeline: pipelineValue, method: "Recorded stage probability applied to open fictional opportunities." }, communication: { status: "ready", inboundConversations: 10, repliedConversations: 10, replyRate: 100, medianResponseHours: 2.4 }, quality: { missingAttribution: 0, missingOwner: 0, missingNextAction: 0, unrecognizedStage: 0, impossibleStageSequences: 0 }, filterOptions: { sources: ["Website inquiry", "Referral", "Email", "Community partner"], owners: [pack.tenant.founder.email], campaigns: ["Seasonal follow-up", "Referral thank-you"], stages: ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost", "nurture"] }, appliedFilters: { source: null, owner: null, campaign: null, stage: null }, sources: ["Website inquiry", "Referral", "Email", "Community partner"].map((source, index) => ({ source, opportunities: rows.filter((item) => item.source === source).length, won: index === 1 ? won.length : 0, revenue: index === 1 ? wonRevenue : 0 })), web: { status: "ready", pageViews: 1840, visitors: 1126, conversions: 74, engagementEvents: 462, conversionRate: 6.6, topPages: [{ label: "/", count: 620 }, { label: "/services", count: 384 }, { label: "/book", count: 211 }], sources: [{ label: "Google", count: 540 }, { label: "Direct", count: 312 }, { label: "Referral", count: 188 }], conversionEvents: [{ label: "Form submitted", count: 31 }, { label: "Booking started", count: 24 }, { label: "Email clicked", count: 19 }], eventCount: 2302, lastCapturedAt: new Date().toISOString() } };
}

function inbox(pack: DemoScenarioPack) {
  const kinds = ["lead", "contact", "chat", "task", "proposal", "partner"] as const;
  const items = kinds.flatMap((kind, kindIndex) => Array.from({ length: kind === "task" ? 3 : 2 }, (_, index) => {
    const contact = pack.people[kindIndex * 3 + index]!;
    return {
      id: kind === "task" ? pack.tasks[index]!.id : `inbox-${kind}-${index}`,
      kind,
      title: kind === "task" ? pack.tasks[index]!.title : `${contact.name} · ${contact.company}`,
      summary: pack.conversations[(kindIndex + index) % pack.conversations.length]!.messages[0]!.body,
      priority: kindIndex === 0 && index === 0 ? "urgent" : index === 0 ? "important" : "normal",
      createdAt: ago(kindIndex * 3 + index + 1),
      dueAt: kind === "task" ? dateOffset(index - 1) : null,
      href: kind === "proposal" ? "/admin/proposals" : kind === "task" ? "/admin/today" : "/admin/conversations",
      person: { name: contact.name, email: contact.email, phone: contact.phone },
      meta: kind === "proposal" ? `$${pack.opportunities[kindIndex]!.value.toLocaleString()} scope` : pack.category,
    };
  }));
  const counts = { all: items.length, lead: 0, contact: 0, chat: 0, task: 0, proposal: 0, partner: 0 };
  for (const item of items) counts[item.kind] += 1;
  return { items, counts, updatedAt: new Date().toISOString() };
}

const escapeEmailHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
const interpolateDemoEmail = (value: string, data: Record<string, string>) => value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => data[key] || `{{${key}}}`);
function demoEmailHtml(blocks: DemoEmailBlock[], data: Record<string, string>, brand: DemoScenarioPack["tenant"]["brand"]) {
  const body = blocks.map((block) => {
    if (block.type === "heading") return `<h1 style="margin:0 0 18px;color:#151611;font:700 28px/1.15 Arial,sans-serif">${escapeEmailHtml(interpolateDemoEmail(block.text || "", data))}</h1>`;
    if (block.type === "paragraph") return `<p style="margin:0 0 16px;color:#3f4744;font:15px/1.65 Arial,sans-serif">${escapeEmailHtml(interpolateDemoEmail(block.text || "", data)).replace(/\n/g, "<br>")}</p>`;
    if (block.type === "button") return `<p style="margin:24px 0"><a href="${escapeEmailHtml(interpolateDemoEmail(block.url || `${brand.siteUrl}/contact`, data))}" style="display:inline-block;background:#1b211e;border-radius:8px;padding:14px 18px;color:${brand.accentColor};font:700 14px Arial,sans-serif;text-decoration:none">${escapeEmailHtml(interpolateDemoEmail(block.text || "Book a call", data))} →</a></p>`;
    if (block.type === "divider") return `<hr style="border:0;border-top:1px solid #dfe5df;margin:24px 0">`;
    return `<div style="height:${Math.max(8, Math.min(96, Number(block.height) || 24))}px"></div>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#eef1ee"><main style="max-width:600px;margin:auto;border-radius:16px;background:#fff;padding:36px;box-sizing:border-box"><p style="margin:0 0 24px;color:#151611;font:800 20px Arial,sans-serif">${escapeEmailHtml(brand.name)}<span style="color:${brand.accentColor}">.</span></p>${body}<hr style="border:0;border-top:1px solid #dfe5df;margin:28px 0 16px"><p style="margin:0;color:#68736e;font:11px/1.6 Arial,sans-serif">${escapeEmailHtml(brand.name)} · ${escapeEmailHtml(brand.domain)}</p></main></body></html>`;
}
function emailStudio(pack: DemoScenarioPack, id: string, state: DemoState): DemoEmailStudioDetail;
function emailStudio(pack: DemoScenarioPack, id?: string | null, state?: DemoState): DemoEmailStudioList | DemoEmailStudioDetail;
function emailStudio(pack: DemoScenarioPack, id?: string | null, state: DemoState = initialState()): DemoEmailStudioList | DemoEmailStudioDetail {
  const templates = [
    { id: "inquiry-reply", name: "New inquiry response", description: "A prompt, personal first response with one clear next step.", category: "Revenue", subject: `Next steps with ${pack.name}`, variables: ["first_name", "company_name", "next_step"], hasDraft: false, source: "published" as const, updatedAt: ago(26) },
    { id: "appointment-confirmation", name: "Appointment confirmation", description: "Confirms the time, owner, and what the customer should expect.", category: "Operations", subject: "Your appointment is confirmed", variables: ["first_name", "appointment_time", "owner_name"], hasDraft: true, source: "published" as const, updatedAt: ago(8) },
    { id: "proposal-follow-up", name: "Proposal follow-up", description: "Moves an open decision forward without generic pressure.", category: "Revenue", subject: "A quick follow-up on your scope", variables: ["first_name", "proposal_name", "owner_name"], hasDraft: false, source: "built_in" as const, updatedAt: ago(54) },
    { id: "welcome", name: "Customer welcome", description: "Sets expectations immediately after a win or enrollment.", category: "Customer", subject: `Welcome to ${pack.name}`, variables: ["first_name", "start_date", "owner_name"], hasDraft: false, source: "published" as const, updatedAt: ago(74) },
  ].map((template) => ({ ...template, hasDraft: template.hasDraft || Boolean(state.emailDrafts[template.id]) }));
  if (!id) return { schemaReady: true, emails: templates };
  const template = templates.find((item) => item.id === id) || templates[0]!;
  const defaultBlocks: DemoEmailBlock[] = [{ id: "hello", type: "paragraph", text: "Hi {{first_name}},\n\nThanks for your note. I reviewed the details for {{company_name}} and the next step is {{next_step}}." }, { id: "next", type: "paragraph", text: `If that works, reply here and ${pack.tenant.founder.fullName} will take care of the rest.` }, { id: "cta", type: "button", text: "Book a call", url: `${pack.tenant.brand.siteUrl}/contact` }];
  const draft = state.emailDrafts[template.id]; const blocks = draft?.blocks || defaultBlocks; const sampleData = { first_name: pack.people[0]!.name.split(" ")[0]!, company_name: pack.people[0]!.company, next_step: "a short operating review", appointment_time: "Thursday at 10:00 AM", owner_name: pack.tenant.founder.fullName, proposal_name: "your scope", start_date: "next week" };
  const subjectTemplate = draft?.subjectTemplate || template.subject; const previewText = draft?.previewText || `A clear next step from ${pack.name}.`;
  return { schemaReady: true, ...template, subjectTemplate, bodyTemplate: blocks.map((block) => block.text || "").join("\n\n"), blocks, previewText, sampleData, subject: interpolateDemoEmail(subjectTemplate, sampleData), html: demoEmailHtml(blocks, sampleData, pack.tenant.brand), source: draft || template.hasDraft ? "draft" as const : template.source } satisfies DemoEmailStudioDetail;
}

function campaigns(pack: DemoScenarioPack) {
  return pack.content.campaignNames.map((name, index) => ({
    id: `campaign-${index + 1}`, name, status: index === 0 ? "active" : index === 1 ? "paused" : "review", version: 2,
    approved_version: index < 2 ? 2 : null, approved_at: index < 2 ? ago(48 + index * 12) : null,
    sender_email: pack.tenant.founder.email,
    policy: { daily_limit: 25, stop_on_reply: true, stop_on_booking: true, stop_on_bounce: true, stop_on_unsubscribe: true },
    campaign_steps: [0, 1, 2].map((step) => ({ id: `campaign-${index + 1}-step-${step}`, step_order: step + 1, delay_days: step * 3, subject_template: ["A useful next step", "Any questions I can answer?", "Closing the loop"][step]! })),
    campaign_members: pack.people.slice(index * 5, index * 5 + 8).map((contact, memberIndex) => ({ id: `member-${index}-${memberIndex}`, status: memberIndex < 5 ? "active" : "completed", current_step: Math.min(3, memberIndex % 4), next_send_at: memberIndex < 5 ? new Date(Date.now() + (memberIndex + 1) * 86_400_000).toISOString() : null, stop_reason: memberIndex >= 5 ? "replied" : null, send_attempts: memberIndex % 3 })),
    created_at: ago(240 + index * 60),
  }));
}

function bookings(pack: DemoScenarioPack) {
  const opportunities = opportunityRows(pack, initialState()).slice(0, 12).map((item, index) => ({
    id: item.id, email: item.email, company_website: `https://${item.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
    role: person(pack, pack.opportunities[index]!.personId).role.toLowerCase().replace(/[^a-z0-9]+/g, "_"), revenue_band: ["under_500k", "500k_to_2m", "2m_to_10m"][index % 3]!,
    primary_leak: ["slow_follow_up", "manual_scheduling", "unclear_attribution"][index % 3]!, qualified: index !== 10,
    stage: ["qualified", "booked", "showed", "proposal", "won", "no_show"][index % 6]!, scheduled_at: index % 4 === 0 ? null : new Date(Date.now() + (index - 2) * 86_400_000).toISOString(),
    utm_source: ["google", "referral", "email"][index % 3]!, utm_campaign: "demo-growth-loop", estimated_value: item.estimated_value, won_value: index % 6 === 4 ? item.estimated_value : 0, created_at: item.created_at,
  }));
  const count = (stage: string) => opportunities.filter((item) => item.stage === stage).length;
  return { opportunities, metrics: { total: opportunities.length, qualified: opportunities.filter((item) => item.qualified).length, booked: count("booked"), showed: count("showed"), noShow: count("no_show"), won: count("won"), pipelineValue: opportunities.reduce((sum, item) => sum + item.estimated_value, 0), wonRevenue: opportunities.reduce((sum, item) => sum + item.won_value, 0), qualifiedToBooked: 67, bookedToShowed: 83 } };
}

function aiRuns(pack: DemoScenarioPack) {
  const runs = Array.from({ length: 8 }, (_, index) => ({ id: `ai-run-${index}`, surface: ["command_center", "conversation_brief", "pipeline_review"][index % 3]!, provider: "openrouter", model: "bounded-demo-model", toolPack: index % 2 ? "pipeline" : "core", conversationId: pack.conversations[index % pack.conversations.length]!.id, status: index === 6 ? "failed" : "completed", toolNames: index % 2 ? ["search_pipeline", "get_record_timeline"] : ["get_today_snapshot"], inputTokens: 680 + index * 91, outputTokens: 210 + index * 37, durationMs: 1200 + index * 180, promptPreview: `Review the next best action for ${pack.people[index]!.company}.`, resultPreview: `Reviewed the relevant fictional records and prepared a grounded next step for ${pack.people[index]!.name}.`, error: index === 6 ? "Simulated provider timeout; no external action occurred." : null, startedAt: ago(index * 8 + 1), finishedAt: ago(index * 8 + .9), feedback: index % 4 === 0 ? "helpful" : null }));
  const completed = runs.filter((run) => run.status === "completed").length;
  return { schemaReady: true, degraded: false, degradationReasons: [], runs, metrics: { runs: runs.length, completed, partial: 0, failed: runs.length - completed, cancelled: 0, successRate: Math.round(completed / runs.length * 100), totalTokens: runs.reduce((sum, run) => sum + run.inputTokens + run.outputTokens, 0), medianDurationMs: 1830, feedbackCoverage: 25 }, facets: { surfaces: [...new Set(runs.map((run) => run.surface))], models: ["bounded-demo-model"], packs: ["core", "pipeline"], tools: [...new Set(runs.flatMap((run) => run.toolNames))] }, nextCursor: null, summaryTruncated: false, generatedAt: new Date().toISOString() };
}

function aiRunDetail(pack: DemoScenarioPack, runId: string) {
  const run = aiRuns(pack).runs.find((item) => item.id === runId) || aiRuns(pack).runs[0]!;
  const opportunity = pack.opportunities[Number(run.id.split("-").at(-1) || 0) % pack.opportunities.length]!;
  return { schemaReady: true, degraded: false, degradationReasons: [], run, events: [
    { id: `${run.id}-context`, type: "context_loaded", label: "Business context", summary: "Loaded a bounded fictional priority and pipeline snapshot.", toolName: null, status: "recorded", createdAt: run.startedAt },
    { id: `${run.id}-tool`, type: run.status === "failed" ? "tool_error" : "tool_result", label: run.toolNames[0]!.replace(/_/g, " "), summary: run.status === "failed" ? "The simulated provider timed out without changing data." : "Completed with bounded fictional evidence.", toolName: run.toolNames[0], status: run.status === "failed" ? "failed" : "completed", createdAt: run.finishedAt || run.startedAt },
    { id: `${run.id}-response`, type: "model_response", label: "Model response", summary: "Recorded a bounded answer and its operating metadata.", toolName: null, status: "recorded", createdAt: run.finishedAt || run.startedAt },
  ], eventsTruncated: false, affectedRecords: [{ type: "opportunity", id: opportunity.id, href: `/admin/pipeline/${opportunity.id}` }] };
}

function aiCapabilities() {
  const rows = [
    ["get_today_snapshot", "Read today snapshot", "Read the prioritized operator queue and current revenue summary.", "read", false, ["core"]],
    ["search_pipeline", "Search pipeline", "Find canonical opportunities by company, stage, or contact.", "read", false, ["pipeline"]],
    ["get_record_timeline", "Read record timeline", "Inspect bounded activity evidence for one canonical record.", "read", false, ["core", "pipeline"]],
    ["propose_task", "Stage task", "Prepare an operator task for founder review.", "internal_write", true, ["core"]],
    ["propose_stage_change", "Stage pipeline change", "Prepare an evidence-backed pipeline movement for review.", "internal_write", true, ["pipeline"]],
    ["propose_send_email", "Stage email", "Prepare an outbound email without sending it directly.", "external_action", true, ["outreach"]],
    ["propose_campaign_activation", "Stage campaign activation", "Prepare activation of a reviewed campaign version.", "external_action", true, ["outreach"]],
  ].map(([name, label, description, impact, confirmationRequired, packs]) => ({ name, label, description, impact, confirmationRequired, packs, state: "registered_policy", operationalReadiness: "not_evaluated" }));
  return { registryVersion: "revenue-os-tools.v2", scope: "registry_policy", readinessEvaluated: false, capabilities: rows, safety: { registeredReads: 3, registeredInternalWrites: 2, registeredExternalActions: 2, registeredDestructiveActions: 0, readsMayExecuteDirectly: true, writesRequireApproval: true, externalActionsRequireApproval: true, destructiveActionsAvailable: false } };
}

function integrationCatalog(pack: DemoScenarioPack) {
  const providers = [
    ["supabase", "Supabase", "System of record", "Canonical records, authentication, receipts, and realtime state.", "ready"],
    ["google", "Google Workspace", "Primary operating context", "Gmail, Calendar, and selected Drive knowledge.", "ready"],
    ["resend", "Resend", "Auditable delivery", "Transactional and campaign email with delivery receipts.", "ready"],
    ["openrouter", "OpenRouter", "Model gateway", "Bounded analysis, drafting, and registered tools.", "ready"],
    ["stripe", "Stripe", "Payment truth", "Payments and invoices linked to revenue context.", "available"],
    ["slack", "Slack", "Approval surface", "Briefs and alerts that link back to canonical work.", "planned"],
  ].map(([id, name, strategicRole, description, status], index) => ({ id, name, category: index < 4 ? "foundation" : "revenue", maturity: index < 4 ? "native" : "next", priority: index + 1, description, strategicRole, cost: { tier: "free", label: index === 3 ? "Usage based" : "Free-first", detail: "The demo models a measured free-first operating posture." }, auth: "Scoped credentials with least privilege", transports: ["api"], dataClasses: ["Bounded operating data"], setupHref: "/admin/setup", docsHref: "/admin/setup", limits: ["Receipts are required", "External actions remain approval-gated"], guardrail: "The integration cannot bypass domain services or human confirmation.", status, statusReason: status === "ready" ? "Behavior verified in this fictional workspace" : status === "available" ? "Available to configure" : "Planned by client demand", accountLabel: status === "ready" ? pack.tenant.founder.email : null, lastEvidenceAt: status === "ready" ? ago(index + 1) : null, capabilities: [{ id: `${id}-core`, label: `${name} core`, description, direction: "bidirectional", impact: "internal_write", status, statusReason: status === "ready" ? "Behavior verified" : status === "available" ? "Available to configure" : "Planned", lastEvidenceAt: status === "ready" ? ago(index + 1) : null }] }));
  return { registryVersion: "demo-integrations.v1", generatedAt: new Date().toISOString(), evidenceAvailable: true, summary: { ready: 4, degraded: 0, action: 0, available: 1, planned: 1, total: 6, live: 4, attention: 0 }, providers };
}

function setup(pack: DemoScenarioPack) {
  const checks = [
    ["supabase", "core", "Canonical database", "Stores operating records and receipts.", "ready", true],
    ["email", "email", "Email delivery", "Sends approved transactional and campaign email.", "ready", true],
    ["google", "google", "Google Workspace", "Links Gmail, Calendar, and selected Drive knowledge.", "ready", true],
    ["openrouter", "ai", "Governed AI", "Runs bounded intelligence with tool and usage receipts.", "ready", true],
    ["campaigns", "campaigns", "Campaign safety", "Previews exclusions and stops automatically on replies.", "ready", true],
    ["payments", "operations", "Payment connection", "Adds verified payment truth when the business is ready.", "optional", false],
  ].map(([id, group, label, accomplishes, status, required]) => ({ id, group, label, description: accomplishes, accomplishes, status, required, lastSuccessAt: status === "ready" ? ago(2) : null, lastFailure: null, action: { label: status === "ready" ? "Review evidence" : "Plan connection", href: "/admin/integrations" } }));
  return { checks, bookingMode: "manual", google: { accountEmail: pack.tenant.founder.email, connected: true, settings: { drive_folder_ids: ["fictional-selected-folder"] }, scopes: ["gmail.readonly", "calendar.events", "drive.readonly"] }, summary: { requiredReady: 5, requiredTotal: 5, optionalReady: 0, optionalTotal: 1, launchReady: true, percent: 100, degraded: 0 } };
}

function proposals(pack: DemoScenarioPack) {
  return pack.opportunities.slice(0, 7).map((opportunity, index) => { const contact = person(pack, opportunity.personId); return { id: `proposal-${index + 1}`, lead_id: contact.id, client_name: opportunity.company, share_token: `fictional-${index + 1}`, title: opportunity.name, content: { sections: [{ title: "Executive summary", content: `A focused scope for ${opportunity.company}.` }, { title: "Recommended solution", content: opportunity.nextAction }, { title: "Success measures", content: "Faster response, clearer ownership, and measurable follow-through." }] }, total_one_time: opportunity.value, total_monthly: index % 3 === 0 ? 950 + index * 125 : 0, status: ["viewed", "sent", "accepted", "draft"][index % 4]!, sent_at: index % 4 === 3 ? null : ago(30 + index * 11), viewed_at: index % 4 < 2 ? ago(20 + index * 8) : null, responded_at: index % 4 === 2 ? ago(12 + index) : null, created_at: ago(120 + index * 24) }; });
}

function emailSequences(pack: DemoScenarioPack) {
  const sequences = pack.people.slice(0, 16).map((contact, index) => ({ id: `sequence-${index}`, email: contact.email, sequence_type: ["plan_nurture", "resource_welcome", "grader_followup"][index % 3]!, current_step: index % 5 + 1, status: index < 9 ? "active" : index < 13 ? "completed" : index < 15 ? "paused" : "unsubscribed", metadata: { resend_email_ids: [`fictional-email-${index}`] }, created_at: ago(80 + index * 9) }));
  return { sequences, stats: { active: 9, completed: 4, paused: 2, unsubscribed: 1, total: 16 }, totalPages: 1 };
}

function clients(pack: DemoScenarioPack) {
  const clients = pack.people.slice(0, 9).map((contact, index) => ({ id: `client-${index}`, business_name: contact.company, contact_name: contact.name, contact_email: contact.email, industry: pack.category, status: index < 6 ? "active" : index === 6 ? "onboarding" : index === 7 ? "paused" : "churned", monthly_value: index < 7 ? 1200 + index * 275 : 0, one_time_value: 1800 + index * 450, contract_start: dateOffset(-120 + index * 9), contract_end: dateOffset(245 + index * 12), created_at: ago(900 + index * 120) }));
  return { clients, totalMRR: clients.reduce((sum, item) => sum + item.monthly_value, 0), activeCount: clients.filter((item) => item.status === "active").length };
}

function contentItems(pack: DemoScenarioPack) {
  return pack.content.contentTitles.map((title, index) => ({ id: `content-${index}`, title, slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`, status: ["idea", "outline", "draft", "review", "published"][index % 5]!, category: ["lead-generation", "operations", "industry", "foundational"][index % 4]!, target_keywords: [pack.category.toLowerCase(), ...title.toLowerCase().split(" ").slice(0, 2)], pillar: ["Demand", "Operations", "Industry", "Foundational"][index % 4]!, funnel_stage: ["awareness", "consideration", "decision"][index % 3]!, target_publish_date: dateOffset(index * 5 - 8), actual_publish_date: index % 5 === 4 ? dateOffset(-index) : undefined, author: pack.tenant.founder.fullName, notes: `Fictional editorial brief grounded in the current ${pack.category.toLowerCase()} workspace.`, seo_title: `${title} | ${pack.name}`, seo_description: `A specific operating resource from ${pack.name}.`, word_count_target: 900 + index * 100, created_at: ago(240 + index * 24), updated_at: ago(index * 5 + 1) }));
}

function featureBoard(pack: DemoScenarioPack) {
  const titles = pack.content.roadmapTitles;
  return titles.map((title, index) => ({ id: `feature-${index}`, seed_key: `demo-${index}`, title, description: `${title} adapted to the operating model for ${pack.name}.`, status: ["backlog", "planned", "in_progress", "blocked", "shipped"][index % 5]!, priority: index < 3 ? "high" : index < 10 ? "medium" : "low", labels: [`milestone:${index % 5 === 4 ? "done" : index < 7 ? "now" : "next"}`, `category:${["revenue", "delivery", "intelligence", "system"][index % 4]}`, `capability:${["automation", "reporting", "integration"][index % 3]}`], sort_order: (index + 1) * 1000, owner: index % 2 ? pack.tenant.founder.fullName : "Implementation partner", target_date: dateOffset(index * 6 + 10), acceptance_criteria: "The workflow is observable, reversible, and verified on desktop and mobile.", notes: "Fictional roadmap item for demonstration.", source: "demo_scenario", archived_at: null, created_at: ago(700 + index * 20), updated_at: ago(index * 4 + 1) }));
}

function settings(pack: DemoScenarioPack) {
  const values: Array<[string, string, boolean, string]> = [
    ["OPENROUTER_API_KEY", "••••••••demo", true, "Bounded model gateway credential"], ["RESEND_API_KEY", "••••••••demo", true, "Recorded email delivery credential"], ["CRON_SECRET", "••••••••demo", true, "Authenticated scheduler secret"],
    ["RESEND_FROM_EMAIL", pack.tenant.founder.email, false, "Verified sender identity"], ["ADMIN_EMAIL", pack.tenant.founder.email, false, "Primary operator inbox"], ["NEXT_PUBLIC_PLAUSIBLE_DOMAIN", pack.tenant.brand.domain, false, "Privacy-minimized analytics domain"], ["SITE_URL", pack.tenant.brand.siteUrl, false, "Fictional public site"], ["BUSINESS_NAME", pack.name, false, "Workspace business name"],
    ["NOTIFY_NEW_LEADS", "true", false, "Notify on new inquiries"], ["NOTIFY_NEW_CONTACTS", "true", false, "Notify on contact forms"], ["NOTIFY_HOT_LEADS", "true", false, "Notify on high-fit inquiries"], ["NOTIFY_PROPOSAL_VIEWED", "true", false, "Notify on proposal views"], ["NOTIFY_TASK_OVERDUE", "true", false, "Notify on overdue tasks"], ["NOTIFY_CONTRACT_EXPIRING", "false", false, "Notify on expiring agreements"],
  ];
  return { settings: values.map(([key, value, is_secret, description], index) => ({ key, value, is_secret, description, updated_at: ago(index + 2) })) };
}

function importBatch(pack: DemoScenarioPack) {
  const rows = pack.people.slice(0, 5).map((contact, index) => ({ id: `import-row-${index}`, row_index: index + 1, status: "proposed", action: index === 3 ? "update" : "create", included: true, confidence: index === 4 ? "medium" : "high", reviewed_data: { fullName: contact.name, email: contact.email, phone: contact.phone, companyName: contact.company, role: contact.role, website: null, industry: pack.category, source: "community event", notes: "Fictional import candidate" }, warnings: index === 4 ? ["Confirm the company name before approval"] : [], errors: [], match_reason: index === 3 ? "Matched an existing email" : null, matched_contact_id: index === 3 ? contact.id : null, imported_contact_id: null, error: null }));
  return { id: "demo-import-batch", status: "needs_review", source_type: "pasted_text", original_filename: "community-contacts.csv", source_row_count: 5, proposed_row_count: 5, selected_row_count: 5, review_digest: "fictional-review-digest", approval_digest: null, ai_model: "bounded-demo-model", summary: { create: 4, update: 1, skip: 0 }, error: null, approved_by: null, approved_at: null, completed_at: null, created_at: ago(20), updated_at: ago(2), rows };
}
function legacy(pack: DemoScenarioPack, path: string) {
  const contacts = pack.people.map((item, index) => { const resource = pack.content.resourceTitles[index % pack.content.resourceTitles.length]!; return ({ id: item.id, name: item.name, email: item.email, contact_name: item.name, contact_email: item.email, phone: item.phone, contact_phone: item.phone, business_name: item.company, business_type: pack.category, industry: pack.category.toLowerCase().replace(/\s/g, "_"), message: pack.conversations[index % pack.conversations.length]!.messages[0]!.body, lead_status: pack.opportunities[index % pack.opportunities.length]!.stage, status: index % 4 === 0 ? "new" : "active", created_at: new Date(Date.now() - index * 86_400_000).toISOString(), subscribed_at: new Date(Date.now() - index * 86_400_000).toISOString(), resource_id: resource.toLowerCase().replace(/[^a-z0-9]+/g, "-"), resource_name: resource, downloaded_at: new Date(Date.now() - index * 86_400_000).toISOString(), company: item.company, website: `https://${item.company.toLowerCase().replace(/[^a-z]+/g, "")}.example`, score: 68 + index % 28 }); });
  if (path === "/api/admin/leads") return { leads: contacts.slice(0, 18), total: 18, totalPages: 1, page: 1 };
  if (path === "/api/admin/contacts") return { contacts: contacts.slice(0, 16), total: 16, totalPages: 1, page: 1, canonicalSchemaReady: true };
  if (path === "/api/admin/chat-leads") return { leads: contacts.slice(2, 10), total: 8, totalPages: 1, page: 1, canonicalSchemaReady: true };
  if (path === "/api/admin/subscribers") return { subscribers: contacts.slice(0, 20), total: 20, totalPages: 1, page: 1, canonicalSchemaReady: true, stats: { total: 20, active: 18, unsubscribed: 2 } };
  if (path === "/api/admin/resources") return { downloads: contacts.slice(0, 14), total: 14, totalPages: 1, page: 1, canonicalSchemaReady: true, stats: { totalDownloads: 14, uniqueUsers: 12 } };
  if (path === "/api/admin/partners") return { partners: contacts.filter((item) => item.id).slice(0, 8).map((item, index) => ({ ...item, organization: item.business_name, partnership_type: index % 2 ? "referral" : "community", status: index < 3 ? "new" : "contacted" })), total: 8, totalPages: 1, page: 1, canonicalSchemaReady: true };
  if (path === "/api/admin/website-grades") return { grades: contacts.slice(0, 10).map((item) => ({ ...item, url: item.website, overall_score: item.score, email: item.contact_email })), total: 10, totalPages: 1, page: 1, canonicalSchemaReady: true };
  return null;
}

export function installAdminDemoRuntime(scenarioId: DemoScenarioId) {
  const pack = DEMO_SCENARIOS[scenarioId]; const state = loadState(scenarioId); const nativeFetch = window.fetch.bind(window); const nativeOpen = window.open.bind(window);
  const reset = () => { sessionStorage.removeItem(keyFor(scenarioId)); clearDemoAppearance(scenarioId); window.location.reload(); };
  const demoFetch: typeof window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url; const url = new URL(raw, window.location.origin); const path = url.pathname; const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!path.startsWith("/api/admin")) {
      if (["/api/chat", "/api/analytics/events"].includes(path) || path.startsWith("/api/cron") || path.startsWith("/api/webhooks")) return jsonResponse({ error: "Blocked by the fictional demo runtime" }, 403);
      return nativeFetch(input, init);
    }
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
    if (method === "GET" && path === "/api/admin/inbox") return jsonResponse(inbox(pack));
    if (method === "GET" && path === "/api/admin/emails/preview") {
      const id = url.searchParams.get("id");
      return jsonResponse(id ? emailStudio(pack, id, state) : emailStudio(pack, null, state));
    }
    if (method === "POST" && path === "/api/admin/emails/preview" && body.action === "render") {
      const template = emailStudio(pack, String(body.id || ""), state);
      const blocks = Array.isArray(body.blocks) ? body.blocks as DemoEmailBlock[] : template.blocks;
      return jsonResponse({ subject: interpolateDemoEmail(String(body.subjectTemplate || template.subjectTemplate), template.sampleData), html: demoEmailHtml(blocks, template.sampleData, pack.tenant.brand), text: blocks.map((block) => block.text || "").join("\n\n") });
    }
    if (method === "PATCH" && path === "/api/admin/emails/preview") {
      const id = String(body.id || "");
      if (!id || !Array.isArray(body.blocks)) return jsonResponse({ error: "A complete simulated email is required." }, 400);
      const current = emailStudio(pack, id, state);
      state.emailDrafts[id] = { subjectTemplate: String(body.subjectTemplate || current.subjectTemplate), previewText: String(body.previewText || current.previewText), blocks: body.blocks as DemoEmailBlock[] };
      saveState(scenarioId, state);
      return jsonResponse({ success: true, simulated: true });
    }
    if (method === "POST" && path === "/api/admin/emails/preview" && (body.action === "test" || body.action === "publish")) return jsonResponse({ success: true, simulated: true, to: `${pack.tenant.founder.email}` });
    if (method === "DELETE" && path === "/api/admin/emails/preview") { delete state.emailDrafts[url.searchParams.get("id") || ""]; saveState(scenarioId, state); return jsonResponse({ success: true, simulated: true }); }
    if (method === "GET" && path === "/api/admin/emails/history") return jsonResponse({ history: pack.conversations.flatMap((conversation, index) => conversation.messages.filter((message) => message.direction === "outbound").map((message) => { const contact = person(pack, conversation.personId); return { id: message.id, to: contact.email, toName: contact.name, subject: conversation.subject, body: message.body, status: "delivered", providerId: `demo-provider-${index}`, template: index % 2 ? "appointment-confirmation" : "inquiry-reply", sentAt: message.at, source: "fictional_demo" }; })) });
    if (method === "GET" && path === "/api/admin/revenue-os/campaigns") return jsonResponse({ schemaReady: true, campaigns: campaigns(pack) });
    if (method === "GET" && path === "/api/admin/revenue-os/campaigns/preview") {
      const campaign = campaigns(pack).find((item) => item.id === url.searchParams.get("id")) || campaigns(pack)[0]!;
      return jsonResponse({ campaign, policy: campaign.policy, steps: campaign.campaign_steps.map((step) => ({ ...step, body_template: "Hi {{first_name}}, here is the useful next step we discussed." })), totals: { members: campaign.campaign_members.length, eligible: campaign.campaign_members.filter((item) => item.status === "active").length, excluded: campaign.campaign_members.filter((item) => item.status !== "active").length }, exclusions: pack.people.slice(20, 22).map((item) => ({ email: item.email, reason: "Existing reply or suppression" })), samples: pack.people.slice(0, 3).map((item) => ({ email: item.email, subject: campaign.campaign_steps[0]!.subject_template, body: `Hi ${item.name.split(" ")[0]}, here is the useful next step we discussed.` })) });
    }
    if (method === "GET" && path === "/api/admin/bookings") return jsonResponse(bookings(pack));
    if (method === "GET" && path === "/api/admin/revenue-os/ai/runs") return jsonResponse(aiRuns(pack));
    if (method === "GET" && path.startsWith("/api/admin/revenue-os/ai/runs/")) return jsonResponse(aiRunDetail(pack, decodeURIComponent(path.split("/").at(-1) || "")));
    if (method === "GET" && path === "/api/admin/revenue-os/ai/capabilities") return jsonResponse(aiCapabilities());
    if (method === "GET" && path === "/api/admin/integrations") return jsonResponse(integrationCatalog(pack));
    if (method === "GET" && path === "/api/admin/setup") return jsonResponse(setup(pack));
    if (method === "GET" && path === "/api/admin/proposals") { const rows = proposals(pack); const requested = url.searchParams.get("id"); return jsonResponse(requested ? { proposal: rows.find((item) => item.id === requested) || rows[0] } : { proposals: rows, totalOneTime: rows.reduce((sum, item) => sum + item.total_one_time, 0), totalMonthly: rows.reduce((sum, item) => sum + item.total_monthly, 0) }); }
    if (method === "GET" && path === "/api/admin/email-sequences") return jsonResponse(emailSequences(pack));
    if (method === "GET" && path === "/api/admin/clients") return jsonResponse(clients(pack));
    if (method === "GET" && path === "/api/admin/content") return jsonResponse({ items: contentItems(pack) });
    if (method === "GET" && path === "/api/admin/features") return jsonResponse({ schemaReady: true, features: featureBoard(pack) });
    if (method === "GET" && path === "/api/admin/settings") return jsonResponse(settings(pack));
    if (method === "GET" && path === "/api/admin/revenue-os/contact-imports") { const batch = importBatch(pack); return jsonResponse(url.searchParams.get("id") ? { schemaReady: true, batch } : { schemaReady: true, batches: [{ ...batch, rows: undefined }] }); }
    if (method === "POST" && path === "/api/admin/revenue-os/ai/stream") {
      const conversationId = String(body.conversationId || `ai-${scenarioId}`); const runId = `demo-run-${crypto.randomUUID()}`;
      const answer = `For ${pack.name}, the highest-priority move is to handle ${pack.actions[0]!.title.toLowerCase()} first. It is grounded in the latest linked conversation, and this demo will stage—not send—any external action.`;
      return eventStreamResponse([{ type: "conversation", conversationId, userMessageId: `demo-user-${crypto.randomUUID()}` }, { type: "run_started", runId, model: "bounded-demo-model", pack: "operator_brief" }, { type: "tool_started", name: "build_priority_brief", index: 0 }, { type: "tool_completed", name: "build_priority_brief", index: 0, summary: "Reviewed fictional priorities, conversations, and pipeline context.", failed: false }, { type: "assistant_delta", delta: answer }, { type: "final", conversationId, messageId: `demo-assistant-${crypto.randomUUID()}`, runId, text: answer, proposedActions: [] }]);
    }
    if (method === "POST" && path === "/api/admin/revenue-os/contact-imports") return jsonResponse({ schemaReady: true, batch: importBatch(pack) });
    if (method === "POST" && path === "/api/admin/settings/test") return jsonResponse({ success: true, simulated: true });
    if (method !== "GET") {
      if (path === "/api/admin/revenue-os/actions") state.completedActions.push(String(body.id));
      if (["/api/admin/tasks", "/api/admin/revenue-os/tasks"].includes(path)) state.completedTasks.push(String(body.id));
      if (path === "/api/admin/revenue-os/pipeline" && body.id && body.stage) state.stageOverrides[String(body.id)] = String(body.stage);
      if (path === "/api/admin/revenue-os/conversations/reply") { const id = String(body.conversationId); state.sentReplies[id] = [...(state.sentReplies[id] || []), String(body.body || "")]; }
      if (path === "/api/admin/notifications" && body.id) state.readNotifications.push(String(body.id));
      saveState(scenarioId, state); window.dispatchEvent(new Event("admin:demo-state"));
      return jsonResponse({ success: true, simulated: true, receipt: { id: `demo-${crypto.randomUUID()}`, status: "simulated", scenario: scenarioId } });
    }
    if (path === "/api/admin/revenue-os/priority") return jsonResponse(priority(pack, state));
    if (path === "/api/admin/notifications") return jsonResponse(notifications(pack, state));
    if (path === "/api/admin/search") return jsonResponse({ results: pack.people.filter((item) => !url.searchParams.get("q") || `${item.name} ${item.email} ${item.company}`.toLowerCase().includes(url.searchParams.get("q")!.toLowerCase())).slice(0, 10).map((item) => ({ name: item.name, email: item.email, type: item.role })) });
    if (path === "/api/admin/revenue-os/overview") { const rows = opportunityRows(pack, state); const open = rows.filter((item) => !["won", "lost"].includes(item.canonical_stage)); return jsonResponse({ schemaReady: true, generatedAt: new Date().toISOString(), metrics: { openOpportunities: open.length, pipelineValue: open.reduce((sum, item) => sum + item.estimated_value, 0), weightedValue: Math.round(open.reduce((sum, item) => sum + item.estimated_value, 0) * .54), wonRevenue: rows.reduce((sum, item) => sum + item.won_value, 0), unreadConversations: pack.conversations.reduce((sum, item) => sum + item.unread, 0), activeCampaigns: 3, pendingProposals: 4 }, queue: queue(pack, state), integrations: [], health: { status: "attention", attentionCount: 1, integrations: [{ provider: "Google Workspace", status: "ready", lastSuccessAt: new Date().toISOString(), lastError: null }, { provider: "Resend", status: "ready", lastSuccessAt: ago(2), lastError: null }, { provider: "QuickBooks", status: "degraded", lastSuccessAt: ago(30), lastError: "A simulated sync needs review" }], sourceRuns: [{ key: "gmail-sync", status: "success", startedAt: ago(2), finishedAt: ago(2), error: null }], jobRuns: [{ key: "daily-priority", status: "success", startedAt: ago(1), finishedAt: ago(1), error: null }] } }); }
    if (path === "/api/admin/revenue-os/actions") return jsonResponse({ actions: pack.actions.filter((item) => !state.completedActions.includes(item.id)).map((item, index) => ({ id: item.id, action_type: item.type, title: item.title, description: item.description, urgency: index < 2 ? "high" : "normal", reasoning: item.description, status: "pending", created_at: ago(index + 1), expires_at: new Date(Date.now() + 4 * 86_400_000).toISOString(), payload: item.type === "send_gmail_reply" ? { to: person(pack, item.personId).email, subject: pack.conversations[index]!.subject, body: item.body } : { opportunityId: pack.opportunities[index]!.id, stage: "proposal", reason: item.description } })) });
    if (path === "/api/admin/revenue-os/pipeline") return jsonResponse({ schemaReady: true, signalsReady: { calendar: true }, opportunities: opportunityRows(pack, state) });
    if (path === "/api/admin/revenue-os/conversations") return jsonResponse(conversations(pack, state, url.searchParams.get("id")));
    if (path === "/api/admin/revenue-os/analytics") return jsonResponse(analytics(pack, state));
    if (path === "/api/admin/contacts/timeline") {
      const requestedEmail = (url.searchParams.get("email") || "").toLowerCase();
      const contact = pack.people.find((item) => item.email.toLowerCase() === requestedEmail) || pack.people[0]!;
      const opportunity = pack.opportunities.find((item) => item.personId === contact.id) || pack.opportunities[0]!;
      const conversation = pack.conversations.find((item) => item.personId === contact.id) || pack.conversations[0]!;
      const contactTasks = pack.tasks.filter((item) => item.personId === contact.id).slice(0, 3);
      const timeline = [
        { type: "contact", title: `Website inquiry from ${contact.name}`, description: conversation.messages[0]!.body, timestamp: conversation.messages[0]!.at, sourceId: `submission-${contact.id}`, link: "/admin/contacts" },
        ...conversation.messages.map((message) => ({ type: message.direction === "inbound" ? "message_inbound" : "message_outbound", title: `${message.direction === "inbound" ? "Received" : "Sent"}: ${conversation.subject}`, description: message.body, timestamp: message.at, sourceId: message.id, link: "/admin/conversations" })),
        { type: "opportunity", title: `Pipeline: ${opportunity.name}`, description: `Stage: ${opportunity.stage.replace(/_/g, " ")} · $${opportunity.value.toLocaleString()} · Next: ${opportunity.nextAction}`, timestamp: conversation.messages[0]!.at, sourceId: opportunity.id, link: `/admin/pipeline?search=${encodeURIComponent(contact.email)}` },
        ...contactTasks.map((task, index) => ({ type: "task", title: `Task: ${task.title}`, description: `${task.status} · ${task.priority} priority`, timestamp: ago(index + 2), sourceId: task.id, link: "/admin/today" })),
      ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      return jsonResponse({ timeline, canonical: { schemaReady: true, status: "connected", contact: { id: contact.id, full_name: contact.name, lifecycle_stage: opportunity.stage, communication_status: "active", next_action: opportunity.nextAction, next_action_at: dateOffset(1) }, company: { id: `company-${contact.id}`, name: contact.company, domain: `${contact.company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`, industry: pack.category }, opportunities: [{ id: opportunity.id, stage: opportunity.stage, estimated_value: opportunity.value, won_value: opportunity.stage === "won" ? opportunity.value : 0 }] } });
    }
    if (path === "/api/admin/revenue") { const rows = opportunityRows(pack, state); return jsonResponse({ totalMRR: 18400, totalOneTime: rows.reduce((sum, item) => sum + item.won_value, 0), activeCount: 6, churnRate: 4, avgClientValue: 3067, industryBreakdown: [{ name: pack.category, value: 100 }], byClient: pack.people.slice(0, 6).map((item, index) => ({ name: `${item.company} · ${item.name}`, monthly: 1800 + index * 425, oneTime: index * 900 })), mrrTimeline: ["Apr", "May", "Jun", "Jul", "Aug"].map((date, index) => ({ date, mrr: 11200 + index * 1800 })), proposalRevenue: 24600 }); }
    if (path === "/api/admin/activity") return jsonResponse({ activities: Array.from({ length: 30 }, (_, index) => ({ id: `activity-${index}`, type: ["lead", "email", "task", "proposal"][index % 4], description: `${pack.people[index % pack.people.length]!.name}: ${["record created", "email linked", "task completed", "proposal viewed"][index % 4]}`, timestamp: ago(index * 3 + 1) })) });
    if (path === "/api/admin/revenue-os/ai/conversations") return jsonResponse({ schemaReady: true, conversations: [{ id: `ai-${scenarioId}`, title: `Morning review for ${pack.name}`, lastMessageAt: ago(1) }] });
    if (path.startsWith("/api/admin/revenue-os/ai/conversations/")) return jsonResponse({ messages: [{ id: "ai-welcome", role: "assistant", content: `I am grounded in this fictional ${pack.name} workspace. ${pack.story[0]}.`, runId: null, createdAt: ago(1) }] });
    const legacyPayload = legacy(pack, path); if (legacyPayload) return jsonResponse(legacyPayload);
    if (path === "/api/admin/revenue-os/tasks") return jsonResponse({ tasks: pack.tasks.filter((item) => !state.completedTasks.includes(item.id)) });
    if (path === "/api/admin/tasks") return jsonResponse({ tasks: pack.tasks.filter((item) => !state.completedTasks.includes(item.id)).map((item) => ({ ...item, due_date: dateOffset(item.dueOffset), contact_email: person(pack, item.personId).email })) });
    if (path === "/api/admin/google/sync") return jsonResponse({ success: true, simulated: true });
    return jsonResponse({ items: [], data: [], schemaReady: true, simulated: true });
  };
  window.fetch = demoFetch;
  window.open = ((url?: string | URL, target?: string, features?: string) => { const value = String(url || ""); if (value.startsWith("/api/admin")) { const blob = new Blob([`name,email,scenario\n${pack.people.slice(0, 8).map((item) => `${item.name},${item.email},${scenarioId}`).join("\n")}`], { type: "text/csv" }); return nativeOpen(URL.createObjectURL(blob), target, features); } return nativeOpen(url, target, features); }) as typeof window.open;
  return { pack, reset, restore: () => { window.fetch = nativeFetch; window.open = nativeOpen; } };
}
