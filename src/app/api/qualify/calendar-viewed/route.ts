import { NextRequest, NextResponse } from "next/server";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { transitionOpportunity, transitionStatusFromError } from "@/lib/revenue-os/pipeline";

export async function POST(request: NextRequest) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (!token || token.length > 64) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const supabase = createBootstrapServiceRoleClient("legacy-public-qualifier-calendar");
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, qualified")
    .eq("qualifier_token", token)
    .maybeSingle();

  if (!opportunity?.qualified) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (opportunity.stage !== "qualified") return NextResponse.json({ success: true });

  try {
    await transitionOpportunity(supabase, {
      id: opportunity.id,
      to: "calendar_viewed",
      actorEmail: "roofing_page",
      source: "roofing_page",
      reason: "Qualification page viewed",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transition blocked by current stage" }, { status: transitionStatusFromError(error) });
  }

  return NextResponse.json({ success: true });
}
