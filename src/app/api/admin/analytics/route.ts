import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("analytics");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all channel data in parallel
  const [leadsRes, contactsRes, chatLeadsRes, gradesRes, resourcesRes, industryRes, pipelineRes] =
    await Promise.all([
      supabase
        .from("solution_requests")
        .select("id, lead_status, created_at, industry, contacted_at", { count: "exact" })
        .gte("created_at", since),
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("chat_leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("website_grades")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("resource_downloads")
        .select("id", { count: "exact", head: true })
        .gte("downloaded_at", since),
      // Full industry breakdown
      supabase.from("solution_requests").select("industry").gte("created_at", since),
      // Full pipeline for funnel
      supabase.from("solution_requests").select("lead_status"),
    ]);

  // Channel breakdown
  const channels = [
    { name: "Plan Builder", count: leadsRes.count || 0 },
    { name: "Contact Form", count: contactsRes.count || 0 },
    { name: "Chat Widget", count: chatLeadsRes.count || 0 },
    { name: "Website Grader", count: gradesRes.count || 0 },
    { name: "Resources", count: resourcesRes.count || 0 },
  ];

  // Industry breakdown
  const industries: Record<string, number> = {};
  (industryRes.data || []).forEach((r: { industry: string }) => {
    const name = r.industry?.replace(/_/g, " ") || "Unknown";
    industries[name] = (industries[name] || 0) + 1;
  });
  const industryBreakdown = Object.entries(industries)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Conversion funnel
  const funnel: Record<string, number> = {};
  (pipelineRes.data || []).forEach((r: { lead_status: string }) => {
    const status = r.lead_status || "new";
    funnel[status] = (funnel[status] || 0) + 1;
  });

  // Average time to first contact (hours)
  let totalContactTime = 0;
  let contactedCount = 0;
  (leadsRes.data || []).forEach(
    (r: { created_at: string; contacted_at?: string; lead_status: string }) => {
      if (r.contacted_at) {
        const created = new Date(r.created_at).getTime();
        const contacted = new Date(r.contacted_at).getTime();
        const diffHours = (contacted - created) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 720) {
          // cap at 30 days
          totalContactTime += diffHours;
          contactedCount++;
        }
      }
    },
  );
  const avgTimeToContact =
    contactedCount > 0 ? Math.round(totalContactTime / contactedCount) : null;

  return NextResponse.json({
    channels,
    industryBreakdown,
    funnel,
    avgTimeToContact,
    totalLeads: leadsRes.count || 0,
    days,
  });
}
