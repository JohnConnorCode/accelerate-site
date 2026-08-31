import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, email, company, website, partnerType, message, utm } = body;

    if (!name || !email || !company || !partnerType || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (
      (typeof name === "string" && name.length > 100) ||
      (typeof email === "string" && email.length > 254) ||
      (typeof company === "string" && company.length > 200) ||
      (typeof website === "string" && website.length > 500) ||
      (typeof partnerType === "string" && partnerType.length > 100) ||
      (typeof message === "string" && message.length > 5000)
    ) {
      return NextResponse.json(
        { error: "One or more fields exceed the maximum allowed length." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Save to Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createBootstrapServiceRoleClient("legacy-public-partner-application");

        const { error: dbError } = await supabase.from("partner_applications").insert({
          name,
          email,
          company,
          website: website || null,
          partner_type: partnerType,
          message,
          status: "pending",
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
        });
        // An application we never stored is an application we never received.
        if (dbError) {
          console.error("partner_applications insert FAILED:", dbError.message);
          return NextResponse.json({ error: "We could not save your application. Please try again." }, { status: 500 });
        }

        // Create admin notification (fire and forget)
        Promise.resolve(supabase.from("admin_notifications").insert({
          type: "new_partner",
          title: `New partner application: ${name}`,
          description: `${company}: ${partnerType}`,
          link: "/admin/partners",
        })).catch(() => {});
      } catch (e) {
        console.warn("Supabase insert failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Partner application error:", error);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
