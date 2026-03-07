import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { sendContactEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const formData = await request.json();
    const { name, email, message, businessType, utm } = formData;

    if (!name || !email || !message) {
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
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase.from("contact_submissions").insert({
        name,
        email,
        business_type: businessType || null,
        message,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
      });

      // Create admin notification
      supabase.from("admin_notifications").insert({
        type: "new_contact",
        title: `New contact from ${name}`,
        description: message.substring(0, 100),
        link: "/admin/contacts",
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
