import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { exchangeXeroCode, saveXeroConnection } from "@/lib/revenue-os/xero";
import { recordAudit } from "@/lib/revenue-os/audit";
import { commandCenterOrigin } from "@/lib/command-center/runtime";
import {
  verifyXeroOAuthStateBinding,
  xeroOperatorError,
  xeroServerErrorSummary,
} from "@/lib/revenue-os/xero-oauth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error");
  const cookieStore = await cookies();
  const encodedState = cookieStore.get("xero_oauth_state")?.value;
  const origin = commandCenterOrigin || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirect = (query: string) => {
    const response = NextResponse.redirect(
      new URL(`/t/${auth.tenant.slug}/admin/integrations?${query}`, origin),
    );
    response.cookies.delete("xero_oauth_state");
    return response;
  };
  if (
    !state ||
    !verifyXeroOAuthStateBinding(encodedState, {
      state,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
    })
  )
    return redirect("xero_error=state_mismatch");
  if (providerError)
    return redirect(
      `xero_error=${providerError === "access_denied" ? "consent_denied" : "connection_failed"}`,
    );
  if (!code) return redirect("xero_error=connection_failed");
  try {
    const supabase = auth.database;
    const tokens = await exchangeXeroCode(code);
    const connection = await saveXeroConnection(supabase, tokens);
    await recordAudit(supabase, {
      actorEmail: auth.user.email,
      action: "integration.xero_connected",
      entityType: "integration",
      entityId: "xero",
      metadata: { xero_tenant_id: connection.tenantId, xero_tenant_name: connection.tenantName },
    });
    return redirect("xero_connected=1");
  } catch (error) {
    console.error("[xero/callback]", xeroServerErrorSummary(error, "callback"));
    return redirect(`xero_error=${xeroOperatorError(error, "callback").code}`);
  }
}
