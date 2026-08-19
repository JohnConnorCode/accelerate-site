import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { siteUrl } from "@/config/tenant";
import { recordAudit } from "./audit";
import { normalizeEmail } from "./db";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resendTags(input: { messageId: string; conversationId: string; campaignId?: string; source?: string; template?: string }) {
  const tag = (name: string, value?: string) => value ? { name, value: value.slice(0, 256) } : null;
  return [
    tag("revenue_message_id", input.messageId),
    tag("revenue_conversation_id", input.conversationId),
    tag("revenue_campaign_id", input.campaignId),
    tag("revenue_source", input.source),
    tag("revenue_template", input.template),
  ].filter((value): value is { name: string; value: string } => Boolean(value));
}

export async function sendRecordedEmail(supabase: SupabaseClient, input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  actorEmail?: string;
  contactId?: string;
  opportunityId?: string;
  campaignId?: string;
  conversationId?: string;
  template?: string;
  idempotencyKey?: string;
  source?: "admin" | "campaign" | "automation" | "ai";
}) {
  const to = normalizeEmail(input.to);
  if (!to || !EMAIL_PATTERN.test(to)) throw new Error("A valid recipient email is required");
  if (!input.subject.trim() || !input.text.trim()) throw new Error("Subject and message body are required");
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured");
  if (input.idempotencyKey && input.idempotencyKey.length > 256) throw new Error("Email idempotency keys must be 256 characters or fewer");

  if (input.idempotencyKey) {
    const { data: existing, error } = await supabase.from("messages").select("id,provider_id,status,conversation_id").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (error) throw new Error(error.message);
    if (existing?.status === "sent") return { providerId: existing.provider_id, messageId: existing.id, conversationId: existing.conversation_id };
    if (existing) throw new Error("This email is already being processed; review its receipt before retrying");
  }

  let conversationId = input.conversationId;
  if (!conversationId) {
    // A deterministic external id makes an idempotent retry reuse its local
    // conversation as well as Resend's provider receipt.
    const externalId = input.idempotencyKey ? `resend:${input.idempotencyKey}` : null;
    const { data: conversation, error } = await supabase.from("conversations").upsert({
      channel: "resend",
      external_id: externalId,
      subject: input.subject.trim(),
      contact_id: input.contactId ?? null,
      opportunity_id: input.opportunityId ?? null,
      campaign_id: input.campaignId ?? null,
      status: "waiting",
      last_message_at: new Date().toISOString(),
    }, { onConflict: "channel,external_id", ignoreDuplicates: Boolean(externalId) }).select("id").single();
    if (error) throw new Error(error.message);
    if (conversation) conversationId = conversation.id;
    else if (externalId) {
      const { data: existingConversation, error: existingError } = await supabase.from("conversations").select("id").eq("channel", "resend").eq("external_id", externalId).single();
      if (existingError) throw new Error(existingError.message);
      conversationId = existingConversation.id;
    }
  }
  if (!conversationId) throw new Error("Email conversation could not be created");

  let unsubscribeUrl: string | null = null;
  if (input.source === "campaign" && input.contactId) {
    const { data: contact } = await supabase.from("contacts").select("communication_status,unsubscribe_token").eq("id", input.contactId).maybeSingle();
    if (contact && contact.communication_status !== "active") throw new Error("Contact is suppressed from campaign email");
    if (contact?.unsubscribe_token) unsubscribeUrl = `${siteUrl()}/api/unsubscribe/${contact.unsubscribe_token}`;
  }

  const claimId = crypto.randomUUID();
  const { error: claimError } = await supabase.from("messages").insert({ id: claimId, conversation_id: conversationId, idempotency_key: input.idempotencyKey || null, direction: "outbound", sender_email: FROM_EMAIL, recipient_emails: [to], subject: input.subject.trim(), body_text: input.text, body_html: input.html ?? null, status: "processing", metadata: { template: input.template ?? null, source: input.source ?? "admin", campaign_id: input.campaignId ?? null } });
  if (claimError) throw new Error(claimError.code === "23505" ? "This email has already been claimed" : claimError.message);

  const deliveredText = unsubscribeUrl ? `${input.text}\n\nUnsubscribe: ${unsubscribeUrl}` : input.text;
  const deliveredHtml = unsubscribeUrl && input.html ? `${input.html}<p style="margin-top:24px;font-size:12px;color:#777"><a href="${unsubscribeUrl}">Unsubscribe</a></p>` : input.html;
  const response = await getResend().emails.send({
    from: FROM_EMAIL,
    replyTo: input.actorEmail || process.env.ADMIN_EMAIL || undefined,
    to,
    subject: input.subject.trim(),
    text: deliveredText,
    html: deliveredHtml,
    headers: unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
    tags: resendTags({ messageId: claimId, conversationId, campaignId: input.campaignId, source: input.source ?? "admin", template: input.template }),
  }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);
  if (response.error) {
    await supabase.from("messages").update({ status: "failed", metadata: { source: input.source ?? "admin", error: response.error.message } }).eq("id", claimId);
    throw new Error(response.error.message);
  }
  const providerId = response.data?.id ?? null;
  const now = new Date().toISOString();

  const { data: message, error: messageError } = await supabase.from("messages").update({
    provider_id: providerId,
    direction: "outbound",
    sender_email: FROM_EMAIL,
    recipient_emails: [to],
    subject: input.subject.trim(),
    body_text: deliveredText,
    body_html: deliveredHtml ?? null,
    status: "sent",
    sent_at: now,
    metadata: { template: input.template ?? null, source: input.source ?? "admin", campaign_id: input.campaignId ?? null, unsubscribe_url: unsubscribeUrl },
  }).eq("id", claimId).select("id").single();
  if (messageError || !message) {
    // Resend may already have accepted the message.  Do not report a successful
    // send or permit a blind retry until the durable local receipt is reconciled.
    throw new Error("Email provider accepted the message but its local receipt could not be recorded; reconcile before retrying");
  }

  await Promise.all([
    supabase.from("sent_emails").insert({
      to_email: to,
      subject: input.subject.trim(),
      body: input.text,
      related_type: input.opportunityId ? "lead" : null,
      related_id: input.opportunityId ?? null,
      template_used: input.template ?? null,
    }),
    supabase.from("activities").insert({
      activity_type: "email_sent",
      title: input.subject.trim(),
      summary: `Email sent to ${to}`,
      contact_id: input.contactId ?? null,
      opportunity_id: input.opportunityId ?? null,
      conversation_id: conversationId,
      campaign_id: input.campaignId ?? null,
      source: input.source ?? "admin",
      actor_email: input.actorEmail ?? null,
      external_id: providerId,
      occurred_at: now,
    }),
    supabase.from("conversations").update({ last_message_at: now, status: "waiting" }).eq("id", conversationId),
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "email.sent",
      entityType: "conversation",
      entityId: conversationId,
      source: input.source === "ai" ? "ai" : input.source === "campaign" || input.source === "automation" ? "automation" : "admin",
      metadata: { provider_id: providerId, message_id: message?.id ?? null, recipient: to },
    }),
  ]);

  return { providerId, messageId: message?.id ?? null, conversationId };
}
