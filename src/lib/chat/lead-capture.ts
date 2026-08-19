import type { SupabaseClient } from "@supabase/supabase-js";
import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "@/lib/email/resend";
import type { ChatMessage } from "@/lib/types";
import { createRevenueTask } from "@/lib/revenue-os/tasks";

interface ChatLeadInput {
  id: string;
  name: string;
  email: string;
  conversation: ChatMessage[];
  utm?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
  };
  opportunityId?: string;
}

interface SideEffectResult {
  notification: "ok" | "skipped" | "failed";
  task: "ok" | "skipped" | "failed";
  adminEmail: "ok" | "skipped" | "failed";
  welcomeEmail: "ok" | "skipped" | "failed";
}

function firstUserMessageSnippet(conversation: ChatMessage[]): string {
  const firstUser = conversation.find((m) => m.role === "user");
  if (!firstUser) return "(no message)";
  const trimmed = firstUser.content.trim().replace(/\s+/g, " ");
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

function formatTranscript(conversation: ChatMessage[]): string {
  return conversation
    .map((m) => {
      const label = m.role === "user" ? "Visitor" : "Assistant";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.acceleratewith.us";
}

async function insertAdminNotification(
  supabase: SupabaseClient,
  lead: ChatLeadInput,
): Promise<"ok" | "failed"> {
  const snippet = firstUserMessageSnippet(lead.conversation);
  const { error } = await supabase.from("admin_notifications").insert({
    type: "new_chat",
    title: `New chat lead: ${lead.name}`,
    description: snippet,
    link: `/admin/chat-leads`,
    priority: "urgent",
    read: false,
  });
  if (error) {
    console.error("[chat-lead-capture] admin_notifications insert failed:", error.message);
    return "failed";
  }
  return "ok";
}

async function insertFollowUpTask(
  supabase: SupabaseClient,
  lead: ChatLeadInput,
): Promise<"ok" | "failed"> {
  try {
    await createRevenueTask(supabase, { title: `Reply to new chat inquiry: ${lead.name}`, description: `Visitor shared ${lead.email}. First message: "${firstUserMessageSnippet(lead.conversation)}"`, dueDate: new Date().toISOString().slice(0, 10), priority: "high", relatedType: "opportunity", relatedId: lead.opportunityId || null, relatedName: `${lead.name} (chat)`, opportunityId: lead.opportunityId || null, source: "chat", dedupeKey: lead.opportunityId ? `inbound-follow-up:${lead.opportunityId}` : `chat-follow-up:${lead.id}`, actorEmail: "system@acceleratewith.us" });
  } catch (error) {
    console.error("[chat-lead-capture] task service failed:", error);
    return "failed";
  }
  return "ok";
}

async function sendAdminEmail(lead: ChatLeadInput): Promise<"ok" | "skipped" | "failed"> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[chat-lead-capture] RESEND_API_KEY missing, skipping admin email");
    return "skipped";
  }
  const transcript = formatTranscript(lead.conversation);
  const utm = lead.utm
    ? `\n\nUTM source: ${lead.utm.utm_source || "n/a"}  |  medium: ${lead.utm.utm_medium || "n/a"}  |  campaign: ${lead.utm.utm_campaign || "n/a"}`
    : "";
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: lead.email,
      subject: `New chat lead: ${lead.name}`,
      text: `${lead.name} just shared their email in the site chat.

Email: ${lead.email}
View in admin: ${siteUrl()}/admin/chat-leads${utm}

---- Conversation ----

${transcript}`,
    });
    return "ok";
  } catch (err) {
    console.error("[chat-lead-capture] admin email send failed:", err);
    return "failed";
  }
}

async function sendWelcomeEmail(lead: ChatLeadInput): Promise<"ok" | "skipped" | "failed"> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[chat-lead-capture] RESEND_API_KEY missing, skipping welcome email");
    return "skipped";
  }
  const firstName = lead.name.split(/\s+/)[0] || lead.name;
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: lead.email,
      replyTo: ADMIN_EMAIL,
      subject: "Thanks for reaching out, from John at Accelerate",
      text: `Hey ${firstName},

Thanks for jumping into the chat on acceleratewith.us. I saw your note come through and wanted to reach out personally.

If you'd like a deeper look at where AI could plug into your business right now, grab a free strategy call. Thirty minutes, no pitch, and you leave with a plan: ${siteUrl()}/contact

Otherwise, just hit reply on this email. I read every one.

John
Founder, Accelerate
${siteUrl()}`,
    });
    return "ok";
  } catch (err) {
    console.error("[chat-lead-capture] welcome email send failed:", err);
    return "failed";
  }
}

export async function handleChatLeadCapture(
  supabase: SupabaseClient,
  lead: ChatLeadInput,
): Promise<SideEffectResult> {
  const [notif, task, adminEmail, welcomeEmail] = await Promise.allSettled([
    insertAdminNotification(supabase, lead),
    insertFollowUpTask(supabase, lead),
    sendAdminEmail(lead),
    sendWelcomeEmail(lead),
  ]);

  const result: SideEffectResult = {
    notification: notif.status === "fulfilled" ? notif.value : "failed",
    task: task.status === "fulfilled" ? task.value : "failed",
    adminEmail: adminEmail.status === "fulfilled" ? adminEmail.value : "failed",
    welcomeEmail: welcomeEmail.status === "fulfilled" ? welcomeEmail.value : "failed",
  };

  // Log structured summary
  console.warn("[chat-lead-capture] lead", lead.id, "side-effects:", result);

  return result;
}
