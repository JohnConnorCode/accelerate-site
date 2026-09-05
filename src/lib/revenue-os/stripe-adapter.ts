import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { decryptTenantSecret } from "./encryption";
import { isModuleEnabled } from "./modules";
import type { IntegrationAdapter } from "./integration-adapters";

export const STRIPE_API_VERSION = "2025-06-30.basil";
type StripeObject = Record<string, unknown>;
export function stripeKeyMode(value: string): "test" | "live" {
  const match = value.match(/^(?:rk|sk)_(test|live)_[A-Za-z0-9]{10,200}$/);
  if (!match) throw new Error("A Stripe restricted or secret API key is required");
  return match[1] as "test" | "live";
}
/** Fixed provider origin, bounded response and deadline. No plugin supplies
 * a URL, header, key or arbitrary network binding. Errors exclude payloads. */
async function stripeRequest(
  apiKey: string,
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
): Promise<{ object: StripeObject; requestId: string | null }> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body?.toString(),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
    redirect: "error",
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Stripe returned no response body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        throw new Error("Stripe response exceeded its bound");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!response.ok)
    throw new Error(
      `Stripe request failed (HTTP ${response.status}); review the provider receipt before retrying`,
    );
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Stripe response was not an object");
  return { object: parsed as StripeObject, requestId: response.headers.get("request-id") };
}
export const stripeAdapter: IntegrationAdapter = {
  id: "stripe",
  name: "Stripe",
  category: "crm",
  credentialFields: [{ formField: "apiKey", encryptedKey: "api_key" }],
  async verify(credentials) {
    try {
      const apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey : "";
      stripeKeyMode(apiKey);
      const { object } = await stripeRequest(apiKey, "/account");
      if (typeof object.id !== "string" || !object.id.startsWith("acct_"))
        throw new Error("Stripe account was not identified");
      return { valid: true, provider: "stripe", accountDetails: { id: object.id } };
    } catch {
      console.error("[stripe] Credential verification failed");
      return {
        valid: false,
        provider: "stripe",
        error: "Stripe key verification failed. Check the account and restricted-key permissions.",
      };
    }
  },
  async connect(credentials) {
    const result = await this.verify(credentials);
    if (!result.valid) throw new Error(result.error);
    return {
      provider: "stripe",
      status: "active",
      connectedAt: new Date().toISOString(),
      accountIdentifier: result.accountDetails?.id,
    };
  },
};
export async function tenantStripeClient(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Stripe requires a tenant-bound host");
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("config,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (
    tenantError ||
    !tenant ||
    tenant.status !== "active" ||
    !isModuleEnabled("stripe-invoicing", tenant.config)
  )
    throw new Error("Stripe invoicing is disabled or the workspace is unavailable");
  const { data: connection, error } = await db
    .from("integration_connections")
    .select("status,encrypted_credentials,credential_version,account_email")
    .eq("provider", "stripe")
    .maybeSingle();
  if (error || !connection || connection.status !== "connected")
    throw new Error("Connect Stripe for this workspace first");
  const encrypted = (connection.encrypted_credentials as Record<string, unknown>)?.api_key;
  if (typeof encrypted !== "string") throw new Error("Stripe credential is unavailable");
  const apiKey = decryptTenantSecret(encrypted, tenantId, "stripe", "api_key");
  const mode = stripeKeyMode(apiKey);
  const assertCurrentConnection = async () => {
    const current = await tenantStripeClient(db);
    if (
      current.credentialVersion !== connection.credential_version ||
      current.accountId !== connection.account_email ||
      current.mode !== mode
    )
      throw new Error("Stripe connection changed during the operation; reconcile before retrying");
  };
  return {
    tenantId,
    mode,
    credentialVersion: connection.credential_version as number,
    accountId: connection.account_email as string,
    account: () => stripeRequest(apiKey, "/account"),
    customers: (email?: string) =>
      stripeRequest(
        apiKey,
        `/customers?${new URLSearchParams({ limit: "50", ...(email ? { email } : {}) })}`,
      ),
    customer: (id: string) => {
      if (!/^cus_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe customer");
      return stripeRequest(apiKey, `/customers/${id}`);
    },
    invoice: (id: string) => {
      if (!/^in_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe invoice");
      return stripeRequest(apiKey, `/invoices/${id}`);
    },
    createInvoice: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/invoices", body, key);
    },
    invoiceOperation: async (
      id: string,
      operation: "add_lines" | "finalize" | "send",
      body: URLSearchParams,
      key: string,
    ) => {
      if (
        !/^in_[A-Za-z0-9]{1,80}$/.test(id) ||
        !["add_lines", "finalize", "send"].includes(operation)
      )
        throw new Error("Invalid Stripe invoice operation");
      await assertCurrentConnection();
      return stripeRequest(apiKey, `/invoices/${id}/${operation}`, body, key);
    },
  };
}
