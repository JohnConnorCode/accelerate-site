import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { GOOGLE_SCOPES, getGoogleAccessToken } from "@/lib/revenue-os/google";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("integration_connections").select("provider,account_email,token_expires_at,scopes,status,settings,last_sync_at,last_success_at,last_error,connected_at").eq("provider", "google").maybeSingle();
  if (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), connected: false });
    return NextResponse.json({ error: "Could not read Google status" }, { status: 500 });
  }
  const scopes: string[] = data?.scopes ?? [];
  return NextResponse.json({
    schemaReady: true,
    configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    connected: data?.status === "connected" && Boolean(data.account_email) && scopes.length > 0,
    connection: data ? { ...data, requiredScopesGranted: GOOGLE_SCOPES.filter((scope) => !["openid", "email"].includes(scope)).every((scope) => scopes.includes(scope)) } : null,
  });
}

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { connection } = await getGoogleAccessToken(createServiceRoleClient());
    return NextResponse.json({ success: true, accountEmail: connection.account_email, scopes: connection.scopes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google connection test failed" }, { status: 400 });
  }
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { error } = await createServiceRoleClient().from("integration_connections").update({
    status: "disconnected",
    encrypted_access_token: null,
    encrypted_refresh_token: null,
    token_expires_at: null,
    scopes: [],
    last_error: null,
  }).eq("provider", "google");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
