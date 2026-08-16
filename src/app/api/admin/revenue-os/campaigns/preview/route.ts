import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizeCampaignPolicy, renderCampaignTemplate } from "@/lib/revenue-os/campaigns";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Campaign id is required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  const [campaignResult, stepsResult, membersResult] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,version,approved_version,policy").eq("id", id).maybeSingle(),
    supabase.from("campaign_steps").select("step_order,delay_days,subject_template,body_template").eq("campaign_id", id).eq("active", true).order("step_order"),
    supabase.from("campaign_members").select("id,email,status,current_step,contacts(full_name),opportunities(name,stage)").eq("campaign_id", id).order("created_at").limit(500),
  ]);
  if (campaignResult.error || !campaignResult.data) return NextResponse.json({ error: campaignResult.error?.message || "Campaign not found" }, { status: 404 });
  if (stepsResult.error || membersResult.error) return NextResponse.json({ error: stepsResult.error?.message || membersResult.error?.message }, { status: 400 });
  const members = membersResult.data ?? [];
  const excluded = members.filter((member) => ["replied", "booked", "converted", "bounced", "unsubscribed", "stopped"].includes(member.status));
  const eligible = members.filter((member) => ["queued", "active"].includes(member.status));
  const firstStep = stepsResult.data?.[0];
  const samples = eligible.slice(0, 5).map((member) => {
    const contact = Array.isArray(member.contacts) ? member.contacts[0] : member.contacts;
    const opportunity = Array.isArray(member.opportunities) ? member.opportunities[0] : member.opportunities;
    const values = { first_name: contact?.full_name?.split(" ")[0] ?? "", full_name: contact?.full_name ?? "", company: opportunity?.name ?? "" };
    return { email: member.email, subject: firstStep ? renderCampaignTemplate(firstStep.subject_template, values) : "", body: firstStep ? renderCampaignTemplate(firstStep.body_template, values) : "" };
  });
  return NextResponse.json({ campaign: campaignResult.data, policy: normalizeCampaignPolicy(campaignResult.data.policy), steps: stepsResult.data ?? [], totals: { members: members.length, eligible: eligible.length, excluded: excluded.length }, exclusions: excluded.slice(0, 25).map((member) => ({ email: member.email, reason: member.status })), samples });
}
