import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch all counts in parallel
  const [
    todayRes,
    weekRes,
    monthRes,
    totalRes,
    chatLeadsRes,
    partnersRes,
    gradesRes,
    pipelineRes,
    industryRes,
    emailSeqRes,
  ] = await Promise.all([
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    // Chat leads count
    supabase
      .from("chat_leads")
      .select("id", { count: "exact", head: true }),
    // Partner applications count
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true }),
    // Website grades count
    supabase
      .from("website_grades")
      .select("id", { count: "exact", head: true }),
    // Lead pipeline breakdown
    supabase
      .from("solution_requests")
      .select("lead_status"),
    // Top industries
    supabase
      .from("solution_requests")
      .select("industry"),
    // Email sequences
    supabase
      .from("email_sequences")
      .select("status"),
  ]);

  // Chart data for configurable days
  const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLeads } = await supabase
    .from("solution_requests")
    .select("created_at")
    .gte("created_at", daysAgo)
    .order("created_at", { ascending: true });

  // Group by day
  const chartData: { date: string; leads: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0]!;
    const count =
      recentLeads?.filter(
        (l: { created_at: string }) => l.created_at.startsWith(dateStr)
      ).length || 0;
    chartData.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      leads: count,
    });
  }

  // Pipeline breakdown
  const pipeline: Record<string, number> = {};
  (pipelineRes.data || []).forEach((r: { lead_status: string }) => {
    const status = r.lead_status || "new";
    pipeline[status] = (pipeline[status] || 0) + 1;
  });

  // Top industries
  const industries: Record<string, number> = {};
  (industryRes.data || []).forEach((r: { industry: string }) => {
    industries[r.industry] = (industries[r.industry] || 0) + 1;
  });
  const topIndustries = Object.entries(industries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Email sequence stats
  const emailStats = { active: 0, completed: 0, total: 0 };
  (emailSeqRes.data || []).forEach((r: { status: string }) => {
    emailStats.total++;
    if (r.status === "active") emailStats.active++;
    if (r.status === "completed") emailStats.completed++;
  });

  const leadsMonth = monthRes.count || 0;
  const plansGenerated = totalRes.count || 0;
  const conversionRate =
    leadsMonth > 0
      ? `${Math.round((plansGenerated / Math.max(leadsMonth, 1)) * 100)}%`
      : "0%";

  return NextResponse.json({
    metrics: {
      leadsToday: todayRes.count || 0,
      leadsWeek: weekRes.count || 0,
      leadsMonth,
      plansGenerated,
      conversionRate,
      chatLeads: chatLeadsRes.count || 0,
      partnerApps: partnersRes.count || 0,
      websiteGrades: gradesRes.count || 0,
    },
    pipeline,
    topIndustries,
    emailStats,
    chartData,
  });
}
