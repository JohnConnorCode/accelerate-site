import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (!token || token.length > 64) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, qualified")
    .eq("qualifier_token", token)
    .maybeSingle();

  if (!opportunity?.qualified) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (opportunity.stage !== "qualified") return NextResponse.json({ success: true });

  const { error } = await supabase.from("opportunities").update({ stage: "calendar_viewed" }).eq("id", opportunity.id);
  if (error) return NextResponse.json({ error: "Database operation failed" }, { status: 500 });

  await supabase.from("opportunity_stage_events").insert({
    opportunity_id: opportunity.id,
    from_stage: "qualified",
    to_stage: "calendar_viewed",
    source: "roofing_page",
  });

  return NextResponse.json({ success: true });
}

