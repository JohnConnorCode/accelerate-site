import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { stageCampaignMembers } from "@/lib/revenue-os/campaigns";
export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("campaigns");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const outcomes = await stageCampaignMembers(
      auth.database,
      body.campaignId,
      body.members,
      auth.user.email || "founder",
    );
    return NextResponse.json({
      added: outcomes.filter((row) => row.status === "applied").length,
      outcomes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not stage campaign members" },
      { status: 400 },
    );
  }
}
