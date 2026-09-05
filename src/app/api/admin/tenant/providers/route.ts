import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { randomBytes } from "node:crypto";
import { encryptSecret, encryptTenantSecret } from "@/lib/revenue-os/encryption";
import { recordAudit } from "@/lib/revenue-os/audit";
import {
  OpenRouterCredentialError,
  resolveOpenRouterCredential,
  validateOpenRouterApiKey,
} from "@/lib/ai/openrouter-credentials";
import {
  INTEGRATION_ADAPTERS,
  buildEncryptedCredentials,
  resolveAccountIdentifier,
} from "@/lib/revenue-os/integration-adapters";
import type { AdminAuthorization } from "@/lib/admin/auth";

const providerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure_stripe"), apiKey: z.string().trim().min(20).max(256) }),
  z.object({
    action: z.literal("configure_resend"),
    apiKey: z.string().trim().min(10).max(500),
    fromEmail: z.string().trim().email().max(254),
    replyToEmail: z.string().trim().email().max(254),
    webhookSecret: z.string().trim().min(10).max(500).optional(),
  }),
  z.object({
    action: z.literal("configure_calendly"),
    webhookSecret: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("configure_openrouter"),
    apiKey: z.string().trim().min(24).max(500),
  }),
  z.object({
    action: z.literal("configure_mcp"),
  }),
  z.object({
    action: z.literal("configure_whatsapp"),
    accessToken: z.string().trim().min(10).max(2000),
    phoneNumberId: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal("configure_hubspot"),
    accessToken: z.string().trim().min(10).max(2000),
    webhookSecret: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("disconnect"),
    provider: z.enum([
      "resend",
      "google",
      "calendly",
      "openrouter",
      "mcp",
      "whatsapp",
      "hubspot",
      "stripe",
    ]),
  }),
]);

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { data, error } = await authorization.database
    .from("integration_connections")
    .select(
      "id,provider,account_email,scopes,status,credential_version,last_sync_at,last_success_at,last_error,connected_at,updated_at,settings,environment_fallback_allowed",
    )
    .order("provider");
  if (error)
    return NextResponse.json(
      { error: "Provider connections could not be loaded." },
      { status: 500 },
    );
  let openRouterSource: "tenant" | "platform" | null = null;
  try {
    openRouterSource = (await resolveOpenRouterCredential(authorization.database))?.source ?? null;
  } catch {
    /* The connection remains visible as degraded without leaking the storage failure. */
  }
  const providers = (data || []).map(({ settings, ...provider }) => ({
    ...provider,
    status:
      provider.provider === "openrouter" && provider.status === "connected" && !openRouterSource
        ? "degraded"
        : provider.status,
    last_error:
      provider.provider === "openrouter" && provider.status === "connected" && !openRouterSource
        ? "The encrypted workspace key is unavailable. Verify and rotate it."
        : provider.last_error,
    reply_to_email:
      settings &&
      typeof settings === "object" &&
      typeof (settings as Record<string, unknown>).reply_to_email === "string"
        ? (settings as Record<string, unknown>).reply_to_email
        : null,
    credential_source:
      provider.provider === "openrouter"
        ? openRouterSource
        : provider.status === "connected"
          ? "tenant"
          : null,
    key_metadata:
      provider.provider === "openrouter" && settings && typeof settings === "object"
        ? {
            label:
              typeof (settings as Record<string, unknown>).key_label === "string"
                ? (settings as Record<string, unknown>).key_label
                : null,
            limit:
              typeof (settings as Record<string, unknown>).limit === "number"
                ? (settings as Record<string, unknown>).limit
                : null,
            limit_remaining:
              typeof (settings as Record<string, unknown>).limit_remaining === "number"
                ? (settings as Record<string, unknown>).limit_remaining
                : null,
            limit_reset:
              typeof (settings as Record<string, unknown>).limit_reset === "string"
                ? (settings as Record<string, unknown>).limit_reset
                : null,
            usage:
              typeof (settings as Record<string, unknown>).usage === "number"
                ? (settings as Record<string, unknown>).usage
                : null,
            is_free_tier:
              typeof (settings as Record<string, unknown>).is_free_tier === "boolean"
                ? (settings as Record<string, unknown>).is_free_tier
                : null,
            expires_at:
              typeof (settings as Record<string, unknown>).expires_at === "string"
                ? (settings as Record<string, unknown>).expires_at
                : null,
            verified_at:
              typeof (settings as Record<string, unknown>).verified_at === "string"
                ? (settings as Record<string, unknown>).verified_at
                : null,
          }
        : null,
  }));
  if (!providers.some((provider) => provider.provider === "openrouter")) {
    providers.push({
      id: "openrouter",
      provider: "openrouter",
      account_email: null,
      scopes: [],
      status: openRouterSource ? "connected" : "disconnected",
      credential_version: 0,
      last_sync_at: null,
      last_success_at: null,
      last_error: null,
      connected_at: null,
      updated_at: null,
      environment_fallback_allowed: openRouterSource === "platform",
      reply_to_email: null,
      credential_source: openRouterSource,
      key_metadata: null,
    });
  }
  return NextResponse.json({ providers });
}

