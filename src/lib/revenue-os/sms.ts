import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import { proposeAction } from "./actions";
import { findCanonicalContactByPhone } from "./identity";
import {
  E164_PHONE,
  SMS_OPT_IN,
  SMS_OPT_OUT,
  findSentTwilioSms,
  tenantTwilioClient,
} from "./twilio-adapter";

/**
 * Text messages as conversations. One conversation holds every text between
 * one customer number and the workspace's number. Inbound texts arrive through
 * the signed Twilio webhook; outbound texts are only ever sent by an approved
 * send_sms action. A STOP keyword opts that number out on its conversation, and
 * no send runs while it is opted out.
 */
export interface InboundSms {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
}

const MESSAGE_SID = /^(SM|MM)[0-9a-f]{32}$/;
export const smsThreadId = (businessNumber: string, customerNumber: string) =>
  `${businessNumber}:${customerNumber}`;

function tenantFor(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Text messages require a tenant-bound workspace");
  return tenantId;
}

export function smsOptedOut(metadata: unknown) {
  return Boolean(
    metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).smsOptOut,
  );
}

export async function ingestInboundSms(db: SupabaseClient, sms: InboundSms) {
  const tenantId = tenantFor(db);
  if (!MESSAGE_SID.test(sms.messageSid) || !E164_PHONE.test(sms.from) || !E164_PHONE.test(sms.to))
    throw new Error("Inbound text is missing its Twilio identifiers");
  const externalId = smsThreadId(sms.to, sms.from);
  const find = () =>
    db
      .from("conversations")
      .select("id,contact_id,unread_count,metadata")
      .eq("tenant_id", tenantId)
      .eq("channel", "sms")
      .eq("external_id", externalId)
      .maybeSingle();
  let { data: conversation, error } = await find();
  if (error) throw new Error(error.message);
  if (!conversation) {
    // An unknown number stays unlinked rather than becoming a new contact.
    const contact = await findCanonicalContactByPhone(db, sms.from).catch(() => {
      // Ambiguous or unreadable matches leave the thread unlinked; the number is not logged.
      console.warn("[sms] inbound text left unlinked: no single contact matched");
      return null;
    });
    const created = await db
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        channel: "sms",
        external_id: externalId,
        subject: `Text messages with ${sms.from}`,
        contact_id: contact?.id ?? null,
        status: "open",
        unread_count: 0,
        last_message_at: sms.receivedAt,
        metadata: { provider: "twilio", customerPhone: sms.from, businessPhone: sms.to },
      })
      .select("id,contact_id,unread_count,metadata")
      .single();
    if (created.error?.code === "23505") ({ data: conversation, error } = await find());
    else ({ data: conversation, error } = created);
    if (error || !conversation) throw new Error(error?.message ?? "Text conversation unavailable");
  }
  const { error: messageError } = await db.from("messages").insert({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    external_id: sms.messageSid,
    provider_id: `twilio:${sms.messageSid}`,
    direction: "inbound",
    recipient_emails: [],
    body_text: sms.body,
    status: "received",
    received_at: sms.receivedAt,
    metadata: { from: sms.from, to: sms.to },
  });
  // Twilio retries a webhook it could not confirm; the message id makes a replay a no-op.
  if (messageError?.code === "23505")
    return { conversationId: conversation.id as string, duplicate: true, optOut: null };
  if (messageError) throw new Error(messageError.message);
  const keyword = sms.body.trim();
  const optOut = SMS_OPT_OUT.test(keyword) ? true : SMS_OPT_IN.test(keyword) ? false : null;
  const metadata = (conversation.metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await db
    .from("conversations")
    .update({
      status: "open",
      unread_count: Number(conversation.unread_count ?? 0) + 1,
      last_message_at: sms.receivedAt,
      updated_at: new Date().toISOString(),
      metadata:
        optOut === null
          ? metadata
          : { ...metadata, smsOptOut: optOut, smsOptOutChangedAt: sms.receivedAt },
    })
    .eq("tenant_id", tenantId)
    .eq("id", conversation.id);
  if (updateError) throw new Error(updateError.message);
  return { conversationId: conversation.id as string, duplicate: false, optOut };
}

