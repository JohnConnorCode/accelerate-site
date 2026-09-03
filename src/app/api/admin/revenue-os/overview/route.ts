import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { loadOperatorQueue } from "@/lib/revenue-os/queue";
import { loadPipelineStages } from "@/lib/revenue-os/pipeline-stage-resolver";
import { loadOperationalHealth } from "@/lib/revenue-os/health";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = auth.database;

  try {
    const [
      queue,
      opportunitiesResult,
      campaignResult,
      conversationsResult,
      proposalsResult,
      integrationResult,
      health,
    ] = await Promise.all([
      loadOperatorQueue(supabase),
      supabase
        .from("opportunities")
        .select("id,stage,estimated_value,won_value,probability,next_action_at,last_activity_at"),
      supabase.from("campaigns").select("id,status"),
      supabase.from("conversations").select("id,unread_count,status"),
      supabase.from("proposals").select("id,status,total_one_time,total_monthly"),
      supabase
        .from("integration_connections")
        .select("provider,status,last_success_at,last_error,scopes"),
      loadOperationalHealth(supabase),
    ]);
    const firstError = [
      opportunitiesResult.error,
      campaignResult.error,
      conversationsResult.error,
      proposalsResult.error,
      integrationResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;
    const opportunities = opportunitiesResult.data ?? [];
    const stages = await loadPipelineStages(supabase, auth.tenant.id);
    const isOpenStage = (rawStage: string) => {
      const canonical = stages.canonicalStage(rawStage);
      return canonical ? stages.role(canonical) === "open" : true;
    };
    const open = opportunities.filter((item) => isOpenStage(item.stage));
    const pipelineValue = open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
    // Uses each opportunity's own stored `probability` (kept in sync with its
    // stage's configured probability by transitionOpportunity()) rather than
    // re-deriving one from the stage name — the two used to be two
    // independently hardcoded, disagreeing sources of truth.
    const weightedValue = open.reduce(
      (sum, item) =>
        sum +
        (Number(item.estimated_value || 0) * Math.min(100, Math.max(0, Number(item.probability || 0)))) /
          100,
      0,
    );
    const wonRevenue = opportunities.reduce((sum, item) => sum + Number(item.won_value || 0), 0);
    const integrations = integrationResult.data ?? [];

    return NextResponse.json({
      schemaReady: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        openOpportunities: open.length,
        pipelineValue,
        weightedValue: Math.round(weightedValue),
        wonRevenue,
        unreadConversations: (conversationsResult.data ?? []).reduce(
          (sum, item) => sum + Number(item.unread_count || 0),
          0,
        ),
        activeCampaigns: (campaignResult.data ?? []).filter((item) => item.status === "active")
          .length,
        pendingProposals: (proposalsResult.data ?? []).filter((item) =>
          ["sent", "viewed"].includes(item.status),
        ).length,
      },
      queue,
      integrations,
      health,
    });
  } catch (error) {
    if (!isMissingRevenueSchema(error)) {
      console.error("[revenue-os/overview]", error);
    }
    const { data: leads } = await supabase
      .from("solution_requests")
      .select("id,lead_status,estimated_value");
    return NextResponse.json({
      schemaReady: false,
      generatedAt: new Date().toISOString(),
      metrics: {
        openOpportunities: (leads ?? []).filter((item) => item.lead_status !== "won").length,
        pipelineValue: (leads ?? []).reduce(
          (sum, item) => sum + Number(item.estimated_value || 0),
          0,
        ),
        weightedValue: 0,
        wonRevenue: 0,
        unreadConversations: 0,
        activeCampaigns: 0,
        pendingProposals: 0,
      },
      queue: [],
      integrations: [],
      health: {
        status: "not_configured",
        attentionCount: 0,
        integrations: [],
        sourceRuns: [],
        jobRuns: [],
      },
      setupHref: "/admin/setup",
    });
  }
}
