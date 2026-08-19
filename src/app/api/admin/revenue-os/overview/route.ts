import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { loadOperatorQueue } from "@/lib/revenue-os/queue";
import { canonicalStage } from "@/lib/revenue-os/pipeline";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();

  try {
    const [queue, opportunitiesResult, campaignResult, conversationsResult, proposalsResult, integrationResult, sourceRunsResult, jobRunsResult] = await Promise.all([
      loadOperatorQueue(supabase),
      supabase.from("opportunities").select("id,stage,estimated_value,won_value,next_action_at,last_activity_at"),
      supabase.from("campaigns").select("id,status"),
      supabase.from("conversations").select("id,unread_count,status"),
      supabase.from("proposals").select("id,status,total_one_time,total_monthly"),
      supabase.from("integration_connections").select("provider,status,last_success_at,last_error,scopes"),
      supabase.from("source_runs").select("source_key,status,started_at,finished_at,error").order("started_at", { ascending: false }).limit(30),
      supabase.from("job_runs").select("job_key,status,claimed_at,finished_at,error").order("claimed_at", { ascending: false }).limit(30),
    ]);
    const firstError = [opportunitiesResult.error, campaignResult.error, conversationsResult.error, proposalsResult.error, integrationResult.error, sourceRunsResult.error, jobRunsResult.error].find(Boolean);
    if (firstError) throw firstError;
    const opportunities = opportunitiesResult.data ?? [];
    const open = opportunities.filter((item) => !["won", "lost"].includes(canonicalStage(item.stage) ?? item.stage));
    const pipelineValue = open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
    const weightedValue = open.reduce((sum, item) => {
      const stage = canonicalStage(item.stage);
      const probability = stage === "won" ? 1 : stage === "negotiation" ? .85 : stage === "proposal" ? .7 : stage === "meeting" ? .55 : stage === "qualified" ? .4 : .15;
      return sum + Number(item.estimated_value || 0) * probability;
    }, 0);
    const wonRevenue = opportunities.reduce((sum, item) => sum + Number(item.won_value || 0), 0);
    const latestByKey = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => {
      const seen = new Set<string>();
      return rows.filter((row) => {
        const value = String(row[key] || "");
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    };
    const integrations = integrationResult.data ?? [];
    const sourceRuns = latestByKey(sourceRunsResult.data ?? [], "source_key");
    const jobRuns = latestByKey(jobRunsResult.data ?? [], "job_key");
    const failedIntegrations = integrations.filter((item) => item.status === "degraded" || item.status === "revoked" || Boolean(item.last_error));
    const failedRuns = [...sourceRuns, ...jobRuns].filter((item) => item.status === "failed" || item.status === "partial");

    return NextResponse.json({
      schemaReady: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        openOpportunities: open.length,
        pipelineValue,
        weightedValue: Math.round(weightedValue),
        wonRevenue,
        unreadConversations: (conversationsResult.data ?? []).reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
        activeCampaigns: (campaignResult.data ?? []).filter((item) => item.status === "active").length,
        pendingProposals: (proposalsResult.data ?? []).filter((item) => ["sent", "viewed"].includes(item.status)).length,
      },
      queue,
      integrations,
      health: {
        status: failedIntegrations.length || failedRuns.length ? "attention" : integrations.some((item) => item.status === "connected") || sourceRuns.some((item) => item.status === "success") || jobRuns.some((item) => item.status === "success") ? "ready" : "not_configured",
        attentionCount: failedIntegrations.length + failedRuns.length,
        integrations: integrations.map((item) => ({ provider: item.provider, status: item.status, lastSuccessAt: item.last_success_at, lastError: item.last_error })),
        sourceRuns: sourceRuns.map((item) => ({ key: item.source_key, status: item.status, startedAt: item.started_at, finishedAt: item.finished_at, error: item.error })),
        jobRuns: jobRuns.map((item) => ({ key: item.job_key, status: item.status, startedAt: item.claimed_at, finishedAt: item.finished_at, error: item.error })),
      },
    });
  } catch (error) {
    if (!isMissingRevenueSchema(error)) {
      console.error("[revenue-os/overview]", error);
    }
    const { data: leads } = await supabase.from("solution_requests").select("id,lead_status,estimated_value");
    return NextResponse.json({
      schemaReady: false,
      generatedAt: new Date().toISOString(),
      metrics: {
        openOpportunities: (leads ?? []).filter((item) => item.lead_status !== "won").length,
        pipelineValue: (leads ?? []).reduce((sum, item) => sum + Number(item.estimated_value || 0), 0),
        weightedValue: 0,
        wonRevenue: 0,
        unreadConversations: 0,
        activeCampaigns: 0,
        pendingProposals: 0,
      },
      queue: [],
      integrations: [],
      health: { status: "not_configured", attentionCount: 0, integrations: [], sourceRuns: [], jobRuns: [] },
      setupHref: "/admin/setup",
    });
  }
}
