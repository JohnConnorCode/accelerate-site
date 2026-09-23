import { isSupabasePublicConfigured } from "@/lib/supabase/configuration.mjs";
import { tenant } from "@/config/tenant";
import { NextRequest, NextResponse } from "next/server";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { isConfiguredAdmin } from "@/lib/admin/access";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { adminPasswordResetEmail } from "@/lib/email/templates";
import { commandCenterOrigin } from "@/lib/command-center/runtime";

const RESET_LIMIT = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000;

function requestKey(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `admin-password-reset:${ip}`;
}

/**
 * Recovery links are generated and delivered by our app, rather than the
 * hosted Supabase email template. This preserves the initiating origin
 * (including localhost) and avoids a fragile remote redirect allow-list.
 */
export async function POST(request: NextRequest) {
  if (
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  )
    return NextResponse.json(
      { error: "Connect your Supabase project before resetting a password." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const rateLimitResult = await rateLimit(requestKey(request), RESET_LIMIT, RESET_WINDOW_MS);
  if (!rateLimitResult.success)
    return rateLimitResponse(rateLimitResult, {
      error: "Too many reset requests. Please wait a few minutes.",
    });

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Enter your admin email address." }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim() || email.length > 254) {
    return NextResponse.json({ error: "Enter your admin email address." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createPlatformServiceRoleClient("admin-password-reset");
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("invited_email", normalizedEmail)
    .in("status", ["invited", "active"])
    .limit(1)
    .maybeSingle();
  // Do not disclose whether a submitted email has access.
  if (!isConfiguredAdmin(normalizedEmail) && !membership) {
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
    });
    const tokenHash = data.properties?.hashed_token;
    if (error || !tokenHash) throw error || new Error("Recovery token generation failed.");

    const resetUrl = new URL("/auth/callback", commandCenterOrigin || request.url);
    resetUrl.searchParams.set("token_hash", tokenHash);
    resetUrl.searchParams.set("type", "recovery");
    resetUrl.searchParams.set("next", "/admin/update-password");

    const { error: sendError } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: `Reset your ${tenant.brand.name} admin password`,
      html: adminPasswordResetEmail(resetUrl.toString()),
    });
    if (sendError) throw sendError;
  } catch (error) {
    console.error("[admin-password-reset] Failed to issue recovery email", error);
    return NextResponse.json(
      { error: "We could not send a reset email. Please try again shortly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