/**
 * The single verify, encrypt, upsert, and audit cycle every adapter-backed
 * provider (INTEGRATION_ADAPTERS) shares, replacing what used to be one
 * hand-written ~45-line block per provider. `credentials` carries the
 * request's fields verbatim; adapter.credentialFields says which of them get
 * encrypted and under what key, so registering a third adapter needs no
 * change here.
 */
async function configureAdapterProvider(
  provider: string,
  credentials: Record<string, unknown>,
  authorization: AdminAuthorization,
  credentialVersion: number,
  existingStatus: string | null | undefined,
  now: string,
): Promise<NextResponse> {
  const adapter = INTEGRATION_ADAPTERS.get(provider);
  if (!adapter) {
    return NextResponse.json(
      { error: `No adapter registered for "${provider}".` },
      { status: 500 },
    );
  }
  const verification = await adapter.verify(credentials);
  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || `${adapter.name} credentials could not be verified.` },
      { status: 400 },
    );
  }
  const encryptedCredentials = buildEncryptedCredentials(
    adapter,
    credentials,
    provider === "stripe"
      ? (value, field) => encryptTenantSecret(value, authorization.tenant.id, provider, field)
      : encryptSecret,
  );
  const { data, error } = await authorization.database
    .from("integration_connections")
    .upsert(
      {
        provider,
        account_email: resolveAccountIdentifier(verification),
        status: "connected",
        encrypted_credentials: encryptedCredentials,
        credential_version: credentialVersion,
        environment_fallback_allowed: false,
        connected_at: now,
        last_success_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "tenant_id,provider" },
    )
    .select("id,provider,status,credential_version,connected_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(authorization.database, {
    actorEmail: authorization.user.email,
    action: "provider.credentials_rotated",
    entityType: "integration_connection",
    entityId: provider,
    before: { status: existingStatus || null },
    after: { provider, status: "connected", credentialVersion, verified: true },
  });
  return NextResponse.json({ provider: data });
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const parsed = providerSchema.safeParse(await readBoundedJson(request).catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid provider action" }, { status: 400 });
  if (parsed.data.action === "disconnect") {
    const { data: existing } = await authorization.database
      .from("integration_connections")
      .select("credential_version,status")
      .eq("provider", parsed.data.provider)
      .maybeSingle();
    const { error } = await authorization.database.from("integration_connections").upsert(
      {
        provider: parsed.data.provider,
        status: "revoked",
        encrypted_credentials: {},
        credential_version: Number(existing?.credential_version || 1),
        environment_fallback_allowed: false,
        last_error: "Disconnected by tenant administrator",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" },
    );
    if (error)
      return NextResponse.json(
        { error: "The provider could not be disconnected. Try again." },
        { status: 500 },
      );
    await recordAudit(authorization.database, {
      actorEmail: authorization.user.email,
      action: "provider.disconnected",
      entityType: "integration_connection",
      entityId: parsed.data.provider,
      before: { status: existing?.status || null },
      after: { provider: parsed.data.provider, status: "revoked" },
    });
    return NextResponse.json({ success: true });
  }
  const now = new Date().toISOString();
  const provider =
    parsed.data.action === "configure_stripe"
      ? "stripe"
      : parsed.data.action === "configure_calendly"
        ? "calendly"
        : parsed.data.action === "configure_openrouter"
          ? "openrouter"
          : parsed.data.action === "configure_mcp"
            ? "mcp"
            : parsed.data.action === "configure_whatsapp"
              ? "whatsapp"
              : parsed.data.action === "configure_hubspot"
                ? "hubspot"
                : "resend";
  const { data: existing } = await authorization.database
    .from("integration_connections")
    .select("credential_version,status,settings")
    .eq("provider", provider)
    .maybeSingle();
  const credentialVersion = Number(existing?.credential_version || 0) + 1;
  if (parsed.data.action === "configure_mcp") {
    // The MCP key is server-issued, not operator-supplied: nothing external to
    // verify, so generate and store it the same way as tenant ingest keys,
    // except through the reversible encrypted envelope every other provider
    // uses, since resolveTenantProviderSecrets("mcp") must decrypt it back to
    // compare against a Bearer token on each request.
    const rawKey = `revos_mcp_${randomBytes(24).toString("base64url")}`;
    const { data, error } = await authorization.database
      .from("integration_connections")
      .upsert(
        {
          provider: "mcp",
          status: "connected",
          // Plain encryptSecret, not encryptTenantSecret: resolveTenantProviderSecrets
          // (the read path every other provider here also goes through) calls the
          // plain decryptSecret, not the AAD-scoped decryptTenantSecret OpenRouter uses.
          encrypted_credentials: { api_key: encryptSecret(rawKey) },
          credential_version: credentialVersion,
          environment_fallback_allowed: false,
          connected_at: now,
          last_error: null,
          updated_at: now,
        },
        { onConflict: "tenant_id,provider" },
      )
      .select("id,provider,status,credential_version,connected_at,updated_at")
      .single();
    if (error)
      return NextResponse.json(
        { error: "The MCP key could not be generated. Try again." },
        { status: 500 },
      );
    await recordAudit(authorization.database, {
      actorEmail: authorization.user.email,
      action: "provider.credentials_rotated",
      entityType: "integration_connection",
      entityId: "mcp",
      before: { status: existing?.status || null },
      after: { provider: "mcp", status: "connected", credentialVersion },
    });
    // Returned once, at generation time, exactly like a tenant ingest key.
    // It is never recoverable from the API again after this response.
    return NextResponse.json({ provider: data, apiKey: rawKey });
  }
  if (
    parsed.data.action === "configure_whatsapp" ||
    parsed.data.action === "configure_hubspot" ||
    parsed.data.action === "configure_stripe"
  ) {
    const provider = parsed.data.action.slice("configure_".length);
    const credentials: Record<string, unknown> = { ...parsed.data };
    delete credentials.action;
    return configureAdapterProvider(
      provider,
      credentials,
      authorization,
      credentialVersion,
      existing?.status,
      now,
    );
  }
  if (parsed.data.action === "configure_openrouter") {
    try {
      const metadata = await validateOpenRouterApiKey(parsed.data.apiKey, request.signal);
      const { data, error } = await authorization.database
        .from("integration_connections")
        .upsert(
          {
            provider: "openrouter",
            status: "connected",
            encrypted_credentials: {
              api_key: encryptTenantSecret(
                parsed.data.apiKey.trim(),
                authorization.tenant.id,
                "openrouter",
                "api_key",
              ),
            },
            credential_version: credentialVersion,
            environment_fallback_allowed: false,
            settings: {
              key_label: metadata.label,
              limit: metadata.limit,
              limit_remaining: metadata.limitRemaining,
              limit_reset: metadata.limitReset,
              usage: metadata.usage,
              is_free_tier: metadata.isFreeTier,
              expires_at: metadata.expiresAt,
              verified_at: now,
            },
            connected_at: now,
            last_success_at: now,
            last_error: null,
            updated_at: now,
          },
          { onConflict: "tenant_id,provider" },
        )
        .select("id,provider,status,credential_version,connected_at,updated_at")
        .single();
      if (error)
        return NextResponse.json(
          { error: "The verified key could not be saved. Try again." },
          { status: 500 },
        );
      await recordAudit(authorization.database, {
        actorEmail: authorization.user.email,
        action: "provider.credentials_rotated",
        entityType: "integration_connection",
        entityId: "openrouter",
        before: { status: existing?.status || null },
        after: { provider: "openrouter", status: "connected", credentialVersion, verified: true },
      });
      return NextResponse.json({ provider: data });
    } catch (error) {
      if (error instanceof OpenRouterCredentialError)
        return NextResponse.json({ error: error.message }, { status: error.status });
      return NextResponse.json(
        { error: "OpenRouter could not be configured. Try again." },
        { status: 500 },
      );
    }
  }
  if (parsed.data.action === "configure_calendly") {
    const { data, error } = await authorization.database
      .from("integration_connections")
      .upsert(
        {
          provider: "calendly",
          status: "connected",
          encrypted_credentials: { webhook_secret: encryptSecret(parsed.data.webhookSecret) },
          credential_version: credentialVersion,
          environment_fallback_allowed: false,
          connected_at: now,
          last_error: null,
          updated_at: now,
        },
        { onConflict: "tenant_id,provider" },
      )
      .select("id,provider,status,credential_version,connected_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit(authorization.database, {
      actorEmail: authorization.user.email,
      action: "provider.credentials_rotated",
      entityType: "integration_connection",
      entityId: "calendly",
      before: { status: existing?.status || null },
      after: { provider: "calendly", status: "connected", credentialVersion },
    });
    return NextResponse.json({ provider: data });
  }
  const encryptedCredentials: Record<string, string> = {
    api_key: encryptSecret(parsed.data.apiKey),
  };
  if (parsed.data.webhookSecret)
    encryptedCredentials.webhook_secret = encryptSecret(parsed.data.webhookSecret);
  const { data, error } = await authorization.database
    .from("integration_connections")
    .upsert(
      {
        provider: "resend",
        account_email: parsed.data.fromEmail.trim().toLowerCase(),
        settings: {
          ...(existing?.settings && typeof existing.settings === "object" ? existing.settings : {}),
          reply_to_email: parsed.data.replyToEmail.trim().toLowerCase(),
        },
        status: "connected",
        encrypted_credentials: encryptedCredentials,
        credential_version: credentialVersion,
        environment_fallback_allowed: false,
        connected_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "tenant_id,provider" },
    )
    .select("id,provider,status,credential_version,connected_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(authorization.database, {
    actorEmail: authorization.user.email,
    action: "provider.credentials_rotated",
    entityType: "integration_connection",
    entityId: "resend",
    before: { status: existing?.status || null },
    after: { provider: "resend", status: "connected", credentialVersion },
  });
  return NextResponse.json({ provider: data });
}
