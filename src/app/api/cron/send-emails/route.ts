import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { emailSequences } from "@/content/email-sequences";
import type { EmailSequenceType } from "@/lib/types";
import { getSetting } from "@/lib/admin/settings";

// This endpoint is called by a CRON job (e.g., Vercel Cron) to process email sequences.
// It checks for sequences with next_send_at <= now and sends the next email in the sequence.
// In production, integrate with Resend, SendGrid, or similar for actual delivery.

export async function GET(request: NextRequest) {
  // CRON_SECRET must be configured — reject if missing
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  // Verify cron secret with timing-safe comparison
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(cronSecret);
  if (tokenBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    // Get sequences that are due
    const { data: dueSequences, error } = await supabase
      .from("email_sequences")
      .select("*")
      .eq("status", "active")
      .lte("next_send_at", now)
      .limit(50);

    if (error) {
      console.error("Failed to fetch due sequences:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!dueSequences || dueSequences.length === 0) {
      return NextResponse.json({ processed: 0, message: "No sequences due" });
    }

    let processed = 0;
    let completed = 0;

    for (const seq of dueSequences) {
      const seqType = seq.sequence_type as EmailSequenceType;
      const steps = emailSequences[seqType];

      if (!steps) continue;

      const nextStep = seq.current_step;

      if (nextStep >= steps.length) {
        // Sequence complete
        await supabase
          .from("email_sequences")
          .update({ status: "completed", next_send_at: null })
          .eq("id", seq.id);
        completed++;
        continue;
      }

      const step = steps[nextStep];
      if (!step) continue;
      const metadata = seq.metadata || {};

      // Replace template variables
      let subject = step.subject;
      let body = step.bodyTemplate;

      const replacements: Record<string, string> = {
        "{{name}}": metadata.name || "there",
        "{{email}}": seq.email,
        "{{industry}}": metadata.industry || "your",
        "{{planLink}}": metadata.planLink || "https://acceleratewith.us/plan-builder",
        "{{planSummary}}": metadata.planSummary || "Your personalized recommendations are ready.",
        "{{resourceTitle}}": metadata.resourceTitle || "your resource",
        "{{downloadLink}}": metadata.downloadLink || "#",
        "{{score}}": metadata.score || "N/A",
        "{{topIssues}}": metadata.topIssues || "See your full report for details.",
      };

      for (const [key, value] of Object.entries(replacements)) {
        subject = subject.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
        body = body.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
      }

      // Send via Resend
      const resendApiKey = await getSetting("RESEND_API_KEY");
      const fromEmail = (await getSetting("RESEND_FROM_EMAIL")) || "Accelerate <john@acceleratewith.us>";
      if (resendApiKey) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: fromEmail,
            to: seq.email,
            subject,
            text: body,
          });
        } catch (sendErr) {
          console.error(`Failed to send email to ${seq.email}:`, sendErr);
        }
      }

      // Log the sent email
      await supabase.from("email_sequence_logs").insert({
        sequence_id: seq.id,
        step_number: nextStep,
        subject,
      });

      // Calculate next send time
      const newStep = nextStep + 1;
      let nextSendAt: string | null = null;

      if (newStep < steps.length) {
        const nextDelay = steps[newStep]?.delayDays ?? 1;
        const next = new Date();
        next.setDate(next.getDate() + nextDelay);
        nextSendAt = next.toISOString();
      }

      await supabase
        .from("email_sequences")
        .update({
          current_step: newStep,
          next_send_at: nextSendAt,
          status: newStep >= steps.length ? "completed" : "active",
        })
        .eq("id", seq.id);

      processed++;
    }

    return NextResponse.json({
      processed,
      completed,
      message: `Processed ${processed} emails, ${completed} sequences completed`,
    });
  } catch (error) {
    console.error("CRON email error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
