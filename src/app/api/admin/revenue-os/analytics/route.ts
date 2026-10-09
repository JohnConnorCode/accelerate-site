import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { loadDashboardAnalytics } from "@/lib/revenue-os/analytics";
import { analyticsFiltersFromUrl } from "@/lib/revenue-os/reporting-contract";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("analytics");
  if (auth instanceof NextResponse) return auth;
  // Any admin-defined pipeline column_key is a valid filter now, not just the
  // original 9 canonical stages — loadRevenueAnalytics/canonicalStage
  // resolves it against the tenant's live stage set; an unrecognized value
  // simply matches nothing rather than being silently ignored.
  try {
    return NextResponse.json(
      await loadDashboardAnalytics(
        auth.database,
        auth.tenant.id,
        analyticsFiltersFromUrl(new URL(request.url).searchParams),
      ),
    );
  } catch (error) {
    console.error(
      "Canonical analytics unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Could not load canonical analytics" }, { status: 500 });
  }
}
