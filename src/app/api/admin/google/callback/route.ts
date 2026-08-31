import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { exchangeGoogleCode, saveGoogleConnection } from "@/lib/revenue-os/google";
import { recordAudit } from "@/lib/revenue-os/audit";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const cookieStore = await cookies();
  const encodedState = cookieStore.get("google_oauth_state")?.value;
  let expected: { state: string; tenantId: string; tenantSlug: string } | null = null;
  try {
    expected = encodedState ? JSON.parse(Buffer.from(encodedState, "base64url").toString("utf8")) : null;
  } catch {
    expected = null;
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirect = (query: string) => {
    const response = NextResponse.redirect(new URL(`/t/${auth.tenant.slug}/admin/integrations?${query}`, origin));
    response.cookies.delete("google_oauth_state");
    return response;
  };
  if (!code || !state || !expected || state !== expected.state || expected.tenantId !== auth.tenant.id || expected.tenantSlug !== auth.tenant.slug) return redirect("google_error=state_mismatch");
  try {
    const supabase = auth.database;
    const tokens = await exchangeGoogleCode(code);
    const profile = await saveGoogleConnection(supabase, tokens);
    await recordAudit(supabase, { actorEmail: auth.user.email, action: "integration.google_connected", entityType: "integration", entityId: "google", metadata: { account_email: profile.email } });
    return redirect("google_connected=1");
  } catch (error) {
    console.error("[google/callback]", error);
    return redirect(`google_error=${encodeURIComponent(error instanceof Error ? error.message : "connection_failed")}`);
  }
}
