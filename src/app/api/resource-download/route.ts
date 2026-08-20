import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { scheduleEmailSequence } from "@/lib/email/sequences";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { resourceId, name, email, utm } = await request.json();

    if (typeof resourceId !== "string" || !resourceId.trim() || typeof name !== "string" || !name.trim() || typeof email !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Save to Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: dbError } = await supabase.from("resource_downloads").insert({
          resource_id: resourceId,
          name,
          email,
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
        });
        // The visitor still gets the resource, so failing their request over a
        // CRM write would punish them for our fault. But the lead would be lost
        // with nobody knowing, so the operator is told with the details needed
        // to recover it by hand.
        if (dbError) {
          console.error("resource_downloads insert FAILED:", dbError.message);
          await supabase.from("admin_notifications").insert({
            type: "new_lead",
            title: `Resource download not recorded: ${name}`,
            description: `${email} requested ${resourceId}. The database write failed, so this lead exists only in this notification.`,
            link: "/admin/resources",
            priority: "urgent",
          });
        }
      } catch (e) {
        console.warn("Supabase save failed:", e);
      }
    }

    // Schedule resource_welcome email sequence via Resend
    scheduleEmailSequence({
      email,
      sequenceType: "resource_welcome",
      metadata: { name, resourceId },
    }).catch((e) => console.warn("Email sequence scheduling failed:", e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resource download error:", error);
    return NextResponse.json(
      { error: "Failed to process download" },
      { status: 500 }
    );
  }
}
