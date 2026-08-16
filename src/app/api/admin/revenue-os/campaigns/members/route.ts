import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/revenue-os/db";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { campaignId?: string; members?: Array<{ email?: string; contactId?: string; opportunityId?: string }> };
  if (!body.campaignId || !Array.isArray(body.members) || !body.members.length || body.members.length > 500) {
    return NextResponse.json({ error: "Supply a campaign and 1–500 members" }, { status: 400 });
  }
  const rows = body.members.map((member) => ({
    campaign_id: body.campaignId,
    email: normalizeEmail(member.email),
    contact_id: member.contactId || null,
    opportunity_id: member.opportunityId || null,
    status: "queued",
  }));
  if (rows.some((row) => !row.email)) return NextResponse.json({ error: "Every member needs a valid email" }, { status: 400 });
  const { data, error } = await createServiceRoleClient().from("campaign_members").upsert(rows, { onConflict: "campaign_id,email", ignoreDuplicates: true }).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ added: data?.length ?? 0 });
}
