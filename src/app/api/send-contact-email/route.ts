import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { sendContactEmail } from "@/lib/email/send";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";
import { recordAudit } from "@/lib/revenue-os/audit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const formData = await request.json();
    const { name, email, message, businessType, companyName, companyWebsite, primaryProblem, utm } =
      formData;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !message.trim() ||
      typeof companyName !== "string" ||
      !companyName.trim() ||
      typeof companyWebsite !== "string" ||
      !companyWebsite.trim() ||
      typeof primaryProblem !== "string" ||
      !primaryProblem.trim()
    ) {
      return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    // Save to Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createBootstrapServiceRoleClient("legacy-public-contact");

      const { data: submission, error: dbError } = await supabase
        .from("contact_submissions")
        .insert({
          name,
          email,
          business_type: businessType || null,
          message,
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
        })
        .select("id")
        .single();
      // Surface insert failures instead of swallowing them (a missing column or
      // dead project would otherwise look like a successful submission).
      if (dbError) {
        console.error("contact_submissions insert FAILED:", dbError.message);
        return NextResponse.json(
          { error: "We couldn't save your request yet. Please try again." },
          { status: 500 },
        );
      }

      // The inquiry is already persisted above. A canonical ingestion failure
      // must not discard it, reject the visitor, or silence the notification —
      // that combination strands a real customer in a table nobody watches. Fail
      // loudly to the operator instead, and keep serving the visitor.
      let canonicalFailure: string | null = null;
      try {
        await ingestInboundLead(supabase, {
          name: name.trim(),
          email: email.trim(),
          companyName: companyName.trim(),
          website: companyWebsite.trim(),
          industry: businessType || null,
          source: "contact_form",
          sourceRecordId: submission.id,
          summary: `${primaryProblem}: ${message.trim()}`,
          utm,
        });
      } catch (ingestError) {
        canonicalFailure = ingestError instanceof Error ? ingestError.message : String(ingestError);
        console.error(
          "[contact] canonical inbound ingestion FAILED (submission preserved):",
          canonicalFailure,
        );
        await recordAudit(supabase, {
          actorEmail: "system",
          action: "inbound.canonical_failed",
          entityType: "contact_submission",
          entityId: submission.id,
          source: "webhook",
          metadata: { inbound_source: "contact_form", error: canonicalFailure },
        });
      }

      // Create admin notification
      supabase
        .from("admin_notifications")
        .insert({
          type: "new_contact",
          title: canonicalFailure
            ? `New contact from ${name} (needs manual entry)`
            : `New contact from ${name}`,
          description: canonicalFailure
            ? `Canonical capture failed: ${canonicalFailure}`.slice(0, 200)
            : message.substring(0, 100),
          link: "/admin/today",
          priority: canonicalFailure ? "urgent" : "info",
        })
        .then(
          () => {},
          () => {},
        );
    }

    // Send email notifications (non-blocking: form succeeds even if email fails).
    // QA journeys submit with reserved markers (see scripts/qa-inbound-pipeline.mjs):
    // their canonical + operator writes are the assertion target, so those stay,
    // but no outbound mail goes anywhere: otherwise every journey run pages the
    // founder with admin alerts for a fixture lead.
    const qaAddress = email.trim().toLowerCase();
    const isQaSubmission =
      qaAddress.endsWith("@example.invalid") ||
      qaAddress.startsWith("qa-") ||
      qaAddress.startsWith("qa_") ||
      utm?.utm_source === "qa-journey";
    if (isQaSubmission) {
      console.log("[contact] QA submission: outbound email suppressed, record kept.");
    } else {
      try {
        await sendContactEmail(formData);
      } catch (emailError) {
        console.error("Email send failed (submission still saved):", emailError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to process contact submission:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
