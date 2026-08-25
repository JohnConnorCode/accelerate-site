import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalStage } from "./pipeline";

type WebsiteEvent = { event_name: string; path: string; visitor_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer_host: string | null };

const percentage = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;

function ranked(rows: Map<string, number>, limit = 6) {
  return [...rows.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

export async function loadRevenueAnalytics(supabase: SupabaseClient, input: number | RevenueAnalyticsFilters) {
  const filters = typeof input === "number" ? { days: input } : input;
  const since = new Date(Date.now() - filters.days * 86400000).toISOString();
  const { data, error } = await supabase.from("opportunities").select("id,stage,source,source_detail,campaign_id,owner_email,next_action,next_action_at,estimated_value,won_value,probability,created_at").gte("created_at", since).limit(2000);
  if (error) throw new Error(error.message);
  const allOpportunities = data ?? [];
  const summary = summarizeRevenueAnalytics(allOpportunities, { ...filters, since });
  const opportunityIds = summary.opportunityIds;
  const [conversations, stageEvents] = await Promise.all([
    opportunityIds.length ? supabase.from("conversations").select("id").in("opportunity_id", opportunityIds).limit(2000) : Promise.resolve({ data: [], error: null }),
    opportunityIds.length ? supabase.from("stage_events").select("from_stage,to_stage").in("opportunity_id", opportunityIds).limit(5000) : Promise.resolve({ data: [], error: null }),
  ]);
  let communication: ReturnType<typeof summarizeReplySignals> & { status: "ready" | "degraded"; reason?: string };
  if (conversations.error) {
    communication = { status: "degraded", reason: "Conversation analytics are unavailable.", inboundConversations: 0, repliedConversations: 0, replyRate: null, medianResponseHours: null };
  } else {
    const conversationIds = (conversations.data ?? []).map((item) => item.id);
    const messages = conversationIds.length ? await supabase.from("messages").select("conversation_id,direction,created_at,sent_at,received_at").in("conversation_id", conversationIds).limit(10000) : { data: [], error: null };
    communication = messages.error
      ? { status: "degraded", reason: "Message analytics are unavailable.", inboundConversations: 0, repliedConversations: 0, replyRate: null, medianResponseHours: null }
      : { status: "ready", ...summarizeReplySignals(messages.data ?? []) };
  }
  const impossibleStageSequences = stageEvents.error ? null : (stageEvents.data ?? []).filter((event) => {
    const from = event.from_stage ? canonicalStage(event.from_stage) : null;
    const to = canonicalStage(event.to_stage);
    return !to || (event.from_stage && !from) || (from && to === from);
  }).length;
  const { opportunityIds: _opportunityIds, ...publicSummary } = summary;
  void _opportunityIds;
  return { ...publicSummary, communication, quality: { ...summary.quality, impossibleStageSequences } };
}

export interface RevenueAnalyticsFilters {
  days: number;
  source?: string;
  owner?: string;
  campaign?: string;
  stage?: string;
}

type AnalyticsOpportunity = {
  id: string; stage: string; source: string | null; source_detail: string | null; campaign_id: string | null; owner_email: string | null;
  next_action: string | null; next_action_at: string | null; estimated_value: number; won_value: number; probability: number; created_at: string;
};

export function summarizeRevenueAnalytics(allOpportunities: AnalyticsOpportunity[], input: RevenueAnalyticsFilters & { since?: string }) {
  const sourceOf = (item: AnalyticsOpportunity) => item.source_detail || item.source || "Unknown";
  const opportunities = allOpportunities.filter((item) => {
    if (input.source && sourceOf(item) !== input.source) return false;
    if (input.owner && (item.owner_email || "Unassigned") !== input.owner) return false;
    if (input.campaign && (item.campaign_id || "Unassigned") !== input.campaign) return false;
    if (input.stage && canonicalStage(item.stage) !== input.stage) return false;
    return true;
  });
  const stage = (name: string) => opportunities.filter((item) => canonicalStage(item.stage) === name);
  const qualified = opportunities.filter((item) => ["qualified", "meeting", "proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const meetings = opportunities.filter((item) => ["meeting", "proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const proposals = opportunities.filter((item) => ["proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const won = stage("won");
  const bySource = new Map<string, { opportunities: number; won: number; revenue: number }>();
  for (const item of opportunities) { const key = sourceOf(item); const row = bySource.get(key) || { opportunities: 0, won: 0, revenue: 0 }; row.opportunities++; if (canonicalStage(item.stage) === "won") { row.won++; row.revenue += Number(item.won_value || 0); } bySource.set(key, row); }
  const open = opportunities.filter((item) => !["won", "lost"].includes(canonicalStage(item.stage) || item.stage));
  const funnel = { opportunities: opportunities.length, qualified: qualified.length, meetings: meetings.length, proposals: proposals.length, won: won.length, wonRevenue: won.reduce((sum, item) => sum + Number(item.won_value || 0), 0), pipelineValue: open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0) };
  const weightedPipeline = Math.round(open.reduce((sum, item) => sum + Number(item.estimated_value || 0) * Math.min(100, Math.max(0, Number(item.probability || 0))) / 100, 0));
  const filterOptions = {
    sources: [...new Set(allOpportunities.map(sourceOf))].sort(),
    owners: [...new Set(allOpportunities.map((item) => item.owner_email || "Unassigned"))].sort(),
    campaigns: [...new Set(allOpportunities.map((item) => item.campaign_id || "Unassigned"))].sort(),
    stages: [...new Set(allOpportunities.map((item) => canonicalStage(item.stage)).filter(Boolean))].sort(),
  };
  return {
    windowDays: input.days, generatedAt: new Date().toISOString(), cohort: `Opportunities created in the last ${input.days} days, filtered by current record fields. Funnel steps show the furthest stage each selected opportunity has reached.`, funnel,
    rates: { qualified: percentage(funnel.qualified, funnel.opportunities), meeting: percentage(funnel.meetings, funnel.qualified), proposal: percentage(funnel.proposals, funnel.meetings), win: percentage(funnel.won, funnel.proposals), inquiryToWin: percentage(funnel.won, funnel.opportunities) },
    attribution: { missing: opportunities.filter((item) => !item.source && !item.source_detail).length },
    sources: [...bySource.entries()].map(([source, value]) => ({ source, ...value })).sort((a, b) => b.revenue - a.revenue || b.opportunities - a.opportunities),
    forecast: { weightedPipeline, unweightedPipeline: funnel.pipelineValue, method: "Open estimated value multiplied by each opportunity's recorded probability. This is a planning estimate, not booked revenue." },
    quality: {
      missingAttribution: opportunities.filter((item) => !item.source && !item.source_detail).length,
      missingOwner: open.filter((item) => !item.owner_email).length,
      missingNextAction: open.filter((item) => !item.next_action?.trim() || !item.next_action_at).length,
      unrecognizedStage: opportunities.filter((item) => !canonicalStage(item.stage)).length,
    },
    filterOptions,
    appliedFilters: { source: input.source || null, owner: input.owner || null, campaign: input.campaign || null, stage: input.stage || null },
    opportunityIds: opportunities.map((item) => item.id),
  };
}

export function summarizeReplySignals(messages: Array<{ conversation_id: string; direction: string; created_at: string; sent_at?: string | null; received_at?: string | null }>) {
  const byConversation = new Map<string, typeof messages>();
  for (const message of messages) byConversation.set(message.conversation_id, [...(byConversation.get(message.conversation_id) || []), message]);
  const responseHours: number[] = [];
  let inboundConversations = 0;
  let repliedConversations = 0;
  for (const rows of byConversation.values()) {
    const ordered = [...rows].sort((a, b) => Date.parse(a.received_at || a.sent_at || a.created_at) - Date.parse(b.received_at || b.sent_at || b.created_at));
    const inbound = ordered.find((item) => item.direction === "inbound");
    if (!inbound) continue;
    inboundConversations++;
    const inboundAt = Date.parse(inbound.received_at || inbound.created_at);
    const reply = ordered.find((item) => item.direction === "outbound" && Date.parse(item.sent_at || item.created_at) >= inboundAt);
    if (!reply) continue;
    repliedConversations++;
    responseHours.push((Date.parse(reply.sent_at || reply.created_at) - inboundAt) / 3600000);
  }
  responseHours.sort((a, b) => a - b);
  const middle = Math.floor(responseHours.length / 2);
  const median = responseHours.length ? (responseHours.length % 2 ? responseHours[middle]! : (responseHours[middle - 1]! + responseHours[middle]!) / 2) : null;
  return { inboundConversations, repliedConversations, replyRate: percentage(repliedConversations, inboundConversations), medianResponseHours: median === null ? null : Math.round(median * 10) / 10 };
}

/**
 * Passive engagement pings, which say a visitor kept reading, not that they
 * asked for anything. Counting these as conversions inflated the rate from a
 * believable 4% to 57%, which would have made the marketing view worse than
 * useless for deciding anything.
 */
const ENGAGEMENT_EVENTS = /^(scroll_depth|time_on_page|article_read|article_scroll_\d+)$/;

const isEngagement = (name: string) => ENGAGEMENT_EVENTS.test(name);
const isConversion = (name: string) => name !== "page_view" && !isEngagement(name);

/** First-party website analytics. This is intentionally separate from revenue truth. */
export async function loadWebsiteAnalytics(supabase: SupabaseClient, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from("website_events").select("event_name,path,visitor_id,utm_source,utm_medium,utm_campaign,referrer_host").gte("created_at", since).limit(10000);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as WebsiteEvent[];
  const pageViews = events.filter((event) => event.event_name === "page_view");
  const conversions = events.filter((event) => isConversion(event.event_name));
  const engagement = events.filter((event) => isEngagement(event.event_name));
  const pages = new Map<string, number>(), sources = new Map<string, number>(), conversionNames = new Map<string, number>();
  for (const event of pageViews) pages.set(event.path, (pages.get(event.path) || 0) + 1);
  for (const event of events) {
    const source = event.utm_source || event.referrer_host || "Direct / unknown";
    sources.set(source, (sources.get(source) || 0) + 1);
  }
  for (const event of conversions) conversionNames.set(event.event_name.replaceAll("_", " "), (conversionNames.get(event.event_name.replaceAll("_", " ")) || 0) + 1);
  return { status: "ready" as const, pageViews: pageViews.length, visitors: new Set(pageViews.map((event) => event.visitor_id)).size, conversions: conversions.length, engagementEvents: engagement.length, conversionRate: percentage(conversions.length, pageViews.length), topPages: ranked(pages), sources: ranked(sources), conversionEvents: ranked(conversionNames), eventCount: events.length, lastCapturedAt: events.length ? new Date().toISOString() : null };
}
