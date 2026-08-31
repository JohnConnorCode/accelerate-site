import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendRecordedEmail } from "./communications";
import { recordAudit } from "./audit";
import { campaignMemberMaySend, stopCampaignMemberships } from "./campaign-stops";
import { isMissingRevenueSchema } from "./db";
import { recordStaleClaimRecovery, STALE_CLAIM_WINDOW_MS } from "./runs";
import { getTenantFromEmail, getTenantReplyToEmail, getTenantResend } from "@/lib/email/resend";

interface CampaignPolicy {
  daily_limit?: number;
  stop_on_reply?: boolean;
  stop_on_booking?: boolean;
  stop_on_bounce?: boolean;
  stop_on_unsubscribe?: boolean;
}

const DEFAULT_POLICY: Required<CampaignPolicy> = {
  daily_limit: 10,
  stop_on_reply: true,
  stop_on_booking: true,
  stop_on_bounce: true,
  stop_on_unsubscribe: true,
};

export function normalizeCampaignPolicy(value: unknown): Required<CampaignPolicy> {
  const input = value && typeof value === "object" ? value as CampaignPolicy : {};
  return {
    daily_limit: Math.min(process.env.CAMPAIGN_AUTOMATION_ENABLED === "true" ? 200 : 10, Math.max(1, Number(input.daily_limit) || DEFAULT_POLICY.daily_limit)),
    stop_on_reply: input.stop_on_reply !== false,
    stop_on_booking: input.stop_on_booking !== false,
    stop_on_bounce: input.stop_on_bounce !== false,
    stop_on_unsubscribe: input.stop_on_unsubscribe !== false,
  };
}

/**
 * The account-wide ceiling. The per-campaign daily limit alone let N active
 * campaigns each send their own cap from the same sending domain, so the real
 * exposure was N x limit with nothing watching the total. Defaults to the same
 * ceiling as a single campaign, which is deliberately conservative.
 */
export function globalDailySendCap(): number {
  const automationCeiling = process.env.CAMPAIGN_AUTOMATION_ENABLED === "true" ? 200 : 10;
  const override = Number(process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT);
  return Number.isFinite(override) && override > 0 ? Math.min(override, automationCeiling * 10) : automationCeiling;
}

/** How many times a failed send is retried before the member is stopped. */
export const MAX_SEND_ATTEMPTS = 3;

/**
 * A member is flipped to `sending` by the claim, and every path out of that
 * state runs inside the same process. If that process dies the member stays
 * `sending` forever: the executor only selects queued and active members, so
 * nothing ever looks at it again. Releasing stale claims at the top of a run
 * is the recovery, bounded by age so a send genuinely in flight is never
 * duplicated.
 */
export async function recoverStaleCampaignSendClaims(supabase: SupabaseClient, now = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_WINDOW_MS).toISOString();
  const { data, error } = await supabase.from("campaign_members")
    .update({ status: "active", next_send_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("send_claimed_at", staleBefore)
    .select("id,campaign_id,send_claim_key");
  if (error) throw new Error(`releasing stale send claims: ${error.message}`);
  for (const row of data ?? []) {
    await recordStaleClaimRecovery(supabase, {
      entityType: "campaign_member",
      entityId: String(row.id),
      jobKey: typeof row.send_claim_key === "string" ? row.send_claim_key : null,
      detail: "A campaign send claimed this member and never reported a terminal state, so the claim was released for a later executor to retry under the original send key.",
    });
  }
  return data?.length ?? 0;
}

export function renderCampaignTemplate(template: string, values: Record<string, string | null | undefined>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key]?.trim() || "");
}

async function claimCampaignMemberSend(supabase: SupabaseClient, memberId: string, claimKey: string) {
  const { data, error } = await supabase.rpc("claim_campaign_member_send", { p_member_id: memberId, p_claim_key: claimKey }).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean((data as { claimed?: boolean } | null)?.claimed);
}

