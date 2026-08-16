import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { recordAudit } from "./audit";
import { normalizeEmail } from "./db";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  source?: "admin" | "campaign" | "automation" | "ai";
}) {
  const to = normalizeEmail(input.to);
  if (!to || !EMAIL_PATTERN.test(to)) throw new Error("A valid recipient email is required");
  if (!input.subject.trim() || !input.text.trim()) throw new Error("Subject and message body are required");
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured");

  let conversationId = input.conversationId;
  if (!conversationId) {
    const { data: conversation, error } = await supabase.from("conversations").insert({
      channel: "resend",
      subject: input.subject.trim(),
      contact_id: input.contactId ?? null,
      opportunity_id: input.opportunityId ?? null,
      campaign_id: input.campaignId ?? null,
      status: "waiting",
      last_message_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw new Error(error.message);
    conversationId = conversation.id;
  }

  const response = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: input.subject.trim(),
    text: input.text,
    html: input.html,
  });
  if (response.error) throw new Error(response.error.message);
  const providerId = response.data?.id ?? null;
  const now = new Date().toISOString();

  const { data: message, error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    provider_id: providerId,
    direction: "outbound",
    sender_email: FROM_EMAIL,
    recipient_emails: [to],
    subject: input.subject.trim(),
    body_text: input.text,
    body_html: input.html ?? null,
    status: "sent",
    sent_at: now,
    metadata: { template: input.template ?? null, source: input.source ?? "admin", campaign_id: input.campaignId ?? null },
  }).select("id").single();
  if (messageError) console.error("[revenue-os/email] provider sent but message receipt failed", messageError.message);

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
