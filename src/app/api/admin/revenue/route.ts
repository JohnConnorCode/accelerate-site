import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;

  const [clientsRes, proposalsRes] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, business_name, contact_name, industry, status, monthly_value, one_time_value, contract_start, created_at",
      ),
    supabase
      .from("proposals")
      .select("id, client_name, total_monthly, total_one_time, status, created_at")
      .eq("status", "accepted"),
  ]);

  const clients = clientsRes.data || [];
  const proposals = proposalsRes.data || [];

  // Active clients
  const activeClients = clients.filter((c: { status?: string }) => c.status === "active");
  const totalMRR = activeClients.reduce(
    (sum: number, c: { monthly_value?: number }) => sum + (c.monthly_value || 0),
    0,
  );
  const totalOneTime = clients.reduce(
    (sum: number, c: { one_time_value?: number }) => sum + (c.one_time_value || 0),
    0,
  );

  // Revenue by industry
  const byIndustry: Record<string, number> = {};
  activeClients.forEach((c: { industry?: string; monthly_value?: number }) => {
    const ind = c.industry?.replace(/_/g, " ") || "Other";
    byIndustry[ind] = (byIndustry[ind] || 0) + (c.monthly_value || 0);
  });
  const industryBreakdown = Object.entries(byIndustry)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Revenue by client
  const byClient = activeClients
    .map((c: { business_name: string; monthly_value?: number; one_time_value?: number }) => ({
      name: c.business_name,
      monthly: c.monthly_value || 0,
      oneTime: c.one_time_value || 0,
    }))
    .sort((a: { monthly: number }, b: { monthly: number }) => b.monthly - a.monthly);

  // MRR over time (from client contract_start dates)
  const mrrTimeline: { date: string; mrr: number }[] = [];
  const allClients = [...clients].sort(
    (a, b) =>
      new Date(a.contract_start || a.created_at).getTime() -
      new Date(b.contract_start || b.created_at).getTime(),
  );

  let runningMRR = 0;
  allClients.forEach(
    (c: {
      status: string;
      monthly_value?: number;
      contract_start?: string;
      created_at: string;
    }) => {
      if (c.status === "active" || c.status === "onboarding") {
        runningMRR += c.monthly_value || 0;
      } else if (c.status === "churned") {
        runningMRR -= c.monthly_value || 0;
      }
      mrrTimeline.push({
        date: new Date(c.contract_start || c.created_at).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        mrr: Math.max(0, runningMRR),
      });
    },
  );

  // Churn rate
  const churnedCount = clients.filter((c: { status?: string }) => c.status === "churned").length;
  const totalEverActive = clients.filter(
    (c: { status?: string }) => c.status !== "onboarding",
  ).length;
  const churnRate = totalEverActive > 0 ? Math.round((churnedCount / totalEverActive) * 100) : 0;

  // Accepted proposals value
  const proposalRevenue = proposals.reduce(
    (sum: number, p: { total_monthly?: number }) => sum + (p.total_monthly || 0),
    0,
  );

  return NextResponse.json({
    totalMRR,
    totalOneTime,
    activeCount: activeClients.length,
    churnRate,
    avgClientValue: activeClients.length > 0 ? Math.round(totalMRR / activeClients.length) : 0,
    industryBreakdown,
    byClient,
    mrrTimeline,
    proposalRevenue,
  });
}
