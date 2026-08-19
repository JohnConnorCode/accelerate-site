import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { sendContactEmail } from "@/lib/email/send";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const formData = await request.json();
    const { name, email, message, businessType, companyName, companyWebsite, primaryProblem, utm } = formData;

    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || typeof message !== "string" || !message.trim() || typeof companyName !== "string" || !companyName.trim() || typeof companyWebsite !== "string" || !companyWebsite.trim() || typeof primaryProblem !== "string" || !primaryProblem.trim()) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Save to Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createServiceRoleClient();

      const { data: submission, error: dbError } = await supabase.from("contact_submissions").insert({
        name,
        email,
        business_type: businessType || null,
        message,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
      }).select("id").single();
      // Surface insert failures instead of swallowing them (a missing column or
      // dead project would otherwise look like a successful submission).
      if (dbError) {
        console.error("contact_submissions insert FAILED:", dbError.message);
        return NextResponse.json({ error: "We couldn't save your request yet. Please try again." }, { status: 500 });
      }

      await ingestInboundLead(supabase, { name: name.trim(), email: email.trim(), companyName: companyName.trim(), website: companyWebsite.trim(), industry: businessType || null, source: "contact_form", sourceRecordId: submission.id, summary: `${primaryProblem}: ${message.trim()}`, utm });

      // Create admin notification
      supabase.from("admin_notifications").insert({
        type: "new_contact",
        title: `New contact from ${name}`,
        description: message.substring(0, 100),
        link: "/admin/today",
      }).then(() => {}, () => {});
    }

    // Send email notifications (non-blocking — form succeeds even if email fails)
    try {
      await sendContactEmail(formData);
    } catch (emailError) {
      console.error("Email send failed (submission still saved):", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to process contact submission:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
