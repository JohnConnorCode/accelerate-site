import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ACTIVITY_LEDGER_CONTRACT, loadActivityTimeline } from "@/lib/revenue-os/activities";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const limitValue = Number(params.get("limit") || 50);
  try {
    const activities = await loadActivityTimeline(auth.database, {
      contactId: params.get("contactId")?.trim() || undefined,
      companyId: params.get("companyId")?.trim() || undefined,
      opportunityId: params.get("opportunityId")?.trim() || undefined,
      conversationId: params.get("conversationId")?.trim() || undefined,
      proposalId: params.get("proposalId")?.trim() || undefined,
      campaignId: params.get("campaignId")?.trim() || undefined,
      before: params.get("before")?.trim() || undefined,
      limit: Number.isFinite(limitValue) ? limitValue : 50,
    });
    return NextResponse.json({
      contract: ACTIVITY_LEDGER_CONTRACT,
      activities,
      nextCursor: activities.length ? activities.at(-1)?.occurred_at ?? null : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The activity timeline could not be loaded";
    const invalid = /required|invalid/i.test(message);
    return NextResponse.json({ error: invalid ? message : "The activity timeline could not be loaded" }, { status: invalid ? 400 : 500 });
  }
}
