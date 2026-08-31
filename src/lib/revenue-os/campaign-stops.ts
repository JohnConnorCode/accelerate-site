import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";

export type CampaignStopReason =
  | "public_unsubscribe"
  | "resend_bounced"
  | "resend_complained"
  | "resend_suppressed"
  | "gmail_reply"
  | "calendar_booking"
  | "opportunity_converted"
  | "opportunity_progressed"
  | "manual_pause"
  | "policy_invalidated";

export function campaignStopStatus(reason: CampaignStopReason) {
  if (reason === "public_unsubscribe") return "unsubscribed";
  if (reason === "resend_bounced" || reason === "resend_suppressed") return "bounced";
  return "stopped";
}

type EmailSuppressionReason = "public_unsubscribe" | "resend_bounced" | "resend_complained" | "resend_suppressed";

/**
 * The only writer for contact-level campaign email eligibility. Source
 * adapters provide a verified stop fact; this service persists the contact
 * state before stopping outstanding memberships so the campaign executor's
 * just-in-time eligibility check cannot send another step.
 */
export async function suppressContactFromCampaignEmail(supabase: SupabaseClient, input: {
  contactId: string;
  reason: EmailSuppressionReason;
  campaignId?: string | null;
  source: "webhook" | "automation" | "admin";
  sourceReceiptId?: string;
  actorEmail?: string;
}) {
  const communicationStatus = input.reason === "public_unsubscribe" ? "unsubscribed" : "suppressed";
  let contactUpdate = supabase.from("contacts").update({ communication_status: communicationStatus, updated_at: new Date().toISOString() }).eq("id", input.contactId);
  if (communicationStatus === "suppressed") contactUpdate = contactUpdate.neq("communication_status", "unsubscribed");
  const { error } = await contactUpdate;
  if (error) throw new Error(error.message);

  const stopped = await stopCampaignMemberships(supabase, input);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: communicationStatus === "unsubscribed" ? "contact.unsubscribed" : "contact.email_suppressed",
    entityType: "contact",
    entityId: input.contactId,
    source: input.source,
    metadata: { reason: input.reason, campaign_id: input.campaignId ?? null, source_receipt_id: input.sourceReceiptId ?? null },
  });
  return { communicationStatus, ...stopped };
}

/**
 * The only writer for future campaign-send eligibility. It is deliberately
 * contact/campaign scoped: source adapters provide facts, this service records
 * the safety outcome before a later JIT claim can execute another step.
 */
export async function stopCampaignMemberships(supabase: SupabaseClient, input: {
  contactId: string;
  reason: CampaignStopReason;
  campaignId?: string | null;
  source: "webhook" | "automation" | "admin";
  sourceReceiptId?: string;
  actorEmail?: string;
}) {
  const { data, error } = await supabase.rpc("stop_campaign_memberships", {
    p_contact_id: input.contactId,
    p_campaign_id: input.campaignId ?? null,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  const stopped = (data ?? []) as Array<{ member_id: string; campaign_id: string }>;

  const occurredAt = new Date().toISOString();
  const stoppedKey = createHash("sha256").update(stopped.map((member) => member.member_id).sort().join(",")).digest("hex").slice(0, 20);
  const activityKey = input.sourceReceiptId ? `campaign-stop:${input.sourceReceiptId}` : `campaign-stop:${input.contactId}:${input.campaignId ?? "all"}:${input.reason}:${stoppedKey}`;
  if (stopped.length) {
    await recordActivity(supabase, {
      activityType: "campaign_stopped",
      title: "Campaign follow-up stopped",
      summary: `${stopped.length} pending campaign membership${stopped.length === 1 ? "" : "s"} stopped: ${input.reason.replaceAll("_", " ")}.`,
      contactId: input.contactId,
      campaignId: input.campaignId ?? null,
      source: input.source,
      externalId: activityKey,
      occurredAt,
      metadata: { reason: input.reason, stopped_member_ids: stopped.map((member) => member.member_id) },
    });
  }
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "campaign.members_stopped",
    entityType: "contact",
    entityId: input.contactId,
    source: input.source,
    metadata: { campaign_id: input.campaignId ?? null, reason: input.reason, source_receipt_id: input.sourceReceiptId ?? null, affected_members: stopped?.map((member) => member.member_id) ?? [] },
  });
  return { stopped: stopped.length, memberIds: stopped.map((member) => member.member_id) };
}

export async function campaignMemberMaySend(supabase: SupabaseClient, input: { memberId: string; campaignId: string }) {
  const { data: member, error } = await supabase.from("campaign_members")
    .select("id,status,contacts!campaign_members_contact_id_tenant_fkey(communication_status),campaigns!campaign_members_campaign_id_tenant_fkey(status,version,approved_version)")
    .eq("id", input.memberId).eq("campaign_id", input.campaignId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!member || member.status !== "sending") return false;
  const contact = Array.isArray(member.contacts) ? member.contacts[0] : member.contacts;
  const campaign = Array.isArray(member.campaigns) ? member.campaigns[0] : member.campaigns;
  return contact?.communication_status === "active" && campaign?.status === "active" && campaign.version === campaign.approved_version;
}
