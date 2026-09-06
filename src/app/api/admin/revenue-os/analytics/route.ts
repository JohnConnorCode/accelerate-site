import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { loadRevenueAnalytics, loadWebsiteAnalytics } from "@/lib/revenue-os/analytics";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

const bounded = (value: string | null) => value?.trim().slice(0, 160) || undefined;

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("analytics");
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const days = Math.min(365, Math.max(7, Number(params.get("days")) || 30));
  // Any admin-defined pipeline column_key is a valid filter now, not just the
  // original 9 canonical stages — loadRevenueAnalytics/canonicalStage
  // resolves it against the tenant's live stage set; an unrecognized value
  // simply matches nothing rather than being silently ignored.
  const stage = bounded(params.get("stage"));
  try {
    const supabase = auth.database;
    const revenue = await loadRevenueAnalytics(supabase, auth.tenant.id, {
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
