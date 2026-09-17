import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listAuditHistory } from "@/lib/revenue-os/audit";
import { activityDispositions, loadRecentActivities } from "@/lib/revenue-os/activities";

function textParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  try {
    const [history, activities] = await Promise.all([
      listAuditHistory(auth.database, {
        actor: textParam(params.get("actor")),
        entityType: textParam(params.get("entity")),
        entityId: textParam(params.get("entityId")),
        action: textParam(params.get("action")),
        source: textParam(params.get("source")),
        from: textParam(params.get("from")),
        to: textParam(params.get("to")),
      }),
      loadRecentActivities(auth.database, { limit: 20 }),
    ]);
    return NextResponse.json({
      ...history,
      canonical: { activities, dispositions: activityDispositions() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit history could not be loaded";
    const status = /YYYY-MM-DD/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
