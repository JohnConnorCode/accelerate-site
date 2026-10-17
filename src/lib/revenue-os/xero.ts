import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertActiveTenantExecution } from "@/lib/tenancy/system";
import { commandCenterOrigin } from "@/lib/command-center/runtime";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./encryption";
import { safeErrorMessage } from "./db";

/**
 * Read-first Xero foundation: OAuth connection, token refresh and a bounded
 * connection probe.
 *
 * Deliberately absent: canonical invoice/payment import. Accounting records
 * need agreed definitions (invoice -> canonical record, per-organisation
 * mapping, currency and tax treatment) before any write, so no sync is
 * claimed here. `integration-registry.ts` still lists accounting as planned.
 *
 * Xero specifics this module encodes:
 *  - tokens come from `identity.xero.com`, and data calls need the
 *    `xero-tenant-id` header for the chosen organisation;
 *  - the refresh token ROTATES on every refresh, so a failed save would break
 *    the connection permanently. The new value is always persisted.
 */

export const XERO_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "accounting.transactions.read",
  "accounting.contacts.read",
] as const;

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
export const XERO_API_ORIGIN = "https://api.xero.com";
const XERO_TIMEOUT_MS = 12_000;
const XERO_MAX_RESPONSE_BYTES = 262_144;

export class XeroApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "XeroApiError";
  }
}

export type XeroOrganisation = {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantType?: string;
};

type XeroTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

