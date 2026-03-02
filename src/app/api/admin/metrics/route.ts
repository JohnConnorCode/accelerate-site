import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { calculateLeadScore } from "@/lib/admin/lead-scoring";

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

  // Previous period calculations for trends
  const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = prevMonthDate.toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

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
    // Trend data
    prevWeekRes,
    prevMonthRes,
    // Priority data
    newLeadsRes,
    unreadContactsRes,
    pendingPartnersRes,
    overdueTasksRes,
    clientsRes,
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
    supabase
      .from("chat_leads")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("website_grades")
      .select("id", { count: "exact", head: true }),
    // Pipeline with estimated_value for revenue
    supabase
      .from("solution_requests")
      .select("lead_status, estimated_value"),
    supabase
      .from("solution_requests")
      .select("industry"),
    supabase
      .from("email_sequences")
      .select("status"),
    // Previous week count (7-14 days ago)
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevWeekStart)
      .lt("created_at", weekStart),
    // Previous month count
    supabase
      .from("solution_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevMonthStart)
      .lt("created_at", prevMonthEnd),
    // New leads for priorities (with scoring data)
    supabase
      .from("solution_requests")
      .select("id, contact_name, contact_email, contact_phone, industry, lead_status, created_at, ai_plan, intake_data, view_count")
      .eq("lead_status", "new")
      .order("created_at", { ascending: false })
      .limit(20),
    // Unread contacts
    supabase
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    // Pending partners
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Overdue tasks
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString().split("T")[0]!),
    // Active clients with MRR
    supabase
      .from("clients")
      .select("id, monthly_value, status"),
  ]);

  // Client stats
  const activeClients = (clientsRes.data || []).filter((c: { status: string }) => c.status === "active");
  const totalMRR = activeClients.reduce((sum: number, c: { monthly_value?: number }) => sum + (c.monthly_value || 0), 0);

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

  // Pipeline breakdown with revenue
  const pipeline: Record<string, number> = {};
  const pipelineValues: Record<string, number> = {};
  (pipelineRes.data || []).forEach((r: { lead_status: string; estimated_value?: number }) => {
    const status = r.lead_status || "new";
    pipeline[status] = (pipeline[status] || 0) + 1;
    if (r.estimated_value) {
      pipelineValues[status] = (pipelineValues[status] || 0) + r.estimated_value;
    }
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
  const leadsWeek = weekRes.count || 0;
  const plansGenerated = totalRes.count || 0;
  const conversionRate =
    leadsMonth > 0
      ? `${Math.round((plansGenerated / Math.max(leadsMonth, 1)) * 100)}%`
      : "0%";

  // Trends
  const prevWeekCount = prevWeekRes.count || 0;
  const prevMonthCount = prevMonthRes.count || 0;
  const weekDelta = leadsWeek - prevWeekCount;
  const monthDelta = leadsMonth - prevMonthCount;

  // Priorities: score new leads and pick top 5
  const priorities: {
    id: string;
    name: string;
    email: string;
    score: number;
    scoreLabel: string;
    type: string;
    timeAgo: string;
    link: string;
  }[] = [];

  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  (newLeadsRes.data || []).forEach((lead: {
    id: string;
    contact_name: string;
    contact_email: string;
    contact_phone?: string;
    industry: string;
    created_at: string;
    ai_plan?: unknown;
    intake_data?: Record<string, unknown>;
    view_count?: number;
  }) => {
    const score = calculateLeadScore(lead);
    const createdAt = new Date(lead.created_at);
    const isHot = score >= 70;
    const isStale = createdAt < fortyEightHoursAgo;

    if (isHot || isStale) {
      const diffMs = now.getTime() - createdAt.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const timeAgo = diffHours < 24 ? `${diffHours}h ago` : `${Math.floor(diffHours / 24)}d ago`;

      priorities.push({
        id: lead.id,
        name: lead.contact_name,
        email: lead.contact_email,
        score,
        scoreLabel: score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold",
        type: isHot ? "hot_lead" : "stale_lead",
        timeAgo,
        link: "/admin/leads",
      });
    }
  });

  // Sort by score desc, take top 5
  priorities.sort((a, b) => b.score - a.score);
  const topPriorities = priorities.slice(0, 5);

  return NextResponse.json({
    metrics: {
      leadsToday: todayRes.count || 0,
      leadsWeek,
      leadsMonth,
      plansGenerated,
      conversionRate,
      chatLeads: chatLeadsRes.count || 0,
      partnerApps: partnersRes.count || 0,
      websiteGrades: gradesRes.count || 0,
      activeClients: activeClients.length,
      mrr: totalMRR,
    },
    trends: {
      weekDelta,
      monthDelta,
      prevWeekCount,
      prevMonthCount,
    },
    priorities: topPriorities,
    unreadContacts: unreadContactsRes.count || 0,
    pendingPartners: pendingPartnersRes.count || 0,
    overdueTasks: overdueTasksRes.count || 0,
    pipeline,
    pipelineValues,
    topIndustries,
    emailStats,
    chartData,
  });
}
