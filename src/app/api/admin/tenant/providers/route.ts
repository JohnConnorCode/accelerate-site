import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { encryptSecret } from "@/lib/revenue-os/encryption";
import { recordAudit } from "@/lib/revenue-os/audit";

const providerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure_resend"), apiKey: z.string().trim().min(10).max(500), fromEmail: z.string().trim().email().max(254), replyToEmail: z.string().trim().email().max(254), webhookSecret: z.string().trim().min(10).max(500).optional() }),
  z.object({ action: z.literal("configure_calendly"), webhookSecret: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("disconnect"), provider: z.enum(["resend", "google", "calendly"]) }),
]);

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { data, error } = await authorization.database.from("integration_connections")
    .select("id,provider,account_email,scopes,status,credential_version,last_sync_at,last_success_at,last_error,connected_at,updated_at,settings")
    .order("provider");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const providers = (data || []).map(({ settings, ...provider }) => ({
    ...provider,
    reply_to_email: settings && typeof settings === "object" && typeof (settings as Record<string, unknown>).reply_to_email === "string"
      ? (settings as Record<string, unknown>).reply_to_email
      : null,
  }));
  return NextResponse.json({ providers });
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const parsed = providerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider action" }, { status: 400 });
  if (parsed.data.action === "disconnect") {
    const { error } = await authorization.database.from("integration_connections").update({
      status: "revoked",
      encrypted_credentials: {},
      last_error: "Disconnected by tenant administrator",
      updated_at: new Date().toISOString(),
    }).eq("provider", parsed.data.provider);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit(authorization.database, { actorEmail: authorization.user.email, action: "provider.disconnected", entityType: "integration_connection", entityId: parsed.data.provider, after: { provider: parsed.data.provider, status: "revoked" } });
    return NextResponse.json({ success: true });
  }
  const now = new Date().toISOString();
  const provider = parsed.data.action === "configure_calendly" ? "calendly" : "resend";
  const { data: existing } = await authorization.database.from("integration_connections").select("credential_version,status,settings").eq("provider", provider).maybeSingle();
  const credentialVersion = Number(existing?.credential_version || 0) + 1;
  if (parsed.data.action === "configure_calendly") {
    const { data, error } = await authorization.database.from("integration_connections").upsert({
      provider: "calendly",
      status: "connected",
      encrypted_credentials: { webhook_secret: encryptSecret(parsed.data.webhookSecret) },
      credential_version: credentialVersion,
      environment_fallback_allowed: false,
      connected_at: now,
      last_error: null,
      updated_at: now,
    }, { onConflict: "tenant_id,provider" }).select("id,provider,status,credential_version,connected_at,updated_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit(authorization.database, { actorEmail: authorization.user.email, action: "provider.credentials_rotated", entityType: "integration_connection", entityId: "calendly", before: { status: existing?.status || null }, after: { provider: "calendly", status: "connected", credentialVersion } });
    return NextResponse.json({ provider: data });
  }
  const encryptedCredentials: Record<string, string> = { api_key: encryptSecret(parsed.data.apiKey) };
  if (parsed.data.webhookSecret) encryptedCredentials.webhook_secret = encryptSecret(parsed.data.webhookSecret);
  const { data, error } = await authorization.database.from("integration_connections").upsert({
    provider: "resend",
    account_email: parsed.data.fromEmail.trim().toLowerCase(),
    settings: { ...(existing?.settings && typeof existing.settings === "object" ? existing.settings : {}), reply_to_email: parsed.data.replyToEmail.trim().toLowerCase() },
    status: "connected",
    encrypted_credentials: encryptedCredentials,
    credential_version: credentialVersion,
    environment_fallback_allowed: false,
    connected_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "tenant_id,provider" }).select("id,provider,status,credential_version,connected_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(authorization.database, { actorEmail: authorization.user.email, action: "provider.credentials_rotated", entityType: "integration_connection", entityId: "resend", before: { status: existing?.status || null }, after: { provider: "resend", status: "connected", credentialVersion } });
  return NextResponse.json({ provider: data });
}
