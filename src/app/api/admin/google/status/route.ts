import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { applyWorkspaceConfigurationAsAdmin } from "@/lib/revenue-os/workspace-configuration";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GOOGLE_SCOPES } from "@/lib/revenue-os/google";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { isGoogleTokenEncryptionKeyConfigured } from "@/lib/revenue-os/encryption";
import { googleOperatorError } from "@/lib/revenue-os/google-oauth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = auth.database;
  const { data, error } = await supabase
    .from("integration_connections")
    .select(
      "provider,account_email,token_expires_at,scopes,status,settings,last_sync_at,last_success_at,last_error,connected_at",
    )
    .eq("provider", "google")
    .maybeSingle();
  if (error) {
    if (isMissingRevenueSchema(error))
      return NextResponse.json({
        schemaReady: false,
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          isGoogleTokenEncryptionKeyConfigured(),
        ),
        connected: false,
      });
    return NextResponse.json({ error: "Could not read Google status" }, { status: 500 });
  }
  const scopes: string[] = data?.scopes ?? [];
  return NextResponse.json({
    schemaReady: true,
    configured: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      isGoogleTokenEncryptionKeyConfigured(),
    ),
    connected: data?.status === "connected" && Boolean(data.account_email) && scopes.length > 0,
    connection: data
      ? {
          ...data,
          requiredScopesGranted: GOOGLE_SCOPES.filter(
            (scope) => !["openid", "email"].includes(scope),
          ).every((scope) => scopes.includes(scope)),
        }
      : null,
  });
}

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const receipt = await runWithTenantRequestContext(auth, () =>
      applyWorkspaceConfigurationAsAdmin(
        auth.database,
        { operation: "test_google_connection" },
        auth.user.email!,
      ),
    );
    return NextResponse.json({ ...receipt, ...(receipt.result?.sources ?? {}) });
  } catch (error) {
    const projected = googleOperatorError(error, "connection-test");
    return NextResponse.json({ error: projected.message, code: projected.code }, { status: 400 });
  }
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await runWithTenantRequestContext(auth, () =>
      applyWorkspaceConfigurationAsAdmin(
        auth.database,
        { operation: "disconnect_provider", provider: "google" },
        auth.user.email!,
      ),
    );
    return NextResponse.json({ success: true, result });
  } catch {
    return NextResponse.json(
      { error: "Google could not be disconnected safely. Refresh and review again." },
      { status: 409 },
    );
  }
}