/** The text conversation a send_sms action targets, refused when it cannot receive texts. */
export async function readSmsTarget(db: SupabaseClient, conversationId: string) {
  const tenantId = tenantFor(db);
  const { data: conversation, error } = await db
    .from("conversations")
    .select("id,channel,status,contact_id,metadata")
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation || conversation.channel !== "sms")
    throw new Error("This is not a text conversation");
  if (conversation.status === "archived")
    throw new Error("Cannot send a text: the conversation is archived");
  if (smsOptedOut(conversation.metadata))
    throw new Error("Cannot send a text: this number replied STOP and is opted out");
  const to = (conversation.metadata as Record<string, unknown>)?.customerPhone;
  if (typeof to !== "string" || !E164_PHONE.test(to))
    throw new Error("This conversation has no customer number");
  if (conversation.contact_id) {
    const { data: contact, error: contactError } = await db
      .from("contacts")
      .select("communication_status")
      .eq("tenant_id", tenantId)
      .eq("id", conversation.contact_id)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);
    if (contact && contact.communication_status !== "active")
      throw new Error("Cannot send a text: this contact is suppressed");
  }
  return { conversationId: conversation.id as string, to };
}

export const SMS_MAX_LENGTH = 1600;

/**
 * Stages a text reply for approval. The Conversations composer and the
 * assistant both call this: no text ever sends without an approved send_sms.
 */
export async function proposeSmsReply(
  db: SupabaseClient,
  input: {
    conversationId: string;
    body: string;
    proposedBy?: string | null;
    sourceContext: string;
    reasoning?: string;
  },
) {
  const body = input.body.trim();
  if (!body || body.length > SMS_MAX_LENGTH)
    throw new Error(`A text needs 1 to ${SMS_MAX_LENGTH.toLocaleString("en-US")} characters.`);
  const target = await readSmsTarget(db, input.conversationId);
  const contentKey = createHash("sha256").update(body).digest("hex");
  return proposeAction(db, {
    actionType: "send_sms",
    title: `Text ${target.to}`,
    description: body.slice(0, 180),
    urgency: "normal",
    payload: { conversationId: target.conversationId, to: target.to, body },
    reasoning: input.reasoning,
    sourceContext: input.sourceContext,
    entityType: "conversation",
    entityId: target.conversationId,
    dedupeKey: `sms-reply:${target.conversationId}:${contentKey}`,
    proposedBy: input.proposedBy ?? undefined,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

/** Records a text Twilio accepted, on its conversation. Recording twice is a no-op. */
export async function recordOutboundSms(
  db: SupabaseClient,
  input: {
    conversationId: string;
    sid: string;
    status: string;
    to: string;
    from: string;
    body: string;
  },
) {
  const tenantId = tenantFor(db);
  const now = new Date().toISOString();
  const { error } = await db.from("messages").insert({
    tenant_id: tenantId,
    conversation_id: input.conversationId,
    external_id: input.sid,
    provider_id: `twilio:${input.sid}`,
    direction: "outbound",
    recipient_emails: [],
    body_text: input.body,
    status: input.status,
    sent_at: now,
    metadata: { from: input.from, to: input.to },
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  const { error: updateError } = await db
    .from("conversations")
    .update({ status: "waiting", last_message_at: now, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", input.conversationId);
  if (updateError) throw new Error(updateError.message);
}

/**
 * Settles a send_sms action whose send timed out. If Twilio's log holds the
 * exact text it is recorded as sent; otherwise it is recorded as not sent, and
 * a new text is a new proposal. It never sends.
 */
export async function reconcileSmsAction(db: SupabaseClient, actionId: string) {
  const tenantId = tenantFor(db);
  const { data: action, error } = await db
    .from("action_queue")
    .select("id,action_type,status,payload,approved_at,created_at,error")
    .eq("tenant_id", tenantId)
    .eq("id", actionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!action || action.action_type !== "send_sms" || action.status !== "failed")
    throw new Error("Only a failed text can be reconciled");
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const conversationId = String(payload.conversationId ?? "");
  const to = String(payload.to ?? "");
  const body = String(payload.body ?? "");
  const client = await tenantTwilioClient(db);
  const sent = await findSentTwilioSms(client, {
    to,
    body,
    since: String(action.approved_at ?? action.created_at),
  });
  if (sent) {
    await recordOutboundSms(db, { conversationId, ...sent, to, from: client.fromNumber, body });
    const result = { provider: "twilio", sid: sent.sid, status: sent.status, to, reconciled: true };
    const { error: settleError } = await db
      .from("action_queue")
      .update({ status: "executed", executed_at: new Date().toISOString(), result, error: null })
      .eq("tenant_id", tenantId)
      .eq("id", actionId)
      .eq("status", "failed");
    if (settleError) throw new Error(settleError.message);
    return result;
  }
  const result = { provider: "twilio", sent: false, reconciled: true };
  const { error: settleError } = await db
    .from("action_queue")
    .update({
      result,
      error: "Not sent: Twilio has no record of this text. Prepare a new text to try again.",
    })
    .eq("tenant_id", tenantId)
    .eq("id", actionId)
    .eq("status", "failed");
  if (settleError) throw new Error(settleError.message);
  return result;
}
