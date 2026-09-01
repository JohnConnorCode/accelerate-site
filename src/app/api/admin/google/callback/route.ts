import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { exchangeGoogleCode, saveGoogleConnection } from "@/lib/revenue-os/google";
import { recordAudit } from "@/lib/revenue-os/audit";
import {
  googleOperatorError,
  googleServerErrorSummary,
  verifyGoogleOAuthStateBinding,
} from "@/lib/revenue-os/google-oauth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error");
  const cookieStore = await cookies();
  const encodedState = cookieStore.get("google_oauth_state")?.value;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirect = (query: string) => {
    const response = NextResponse.redirect(
      new URL(`/t/${auth.tenant.slug}/admin/integrations?${query}`, origin),
    );
    response.cookies.delete("google_oauth_state");
    return response;
  };
  if (
    !state ||
    !verifyGoogleOAuthStateBinding(encodedState, {
      state,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
    })
  )
    return redirect("google_error=state_mismatch");
  if (providerError)
    return redirect(
      `google_error=${providerError === "access_denied" ? "consent_denied" : "connection_failed"}`,
    );
  if (!code) return redirect("google_error=connection_failed");
  try {
    const supabase = auth.database;
    const tokens = await exchangeGoogleCode(code);
    const profile = await saveGoogleConnection(supabase, tokens);
    await recordAudit(supabase, {
      actorEmail: auth.user.email,
      action: "integration.google_connected",
      entityType: "integration",
      entityId: "google",
      metadata: { account_email: profile.email },
    });
    return redirect("google_connected=1");
  } catch (error) {
    console.error("[google/callback]", googleServerErrorSummary(error, "callback"));
    return redirect(`google_error=${googleOperatorError(error, "callback").code}`);
  }
}
