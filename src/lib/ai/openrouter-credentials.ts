import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptTenantSecret } from "@/lib/revenue-os/encryption";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/context";
import { assertActiveTenantExecution } from "@/lib/tenancy/system";

const PROVIDER = "openrouter";

export type OpenRouterCredentialSource = "tenant" | "platform";

export interface OpenRouterCredential {
  apiKey: string;
  source: OpenRouterCredentialSource;
  tenantId: string;
}

export interface OpenRouterKeyMetadata {
  label: string | null;
  limit: number | null;
  limitRemaining: number | null;
  limitReset: string | null;
  usage: number | null;
  isFreeTier: boolean | null;
  expiresAt: string | null;
}

export class OpenRouterCredentialError extends Error {
  constructor(message: string, public readonly status = 503) {
    super(message);
    this.name = "OpenRouterCredentialError";
  }
}

interface OpenRouterConnectionRecord {
  status: string;
  encrypted_credentials: unknown;
  environment_fallback_allowed: boolean;
}

export function resolveOpenRouterCredentialPolicy(input: {
  tenantId: string;
  connection: OpenRouterConnectionRecord | null;
  platformKey?: string | null;
}): OpenRouterCredential | null {
  const { tenantId, connection } = input;
  if (connection?.status === "connected") {
    const encrypted = connection.encrypted_credentials && typeof connection.encrypted_credentials === "object"
      ? (connection.encrypted_credentials as Record<string, unknown>).api_key
      : null;
    if (typeof encrypted !== "string" || !encrypted) throw new OpenRouterCredentialError("The tenant OpenRouter connection has no usable encrypted key.");
    try {
      return { apiKey: decryptTenantSecret(encrypted, tenantId, PROVIDER, "api_key"), source: "tenant", tenantId };
    } catch {
      throw new OpenRouterCredentialError("The tenant OpenRouter credential could not be decrypted.");
    }
  }
  const allowPlatform = tenantId === ACCELERATE_TENANT_ID && (!connection || connection.environment_fallback_allowed === true);
  const platformKey = allowPlatform ? input.platformKey?.trim() : "";
  return platformKey ? { apiKey: platformKey, source: "platform", tenantId } : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedText(value: unknown, max = 160): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function validateOpenRouterApiKey(apiKey: string, signal?: AbortSignal): Promise<OpenRouterKeyMetadata> {
  const key = apiKey.trim();
  if (!/^sk-or-v1-[A-Za-z0-9_-]{20,}$/.test(key)) {
    throw new OpenRouterCredentialError("Enter a valid OpenRouter API key.", 400);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const mergedSignal = signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: mergedSignal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
    if (!response.ok || !payload?.data) {
      if (response.status === 401 || response.status === 403) throw new OpenRouterCredentialError("OpenRouter rejected this API key.", 400);
      if (response.status === 429) throw new OpenRouterCredentialError("OpenRouter is rate limiting key verification. Try again shortly.", 429);
      throw new OpenRouterCredentialError("OpenRouter could not verify the key right now. Try again.", 502);
    }
    return {
      label: boundedText(payload.data.label),
      limit: finiteNumber(payload.data.limit),
      limitRemaining: finiteNumber(payload.data.limit_remaining),
      limitReset: boundedText(payload.data.limit_reset, 40),
      usage: finiteNumber(payload.data.usage),
      isFreeTier: typeof payload.data.is_free_tier === "boolean" ? payload.data.is_free_tier : null,
      expiresAt: boundedText(payload.data.expires_at, 64),
    };
  } catch (error) {
    if (error instanceof OpenRouterCredentialError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new OpenRouterCredentialError("OpenRouter key verification timed out. Try again.", 504);
    throw new OpenRouterCredentialError("OpenRouter could not verify the key right now. Try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveOpenRouterCredential(database: SupabaseClient): Promise<OpenRouterCredential | null> {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new OpenRouterCredentialError("OpenRouter execution requires an explicit tenant database context.");
  await assertActiveTenantExecution(database, PROVIDER);
  const { data: connection, error } = await database.from("integration_connections")
    .select("status,encrypted_credentials,environment_fallback_allowed")
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new OpenRouterCredentialError("OpenRouter connection state could not be read.");
  return resolveOpenRouterCredentialPolicy({
    tenantId,
    connection: connection as OpenRouterConnectionRecord | null,
    platformKey: process.env.OPENROUTER_API_KEY,
  });
}

export async function isTenantOpenRouterConfigured(database: SupabaseClient): Promise<boolean> {
  return Boolean(await resolveOpenRouterCredential(database));
}
