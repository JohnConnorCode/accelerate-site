import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { buildGoogleAuthUrl } from "@/lib/revenue-os/google";
import {
  createGoogleOAuthStateBinding,
  googleOperatorError,
  GOOGLE_OAUTH_STATE_TTL_SECONDS,
} from "@/lib/revenue-os/google-oauth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildGoogleAuthUrl(state));
    const boundState = createGoogleOAuthStateBinding({
      state,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
    });
    response.cookies.set("google_oauth_state", boundState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: GOOGLE_OAUTH_STATE_TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch (error) {
    const projected = googleOperatorError(error, "authorize");
    return NextResponse.redirect(
      new URL(
        `/t/${auth.tenant.slug}/admin/integrations?google_error=${projected.code}`,
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      ),
    );
  }
}
