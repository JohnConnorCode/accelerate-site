import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendRecordedEmail } from "./communications";
import { recordAudit } from "./audit";

interface CampaignPolicy {
  daily_limit?: number;
  stop_on_reply?: boolean;
  stop_on_booking?: boolean;
  stop_on_bounce?: boolean;
  stop_on_unsubscribe?: boolean;
}

const DEFAULT_POLICY: Required<CampaignPolicy> = {
  daily_limit: 25,
  stop_on_reply: true,
  stop_on_booking: true,
  stop_on_bounce: true,
  stop_on_unsubscribe: true,
};

export function normalizeCampaignPolicy(value: unknown): Required<CampaignPolicy> {
  const input = value && typeof value === "object" ? value as CampaignPolicy : {};
  return {
    daily_limit: Math.min(200, Math.max(1, Number(input.daily_limit) || DEFAULT_POLICY.daily_limit)),
    stop_on_reply: input.stop_on_reply !== false,
    stop_on_booking: input.stop_on_booking !== false,
    stop_on_bounce: input.stop_on_bounce !== false,
    stop_on_unsubscribe: input.stop_on_unsubscribe !== false,
  };
}

export function renderCampaignTemplate(template: string, values: Record<string, string | null | undefined>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key]?.trim() || "");
}

export async function activateCampaign(supabase: SupabaseClient, id: string, actorEmail: string) {
  const { data: campaign, error } = await supabase.from("campaigns").select("id,status,version,approved_version,name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");
  const { count, error: stepError } = await supabase.from("campaign_steps").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("active", true);
  if (stepError) throw new Error(stepError.message);
  if (!count) throw new Error("Add at least one active step before launching this campaign");

  const now = new Date().toISOString();
  const { data, error: updateError } = await supabase.from("campaigns").update({
    status: "active",
    approved_version: campaign.version,
    approved_at: now,
    approved_by: actorEmail,
  }).eq("id", id).eq("version", campaign.version).select("*").single();
  if (updateError) throw new Error(updateError.message);
  await supabase.from("campaign_members").update({ status: "active", next_send_at: now }).eq("campaign_id", id).eq("status", "queued");
  await recordAudit(supabase, { actorEmail, action: "campaign.activated", entityType: "campaign", entityId: id, before: campaign, after: data });
  return data;
}

export async function pauseCampaign(supabase: SupabaseClient, id: string, actorEmail: string) {
  const { data: before } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", id).in("status", ["active", "review"]).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only an active or review campaign can be paused");
  await recordAudit(supabase, { actorEmail, action: "campaign.paused", entityType: "campaign", entityId: id, before, after: data });
  return data;
}

export async function executeDueCampaignMembers(supabase: SupabaseClient, now = new Date()) {
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const { data: campaigns, error } = await supabase.from("campaigns").select("id,name,status,version,approved_version,policy,sender_email").eq("status", "active");
  if (error) throw new Error(error.message);
  let sent = 0;
  let failed = 0;
  let stopped = 0;

  for (const campaign of campaigns ?? []) {
    if (campaign.version !== campaign.approved_version) {
      await supabase.from("campaigns").update({ status: "review" }).eq("id", campaign.id).eq("status", "active");
      stopped++;
      continue;
    }
    const policy = normalizeCampaignPolicy(campaign.policy);
    const { count: sentToday } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("metadata->>source", "campaign").eq("metadata->>campaign_id", campaign.id).gte("sent_at", dayStart.toISOString());
    const remaining = Math.max(0, policy.daily_limit - (sentToday ?? 0));
    if (!remaining) continue;

    const { data: members, error: memberError } = await supabase.from("campaign_members")
      .select("id,email,current_step,contact_id,opportunity_id,contacts(full_name),opportunities(name,stage)")
      .eq("campaign_id", campaign.id).in("status", ["queued", "active"]).lte("next_send_at", now.toISOString())
      .order("next_send_at", { ascending: true }).limit(remaining);
    if (memberError) throw new Error(memberError.message);

    const { data: steps, error: stepError } = await supabase.from("campaign_steps").select("step_order,delay_days,subject_template,body_template").eq("campaign_id", campaign.id).eq("active", true).order("step_order");
    if (stepError) throw new Error(stepError.message);

    for (const member of members ?? []) {
      const opportunity = Array.isArray(member.opportunities) ? member.opportunities[0] : member.opportunities;
      if (opportunity && ["meeting", "proposal", "negotiation", "won", "lost", "booked", "showed"].includes(opportunity.stage)) {
        await supabase.from("campaign_members").update({ status: opportunity.stage === "won" ? "converted" : "stopped", stop_reason: `opportunity_${opportunity.stage}`, next_send_at: null }).eq("id", member.id);
        stopped++;
        continue;
      }
      const step = (steps ?? [])[member.current_step];
      if (!step) {
        await supabase.from("campaign_members").update({ status: "completed", next_send_at: null }).eq("id", member.id);
        continue;
      }
      const contact = Array.isArray(member.contacts) ? member.contacts[0] : member.contacts;
      const values = { first_name: contact?.full_name?.split(" ")[0] ?? "", full_name: contact?.full_name ?? "", company: opportunity?.name ?? "" };
      try {
        await sendRecordedEmail(supabase, {
          to: member.email,
          subject: renderCampaignTemplate(step.subject_template, values),
          text: renderCampaignTemplate(step.body_template, values),
          contactId: member.contact_id ?? undefined,
          opportunityId: member.opportunity_id ?? undefined,
          campaignId: campaign.id,
          template: `campaign:${campaign.id}:step:${step.step_order}`,
          source: "campaign",
        });
        const nextStep = (steps ?? [])[member.current_step + 1];
        const nextAt = nextStep ? new Date(now.getTime() + nextStep.delay_days * 86400000).toISOString() : null;
        await supabase.from("campaign_members").update({
          current_step: member.current_step + 1,
          status: nextStep ? "active" : "completed",
          last_sent_at: now.toISOString(),
          next_send_at: nextAt,
        }).eq("id", member.id).in("status", ["queued", "active"]);
        sent++;
      } catch (sendError) {
        console.error("[campaign-executor]", sendError);
        failed++;
      }
    }
  }
  return { sent, failed, stopped, campaigns: campaigns?.length ?? 0 };
}
