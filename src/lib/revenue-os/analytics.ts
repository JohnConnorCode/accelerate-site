import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalStage } from "./pipeline";

type WebsiteEvent = { event_name: string; path: string; visitor_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer_host: string | null };

const percentage = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;

function ranked(rows: Map<string, number>, limit = 6) {
  return [...rows.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

export async function loadRevenueAnalytics(supabase: SupabaseClient, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from("opportunities").select("id,stage,source,source_detail,estimated_value,won_value,created_at").gte("created_at", since).limit(2000);
  if (error) throw new Error(error.message);
  const opportunities = data ?? [];
  const stage = (name: string) => opportunities.filter((item) => canonicalStage(item.stage) === name);
  const qualified = opportunities.filter((item) => ["qualified", "meeting", "proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const meetings = opportunities.filter((item) => ["meeting", "proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const proposals = opportunities.filter((item) => ["proposal", "negotiation", "won"].includes(canonicalStage(item.stage) || ""));
  const won = stage("won");
  const bySource = new Map<string, { opportunities: number; won: number; revenue: number }>();
  for (const item of opportunities) { const key = item.source_detail || item.source || "Unknown"; const row = bySource.get(key) || { opportunities: 0, won: 0, revenue: 0 }; row.opportunities++; if (canonicalStage(item.stage) === "won") { row.won++; row.revenue += Number(item.won_value || 0); } bySource.set(key, row); }
  const funnel = { opportunities: opportunities.length, qualified: qualified.length, meetings: meetings.length, proposals: proposals.length, won: won.length, wonRevenue: won.reduce((sum, item) => sum + Number(item.won_value || 0), 0), pipelineValue: opportunities.filter((item) => !["won", "lost"].includes(canonicalStage(item.stage) || item.stage)).reduce((sum, item) => sum + Number(item.estimated_value || 0), 0) };
  return {
    windowDays: days, generatedAt: new Date().toISOString(), cohort: "Opportunities created in the selected window and their current furthest stage.", funnel,
    rates: { qualified: percentage(funnel.qualified, funnel.opportunities), meeting: percentage(funnel.meetings, funnel.qualified), proposal: percentage(funnel.proposals, funnel.meetings), win: percentage(funnel.won, funnel.proposals), inquiryToWin: percentage(funnel.won, funnel.opportunities) },
    attribution: { missing: opportunities.filter((item) => !item.source && !item.source_detail).length },
    sources: [...bySource.entries()].map(([source, value]) => ({ source, ...value })).sort((a, b) => b.revenue - a.revenue || b.opportunities - a.opportunities),
  };
}

/** First-party website analytics. This is intentionally separate from revenue truth. */
export async function loadWebsiteAnalytics(supabase: SupabaseClient, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from("website_events").select("event_name,path,visitor_id,utm_source,utm_medium,utm_campaign,referrer_host").gte("created_at", since).limit(10000);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as WebsiteEvent[];
  const pageViews = events.filter((event) => event.event_name === "page_view");
  const conversions = events.filter((event) => event.event_name !== "page_view");
  const pages = new Map<string, number>(), sources = new Map<string, number>(), conversionNames = new Map<string, number>();
  for (const event of pageViews) pages.set(event.path, (pages.get(event.path) || 0) + 1);
  for (const event of events) {
    const source = event.utm_source || event.referrer_host || "Direct / unknown";
    sources.set(source, (sources.get(source) || 0) + 1);
  }
  for (const event of conversions) conversionNames.set(event.event_name.replaceAll("_", " "), (conversionNames.get(event.event_name.replaceAll("_", " ")) || 0) + 1);
  return { status: "ready" as const, pageViews: pageViews.length, visitors: new Set(pageViews.map((event) => event.visitor_id)).size, conversions: conversions.length, conversionRate: percentage(conversions.length, pageViews.length), topPages: ranked(pages), sources: ranked(sources), conversionEvents: ranked(conversionNames), eventCount: events.length, lastCapturedAt: events.length ? new Date().toISOString() : null };
}
