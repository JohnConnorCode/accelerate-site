import { getResend, FROM_EMAIL } from "./resend";
import { textEmail } from "./templates";
import { emailSequences } from "@/content/email-sequences";
import type { EmailSequenceType } from "@/lib/types";

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
  enrollment: SequenceEnrollment
): Promise<{ sequenceId: string; emailIds: string[] }> {
  const { email, sequenceType, metadata } = enrollment;
  const steps = emailSequences[sequenceType];
  if (!steps || steps.length === 0) {
    throw new Error(`Unknown sequence type: ${sequenceType}`);
  }

  const resend = getResend();
  const emailIds: string[] = [];
  const sequenceId = crypto.randomUUID();

  for (const step of steps) {
    const { subject, bodyTemplate, delayDays } = step;

    const resolvedSubject = replaceTemplateVars(subject, metadata, email);
    const resolvedBody = replaceTemplateVars(bodyTemplate, metadata, email);

    const idempotencyKey = `${sequenceType}/${email}/${step.stepNumber}/${sequenceId}`;

    const sendOptions: Parameters<typeof resend.emails.send>[0] = {
      from: FROM_EMAIL,
      to: email,
      subject: resolvedSubject,
      text: resolvedBody,
      html: textEmail(resolvedBody),
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
        console.error(
          `Failed to schedule step ${step.stepNumber} for ${email}:`,
          error
        );
        continue;
      }

      if (data?.id) {
        emailIds.push(data.id);
      }
    } catch (err) {
      console.error(
        `Error scheduling step ${step.stepNumber} for ${email}:`,
        err
      );
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
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("email_sequences")
    .select("id, metadata")
    .eq("email", email)
    .eq("sequence_type", sequenceType)
    .neq("status", "paused");
  if (!data?.length) return;

  const resend = getResend();
  for (const sequence of data) {
    const ids = Array.isArray(sequence.metadata?.resend_email_ids)
      ? sequence.metadata.resend_email_ids.filter((id: unknown): id is string => typeof id === "string")
      : [];
    await Promise.allSettled(ids.map((id: string) => resend.emails.cancel(id)));
    await supabase.from("email_sequences").update({ status: "paused" }).eq("id", sequence.id);
  }
}

function replaceTemplateVars(
  template: string,
  metadata: Record<string, string>,
  email: string
): string {
  const replacements: Record<string, string> = {
    "{{name}}": metadata.name || "there",
    "{{email}}": email,
    "{{industry}}": metadata.industry || "your",
    "{{planLink}}":
      metadata.planLink || "https://www.acceleratewith.us/contact",
    "{{planSummary}}":
      metadata.planSummary ||
      "Your personalized recommendations are ready.",
    "{{resourceTitle}}": metadata.resourceTitle || "your resource",
    "{{downloadLink}}": metadata.downloadLink || "#",
    "{{score}}": metadata.score || "N/A",
    "{{topIssues}}":
      metadata.topIssues || "See your full report for details.",
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(
      new RegExp(key.replace(/[{}]/g, "\\$&"), "g"),
      value
    );
  }
  return result;
}

async function saveSequenceRecord(
  sequenceId: string,
  enrollment: SequenceEnrollment,
  emailIds: string[]
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
