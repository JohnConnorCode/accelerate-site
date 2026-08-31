import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { canonicalStage, transitionOpportunity, transitionStatusFromError } from "@/lib/revenue-os/pipeline";
import { OPPORTUNITY_STAGES } from "@/lib/opportunities";
import { sendNoShowRebookEmail } from "@/lib/email/booking";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const days = Math.min(365, Math.max(7, Number(new URL(request.url).searchParams.get("days") || 90)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = auth.database;
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  const opportunities = data || [];
  const count = (stage: string) => opportunities.filter((item) => item.stage === stage).length;
  const qualified = opportunities.filter((item) => item.qualified).length;
  const booked = opportunities.filter((item) => ["booked", "showed", "proposal", "won"].includes(item.stage)).length;
  const showed = opportunities.filter((item) => ["showed", "proposal", "won"].includes(item.stage)).length;
  const pipelineValue = opportunities.filter((item) => ["proposal", "won"].includes(item.stage)).reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
  const wonRevenue = opportunities.reduce((sum, item) => sum + Number(item.won_value || 0), 0);

  return NextResponse.json({
    opportunities,
    metrics: {
      total: opportunities.length,
      qualified,
      booked,
      showed,
      noShow: count("no_show"),
      won: count("won"),
      pipelineValue,
      wonRevenue,
      qualifiedToBooked: qualified ? Math.round((booked / qualified) * 100) : 0,
      bookedToShowed: booked ? Math.round((showed / booked) * 100) : 0,
    },
    days,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { id?: string; stage?: string; estimatedValue?: number; wonValue?: number };
  if (!body.id || !body.stage || !OPPORTUNITY_STAGES.includes(body.stage as never)) {
    return NextResponse.json({ error: "Invalid opportunity update" }, { status: 400 });
  }

  const supabase = auth.database;
  const { data: current } = await supabase.from("opportunities").select("stage, email, qualifier_token").eq("id", body.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const updatePatch: Record<string, unknown> = {};
  if (Number.isFinite(body.estimatedValue)) updatePatch.estimated_value = Math.max(0, Number(body.estimatedValue));
  if (Number.isFinite(body.wonValue)) updatePatch.won_value = Math.max(0, Number(body.wonValue));
  if (body.stage === "showed") updatePatch.showed_at = new Date().toISOString();

  let finalData: Record<string, unknown> = current;
  if (typeof body.stage === "string") {
    const targetStage = canonicalStage(body.stage);
    if (!targetStage) return NextResponse.json({ error: "Invalid opportunity update" }, { status: 400 });
    try {
      finalData = await transitionOpportunity(supabase, {
        id: body.id,
        to: body.stage,
        actorEmail: auth.user.email || "founder",
        source: "admin_bookings",
        reason: `Booking stage moved from ${current.stage} to ${body.stage}`,
        lossReason: body.stage === "lost" ? "Admin booking pipeline adjustment" : undefined,
      }) as Record<string, unknown>;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update opportunity" }, { status: transitionStatusFromError(error) });
    }
  }

  let data = finalData as Record<string, unknown> | null;
  if (Object.keys(updatePatch).length > 0) {
    const { data: patched, error: patchError } = await supabase
      .from("opportunities")
      .update(updatePatch)
      .eq("id", body.id)
      .select()
      .single();
    if (patchError) return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    data = patched;
  }

  if (body.stage === "no_show" && current.stage !== "no_show") {
    try {
      await sendNoShowRebookEmail({ email: current.email, opportunityId: body.id, token: current.qualifier_token });
    } catch (error) {
      console.error("[admin-bookings] no-show email failed:", error);
    }
  }

  if (body.stage === "proposal" && current.stage !== "proposal") {
    const due = new Date();
    due.setDate(due.getDate() + 2);
    await supabase.from("tasks").insert({
      title: `Follow up on roofing proposal: ${current.email}`,
      description: "Confirm the prospect received the written plan and proposal; address the primary objection.",
      due_date: due.toISOString().split("T")[0],
      priority: "high",
      related_type: "lead",
      related_id: body.id,
      related_name: current.email,
    });
  }
  return NextResponse.json({ opportunity: data });
}
