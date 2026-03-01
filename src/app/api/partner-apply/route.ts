import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, email, company, website, partnerType, message } = body;

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
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        await supabase.from("partner_applications").insert({
          name,
          email,
          company,
          website: website || null,
          partner_type: partnerType,
          message,
          status: "pending",
        });
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
