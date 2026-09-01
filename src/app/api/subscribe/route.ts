import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`subscribe:${ip}`, 3, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { email, utm } = await request.json();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createBootstrapServiceRoleClient("legacy-public-subscribe");

      const { error: dbError } = await supabase.from("subscribers").upsert(
        {
          email: email.trim(),
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
        },
        { onConflict: "email" },
      );
      // Telling someone they are subscribed when the row was never written
      // loses them silently: they never hear from us and never try again.
      if (dbError) {
        console.error("subscribers upsert FAILED:", dbError.message);
        return NextResponse.json(
          { error: "We could not save your subscription. Please try again." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to subscribe. Please try again." }, { status: 500 });
  }
}