export async function activateCampaign(supabase: SupabaseClient, id: string, actorEmail: string) {
  const { data: campaign, error } = await supabase.from("campaigns").select("id,status,version,approved_version,name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");
  const { count, error: stepError } = await supabase.from("campaign_steps").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("active", true);
  if (stepError) throw new Error(stepError.message);
  if (!count) throw new Error("Add at least one active step before launching this campaign");
  if (count > 1 && process.env.CAMPAIGN_AUTOMATION_ENABLED !== "true") throw new Error("The money-first pilot is limited to one email step until automated reply and bounce stops are enabled");

  // Launch is the commitment point. Validate the workspace-owned delivery
  // credential, verified identity, and monitored response inbox before any
  // member becomes due, rather than allowing the first scheduled send to
  // discover an incomplete client handoff.
  await Promise.all([
    getTenantResend(supabase),
    getTenantFromEmail(supabase),
    getTenantReplyToEmail(supabase),
  ]);

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

export async function executeDueCampaignMembers(supabase: SupabaseClient, now = new Date(), campaignId?: string) {
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  let campaignQuery = supabase.from("campaigns").select("id,name,status,version,approved_version,policy,sender_name,sender_email").eq("status", "active");
  if (campaignId) campaignQuery = campaignQuery.eq("id", campaignId);
  const { data: campaigns, error } = await campaignQuery;
  if (error) throw new Error(error.message);
  const recoveryByCampaign = new Map<string, { offer_label: string; booking_url: string }>();
  if (campaigns?.length) {
    const { data: recoveryPlaybooks, error: recoveryError } = await supabase.from("recovery_playbooks")
      .select("campaign_id,offer_label,booking_url").in("campaign_id", campaigns.map((campaign) => campaign.id));
    // Ordinary campaign delivery remains available during a staged schema
    // rollout; recovery launches cannot exist until this table does.
    if (recoveryError && !isMissingRevenueSchema(recoveryError)) throw new Error(recoveryError.message);
    for (const playbook of recoveryPlaybooks ?? []) recoveryByCampaign.set(playbook.campaign_id, playbook);
  }
  let sent = 0;
  let failed = 0;
  let stopped = 0;
  let unclaimed = 0;
  const recoveredSends = await recoverStaleCampaignSendClaims(supabase, now);

  // One account-wide budget, shared across every active campaign.
  const { count: sentTodayAllCampaigns } = await supabase.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>source", "campaign")
    .gte("sent_at", dayStart.toISOString());
  let globalRemaining = Math.max(0, globalDailySendCap() - (sentTodayAllCampaigns ?? 0));

  for (const campaign of campaigns ?? []) {
    if (campaign.version !== campaign.approved_version) {
      await supabase.from("campaigns").update({ status: "review" }).eq("id", campaign.id).eq("status", "active");
      stopped++;
      continue;
    }
    const policy = normalizeCampaignPolicy(campaign.policy);
    const { count: sentToday } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("metadata->>source", "campaign").eq("metadata->>campaign_id", campaign.id).gte("sent_at", dayStart.toISOString());
    if (!globalRemaining) break;
    const remaining = Math.min(globalRemaining, Math.max(0, policy.daily_limit - (sentToday ?? 0)));
    if (!remaining) continue;

    const { data: members, error: memberError } = await supabase.from("campaign_members")
      .select("id,email,current_step,contact_id,opportunity_id,send_attempts,contacts!campaign_members_contact_id_tenant_fkey(full_name),opportunities!campaign_members_opportunity_id_tenant_fkey(name,stage)")
      .eq("campaign_id", campaign.id).in("status", ["queued", "active"]).lte("next_send_at", now.toISOString())
      .order("next_send_at", { ascending: true }).limit(remaining);
    if (memberError) throw new Error(memberError.message);

    const { data: steps, error: stepError } = await supabase.from("campaign_steps").select("step_order,delay_days,subject_template,body_template").eq("campaign_id", campaign.id).eq("active", true).order("step_order");
    if (stepError) throw new Error(stepError.message);

    for (const member of members ?? []) {
      const opportunity = Array.isArray(member.opportunities) ? member.opportunities[0] : member.opportunities;
      if (opportunity && ["meeting", "proposal", "negotiation", "won", "lost", "booked", "showed"].includes(opportunity.stage)) {
        await stopCampaignMemberships(supabase, { contactId: member.contact_id, campaignId: campaign.id, reason: opportunity.stage === "won" ? "opportunity_converted" : "opportunity_progressed", source: "automation" });
        stopped++;
        continue;
      }
      const step = (steps ?? [])[member.current_step];
      if (!step) {
        await supabase.from("campaign_members").update({ status: "completed", next_send_at: null }).eq("id", member.id);
        continue;
      }
      const contact = Array.isArray(member.contacts) ? member.contacts[0] : member.contacts;
      const recovery = recoveryByCampaign.get(campaign.id);
      const values = {
        first_name: contact?.full_name?.split(" ")[0] ?? "",
        full_name: contact?.full_name ?? "",
        company: opportunity?.name ?? "",
        offer_label: recovery?.offer_label ?? "",
        booking_url: recovery?.booking_url ?? "",
      };
      const idempotencyKey = `campaign:${campaign.id}:member:${member.id}:step:${step.step_order}`;
      // A member that cannot be claimed is not a no-op worth hiding: it means
      // suppressed, paused, version-drifted, not due, or missing a canonical
      // contact. Counting it is what turns "the campaign sent nothing" from an
      // invisible success into a reportable outcome.
      if (!await claimCampaignMemberSend(supabase, member.id, idempotencyKey)) {
        unclaimed++;
        continue;
      }
      try {
        if (!await campaignMemberMaySend(supabase, { memberId: member.id, campaignId: campaign.id })) {
          await supabase.from("campaign_members").update({ status: "stopped", stop_reason: "pre_send_policy_check", next_send_at: null }).eq("id", member.id).eq("status", "sending");
          stopped++;
          continue;
        }
        await sendRecordedEmail(supabase, {
          to: member.email,
          subject: renderCampaignTemplate(step.subject_template, values),
          text: renderCampaignTemplate(step.body_template, values),
          contactId: member.contact_id ?? undefined,
          opportunityId: member.opportunity_id ?? undefined,
          campaignId: campaign.id,
          template: `campaign:${campaign.id}:step:${step.step_order}`,
          from: campaign.sender_email ? (campaign.sender_name ? `${campaign.sender_name} <${campaign.sender_email}>` : campaign.sender_email) : undefined,
          source: "campaign",
          idempotencyKey,
        });
        const nextStep = (steps ?? [])[member.current_step + 1];
        const nextAt = nextStep ? new Date(now.getTime() + nextStep.delay_days * 86400000).toISOString() : null;
        await supabase.from("campaign_members").update({
          current_step: member.current_step + 1,
          status: nextStep ? "active" : "completed",
          last_sent_at: now.toISOString(),
          next_send_at: nextAt,
          // A delivered step clears the retry budget for the next one.
          send_attempts: 0,
        }).eq("id", member.id).eq("status", "sending");
        sent++;
        globalRemaining--;
      } catch (sendError) {
        console.error("[campaign-executor]", sendError);
        // A transient provider failure used to end the member permanently:
        // status stopped with next_send_at null could only be undone by hand.
        // Retry with backoff a bounded number of times, then stop for real.
        const attempts = (member.send_attempts ?? 0) + 1;
        const exhausted = attempts >= MAX_SEND_ATTEMPTS;
        await supabase.from("campaign_members").update({
          status: exhausted ? "stopped" : "active",
          stop_reason: exhausted ? "send_failed_requires_reconciliation" : null,
          send_attempts: attempts,
          next_send_at: exhausted ? null : new Date(now.getTime() + attempts * 3600000).toISOString(),
        }).eq("id", member.id).eq("status", "sending");
        failed++;
      }
    }
  }
  return { sent, failed, stopped, unclaimed, recoveredSends, campaigns: campaigns?.length ?? 0 };
}
