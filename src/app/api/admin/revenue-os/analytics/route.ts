import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadRevenueAnalytics, loadWebsiteAnalytics } from "@/lib/revenue-os/analytics";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { REVENUE_STAGES, type RevenueStage } from "@/lib/revenue-os/types";

const bounded = (value: string | null) => value?.trim().slice(0, 160) || undefined;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const days = Math.min(365, Math.max(7, Number(params.get("days")) || 30));
  const requestedStage = bounded(params.get("stage"));
  const stage =
    requestedStage && REVENUE_STAGES.includes(requestedStage as RevenueStage)
      ? requestedStage
      : undefined;
  try {
    const supabase = auth.database;
    const revenue = await loadRevenueAnalytics(supabase, {
      days,
      source: bounded(params.get("source")),
      owner: bounded(params.get("owner")),
      campaign: bounded(params.get("campaign")),
      stage,
    });
    try {
      return NextResponse.json({
        schemaReady: true,
        ...revenue,
        web: await loadWebsiteAnalytics(supabase, days),
      });
    } catch {
      return NextResponse.json({
        schemaReady: true,
        ...revenue,
        web: {
          status: "degraded",
          reason:
            "First-party event storage is not ready. Apply the analytics migration; no vendor key is required.",
          pageViews: null,
          visitors: null,
          conversions: null,
          engagementEvents: null,
          conversionRate: null,
          topPages: [],
          sources: [],
          conversionEvents: [],
          eventCount: null,
          lastCapturedAt: null,
        },
      });
    }
  } catch (error) {
    if (isMissingRevenueSchema(error))
      return NextResponse.json({ schemaReady: false, funnel: null, sources: [], web: null });
    return NextResponse.json({ error: "Could not load canonical analytics" }, { status: 500 });
  }
}
