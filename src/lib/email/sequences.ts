import { siteUrl } from "@/config/tenant";
import { getResend, FROM_EMAIL } from "./resend";
import { emailSequences } from "@/content/email-sequences";
import { resolveEmailTemplate } from "./runtime-template";
import type { EmailSequenceType } from "@/lib/types";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";

interface SequenceEnrollment {
  email: string;
  sequenceType: EmailSequenceType;
  metadata: Record<string, string>;
}

/**
 * Schedules an entire email sequence using Resend's scheduledAt parameter.
 * - Step with delayDays=0 sends immediately
 * - All other steps are scheduled for the future
 * - Each email gets an idempotency key to prevent duplicates
 * - Returns Resend email IDs for tracking/cancellation
 */
export async function scheduleEmailSequence(
  enrollment: SequenceEnrollment,
): Promise<{ sequenceId: string; emailIds: string[] }> {
  const { email, sequenceType, metadata } = enrollment;
  const steps = emailSequences[sequenceType];
  if (!steps || steps.length === 0) {
    throw new Error(`Unknown sequence type: ${sequenceType}`);
  }

  // Test and fixture addresses must never schedule real outbound mail. The
  // contact QA journey proves canonical writes, not delivery; a scheduled
  // nurture to a fixture address would page a real inbox days later.
  const recipient = email.trim().toLowerCase();
  if (
    recipient.endsWith("@example.invalid") ||
    recipient.startsWith("qa-") ||
    recipient.startsWith("qa_")
  ) {
    console.log(`[sequences] QA address: not scheduling ${sequenceType}.`);
    return { sequenceId: crypto.randomUUID(), emailIds: [] };
  }

  const resend = getResend();
  const emailIds: string[] = [];
  const sequenceId = crypto.randomUUID();

  for (const step of steps) {
    const { delayDays } = step;
    const variables = {
      name: "there",
      industry: "your business",
      planLink: siteUrl(),
      planSummary: "the highest-impact next steps for your business",
      resourceTitle: "your requested resource",
      downloadLink: `${siteUrl()}/resources`,
      score: "your current",
      topIssues: "the clearest opportunities to improve response, follow-through, and conversion",
      ...metadata,
      email,
    };
    const resolved = await resolveEmailTemplate(
      `${sequenceType.replaceAll("_", "-")}-${step.stepNumber}`,
      variables,
    );

    const idempotencyKey = `${sequenceType}/${email}/${step.stepNumber}/${sequenceId}`;

    const sendOptions: Parameters<typeof resend.emails.send>[0] = {
      from: FROM_EMAIL,
      to: email,
      subject: resolved.subject,
      text: resolved.text,
      html: resolved.html,
    };

    // Schedule future emails; send step 0 immediately
    if (delayDays > 0) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + delayDays);
      // Schedule for 9 AM UTC on the target day
      scheduledDate.setUTCHours(9, 0, 0, 0);
      sendOptions.scheduledAt = scheduledDate.toISOString();
    }

    try {
      const { data, error } = await resend.emails.send(sendOptions, {
        idempotencyKey,
      });

      if (error) {
        console.error(`Failed to schedule step ${step.stepNumber} for ${email}:`, error);
        continue;
      }

      if (data?.id) {
        emailIds.push(data.id);
      }
    } catch (err) {
      console.error(`Error scheduling step ${step.stepNumber} for ${email}:`, err);
    }
  }

  // Save to Supabase for tracking
  await saveSequenceRecord(sequenceId, enrollment, emailIds);

  return { sequenceId, emailIds };
}

/** Stop scheduled nudges once the prospect books. Already-sent messages are
 * harmless; Resend returns an error for those and we intentionally ignore it. */
export async function cancelScheduledSequences(
  email: string,
  sequenceType: EmailSequenceType,
  dependencies?: { database: SupabaseClient; resend: Resend },
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase =
    dependencies?.database || createBootstrapServiceRoleClient("legacy-email-sequence-cancel");
  const { data } = await supabase
    .from("email_sequences")
    .select("id, metadata")
    .eq("email", email)
    .eq("sequence_type", sequenceType)
    .neq("status", "paused");
  if (!data?.length) return;

  const resend = dependencies?.resend || getResend();
  for (const sequence of data) {
    const ids = Array.isArray(sequence.metadata?.resend_email_ids)
      ? sequence.metadata.resend_email_ids.filter(
          (id: unknown): id is string => typeof id === "string",
        )
      : [];
    await Promise.allSettled(ids.map((id: string) => resend.emails.cancel(id)));
    await supabase.from("email_sequences").update({ status: "paused" }).eq("id", sequence.id);
  }
}

async function saveSequenceRecord(
  sequenceId: string,
  enrollment: SequenceEnrollment,
  emailIds: string[],
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const supabase = createBootstrapServiceRoleClient("legacy-email-sequence-save");

    const steps = emailSequences[enrollment.sequenceType];
    const totalSteps = steps?.length ?? 0;

    const hasScheduledStep = steps?.some((step) => step.delayDays > 0) ?? false;
    await supabase.from("email_sequences").insert({
      id: sequenceId,
      email: enrollment.email,
      sequence_type: enrollment.sequenceType,
      current_step: totalSteps,
      // A sequence with future steps remains active until the automation that
      // owns its lifecycle cancels or completes it. Recording it as completed
      // immediately made the operator view misleading.
      status: hasScheduledStep ? "active" : "completed",
      metadata: {
        ...enrollment.metadata,
        resend_email_ids: emailIds,
      },
    });
  } catch (err) {
    console.error("Failed to save sequence record:", err);
  }
}