function xeroConfig() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const siteUrl =
    commandCenterOrigin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!clientId || !clientSecret) throw new Error("Xero OAuth is not configured");
  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl.replace(/\/$/, "")}/api/admin/xero/callback`,
  };
}

function basicAuth(): HeadersInit {
  const config = xeroConfig();
  return {
    Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
  };
}

/** Fixed provider origin, bounded body and deadline. Errors never echo payloads. */
async function xeroFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(XERO_TIMEOUT_MS),
    cache: "no-store",
    redirect: "error",
  });
  const payload = await readBoundedJson(response, XERO_MAX_RESPONSE_BYTES).catch((error) => {
    // A missing, oversized or non-JSON body must not mask the HTTP status the
    // caller classifies (e.g. invalid_grant). Record it and carry on.
    console.warn("[xero/fetch] response body was not bounded JSON", safeErrorMessage(error));
    return null;
  });
  if (!response.ok) {
    const record = payload as {
      error?: string;
      error_description?: string;
      Message?: string;
    } | null;
    // Keep the machine code (e.g. invalid_grant) alongside its description:
    // the caller classifies a permanent failure from that code.
    const detail = record?.error_description || record?.Message;
    const message =
      [record?.error, detail].filter(Boolean).join(": ") ||
      `Xero request failed (${response.status})`;
    throw new XeroApiError(message, response.status);
  }
  return payload as T;
}

export function buildXeroAuthUrl(state: string): string {
  const config = xeroConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: XERO_SCOPES.join(" "),
    state,
  });
  return `${XERO_AUTHORIZE_URL}?${params}`;
}

export async function exchangeXeroCode(code: string): Promise<XeroTokenResponse> {
  const config = xeroConfig();
  return xeroFetch<XeroTokenResponse>(XERO_TOKEN_URL, {
    method: "POST",
    headers: { ...basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
}

/** Xero returns every organisation the user authorised for this app. */
export async function listXeroOrganisations(accessToken: string): Promise<XeroOrganisation[]> {
  const organisations = await xeroFetch<XeroOrganisation[]>(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!Array.isArray(organisations))
    throw new XeroApiError("Xero returned an unexpected connections payload", 502);
  return organisations;
}

export async function saveXeroConnection(supabase: SupabaseClient, tokens: XeroTokenResponse) {
  await assertActiveTenantExecution(supabase, "xero-connect");
  const organisations = await listXeroOrganisations(tokens.access_token);
  const primary = organisations.find((entry) => Boolean(entry?.tenantId));
  if (!primary) throw new Error("Xero returned no authorised organisation for this connection.");
  const { data: existing } = await supabase
    .from("integration_connections")
    .select("encrypted_refresh_token,connected_at,settings")
    .eq("provider", "xero")
    .maybeSingle();
  if (!tokens.refresh_token && !existing?.encrypted_refresh_token)
    throw new Error("Xero did not return a refresh token. Reconnect and grant offline access.");
  const previousSettings = (existing?.settings ?? {}) as Record<string, unknown>;
  const settings: Record<string, unknown> = {
    ...previousSettings,
    xero_tenant_id: primary.tenantId,
    xero_tenant_name: primary.tenantName ?? null,
    xero_tenant_type: primary.tenantType ?? null,
    xero_authorised_organisations: organisations
      .filter((entry) => Boolean(entry?.tenantId))
      .map((entry) => ({ tenantId: entry.tenantId, tenantName: entry.tenantName ?? null })),
  };
  const { error } = await supabase.from("integration_connections").upsert(
    {
      provider: "xero",
      account_email: (primary.tenantName ?? primary.tenantType ?? primary.tenantId).slice(0, 254),
      encrypted_access_token: encryptSecret(tokens.access_token),
      encrypted_refresh_token: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : existing?.encrypted_refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [...XERO_SCOPES],
      status: "connected",
      connected_at: existing?.connected_at || new Date().toISOString(),
      settings,
      last_error: null,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw new Error(error.message);
  return {
    tenantId: primary.tenantId,
    tenantName: primary.tenantName ?? null,
    organisations: settings.xero_authorised_organisations,
  };
}

export async function getXeroAccessToken(
  supabase: SupabaseClient,
): Promise<{ token: string; tenantId: string; connection: Record<string, unknown> }> {
  await assertActiveTenantExecution(supabase, "xero");
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("provider", "xero")
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection?.encrypted_refresh_token) throw new Error("Xero is not connected");
  if (!isEncryptedSecret(connection.encrypted_refresh_token))
    throw new Error("Xero refresh token is not in the encrypted envelope; reconnect Xero.");
  const tenantId = (connection.settings as { xero_tenant_id?: string } | null)?.xero_tenant_id;
  if (!tenantId) throw new Error("Xero organisation is not recorded; reconnect Xero.");
  if (
    connection.encrypted_access_token &&
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() > Date.now() + 60000
  ) {
    if (!isEncryptedSecret(connection.encrypted_access_token))
      throw new Error("Xero access token is not in the encrypted envelope; reconnect Xero.");
    return { token: decryptSecret(connection.encrypted_access_token), tenantId, connection };
  }

  try {
    const refreshed = await xeroFetch<XeroTokenResponse>(XERO_TOKEN_URL, {
      method: "POST",
      headers: { ...basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: decryptSecret(connection.encrypted_refresh_token),
        grant_type: "refresh_token",
      }),
    });
    const patch = {
      encrypted_access_token: encryptSecret(refreshed.access_token),
      // Xero rotates refresh tokens. Persisting the new value is not optional:
      // the previous one is invalidated as soon as this response is issued.
      encrypted_refresh_token: refreshed.refresh_token
        ? encryptSecret(refreshed.refresh_token)
        : connection.encrypted_refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : connection.scopes,
      last_error: null,
    };
    await supabase.from("integration_connections").update(patch).eq("id", connection.id);
    return { token: refreshed.access_token, tenantId, connection: { ...connection, ...patch } };
  } catch (error) {
    const message = safeErrorMessage(error);
    await supabase
      .from("integration_connections")
      .update({
        status: /invalid_grant/i.test(message) ? "revoked" : "degraded",
        last_error: message,
      })
      .eq("id", connection.id);
    throw error;
  }
}

/** A connection check probes Xero even when the cached access token is valid. */
export async function verifyXeroConnection(supabase: SupabaseClient) {
  const { token, tenantId, connection } = await getXeroAccessToken(supabase);
  const organisations = await listXeroOrganisations(token);
  if (!organisations.some((entry) => entry.tenantId === tenantId))
    throw new Error(
      "Xero no longer authorises the recorded organisation. Reconnect in Integrations.",
    );
  return {
    tenantId,
    scopes: connection.scopes,
    organisationCount: organisations.length,
  };
}
