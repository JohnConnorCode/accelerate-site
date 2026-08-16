import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { OPPORTUNITY_STAGES } from "@/lib/opportunities";
import { sendNoShowRebookEmail } from "@/lib/email/booking";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const days = Math.min(365, Math.max(7, Number(new URL(request.url).searchParams.get("days") || 90)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = createServiceRoleClient();
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

  const supabase = createServiceRoleClient();
  const { data: current } = await supabase.from("opportunities").select("stage, email, qualifier_token").eq("id", body.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const update: Record<string, unknown> = { stage: body.stage };
  if (Number.isFinite(body.estimatedValue)) update.estimated_value = Math.max(0, Number(body.estimatedValue));
  if (Number.isFinite(body.wonValue)) update.won_value = Math.max(0, Number(body.wonValue));
  if (body.stage === "showed") update.showed_at = new Date().toISOString();

  const { data, error } = await supabase.from("opportunities").update(update).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: "Database operation failed" }, { status: 500 });

  await supabase.from("opportunity_stage_events").insert({
    opportunity_id: body.id,
    from_stage: current.stage,
    to_stage: body.stage,
    source: "admin",
    metadata: { estimated_value: body.estimatedValue, won_value: body.wonValue },
  });

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
