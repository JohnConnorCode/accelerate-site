import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { activateCampaign, normalizeCampaignPolicy, pauseCampaign } from "@/lib/revenue-os/campaigns";
import { isMissingRevenueSchema, normalizeEmail } from "@/lib/revenue-os/db";
import { recordAudit } from "@/lib/revenue-os/audit";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("campaigns").select("*,campaign_steps(*),campaign_members(id,status,current_step,next_send_at)").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, campaigns: [] });
    return NextResponse.json({ error: "Could not load campaigns" }, { status: 500 });
  }
  return NextResponse.json({ schemaReady: true, campaigns: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, 10) : [];
  if (!steps.length) return NextResponse.json({ error: "At least one campaign step is required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  const { data: campaign, error } = await supabase.from("campaigns").insert({
    name,
    status: "draft",
    sender_name: typeof body.senderName === "string" ? body.senderName.trim() : "Accelerate",
    sender_email: normalizeEmail(typeof body.senderEmail === "string" ? body.senderEmail : process.env.ADMIN_EMAIL),
    audience_definition: body.audience && typeof body.audience === "object" ? body.audience : {},
    policy: normalizeCampaignPolicy(body.policy),
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = steps.map((step, index) => {
    const value = step && typeof step === "object" ? step as Record<string, unknown> : {};
    return {
      campaign_id: campaign.id,
      step_order: index + 1,
      delay_days: Math.min(60, Math.max(0, Number(value.delayDays) || (index === 0 ? 0 : 3))),
      subject_template: typeof value.subject === "string" ? value.subject.trim() : "",
      body_template: typeof value.body === "string" ? value.body.trim() : "",
    };
  });
  if (rows.some((row) => !row.subject_template || !row.body_template)) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: "Every step needs a subject and body" }, { status: 400 });
  }
  const { error: stepError } = await supabase.from("campaign_steps").insert(rows);
  if (stepError) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: stepError.message }, { status: 400 });
  }
  await recordAudit(supabase, { actorEmail: auth.user.email, action: "campaign.created", entityType: "campaign", entityId: campaign.id, after: campaign });
  return NextResponse.json({ campaign }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id) return NextResponse.json({ error: "Campaign id is required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  try {
    if (action === "activate") return NextResponse.json({ campaign: await activateCampaign(supabase, id, auth.user.email || "founder") });
    if (action === "pause") return NextResponse.json({ campaign: await pauseCampaign(supabase, id, auth.user.email || "founder") });

    const { data: current, error: currentError } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (currentError || !current) throw new Error(currentError?.message || "Campaign not found");
    const patch: Record<string, unknown> = { version: current.version + 1, approved_version: null, approved_at: null, approved_by: null, status: "review" };
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (body.policy && typeof body.policy === "object") patch.policy = normalizeCampaignPolicy(body.policy);
    if (body.audience && typeof body.audience === "object") patch.audience_definition = body.audience;
    const { data, error } = await supabase.from("campaigns").update(patch).eq("id", id).eq("version", current.version).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The campaign changed while you were editing it");
    await recordAudit(supabase, { actorEmail: auth.user.email, action: "campaign.revised", entityType: "campaign", entityId: id, before: current, after: data });
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update campaign" }, { status: 400 });
  }
}
