import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { buildXeroAuthUrl } from "@/lib/revenue-os/xero";
import { commandCenterOrigin } from "@/lib/command-center/runtime";
import {
  createXeroOAuthStateBinding,
  xeroOperatorError,
  XERO_OAUTH_STATE_TTL_SECONDS,
} from "@/lib/revenue-os/xero-oauth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const integrationsUrl = (query: string) =>
    new URL(
      `/t/${auth.tenant.slug}/admin/integrations?${query}`,
      commandCenterOrigin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    );
  try {
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildXeroAuthUrl(state));
    const boundState = createXeroOAuthStateBinding({
      state,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
    });
    response.cookies.set("xero_oauth_state", boundState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: XERO_OAUTH_STATE_TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      integrationsUrl(`xero_error=${xeroOperatorError(error, "authorize").code}`),
    );
  }
}
