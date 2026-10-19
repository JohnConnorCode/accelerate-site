import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { decryptTenantSecret } from "./encryption";
import { stripeChargeIdSchema } from "./stripe-contract";
import { isModuleEnabled } from "./modules";
import type { IntegrationAdapter } from "./integration-adapters";
import type { ExtsvcAdapterContract } from "./extsvc-adapter-contract";

export const STRIPE_API_VERSION = "2025-06-30.basil";
const stripeOrigin = {
  baseUrl: "https://api.stripe.com/v1",
  apiVersion: STRIPE_API_VERSION,
  maxResponseBytes: 262144,
  timeoutMs: 12000,
  supportsIdempotencyKeys: true,
};
const stripeTransport = {
  maxResponseBytes: stripeOrigin.maxResponseBytes,
  timeoutMs: stripeOrigin.timeoutMs,
  followRedirects: false,
  cache: "no-store" as const,
};
const stripeCredentials: ExtsvcAdapterContract["credentialFields"] = [
  { formField: "apiKey", encryptedKey: "api_key", required: true },
  { formField: "webhookSecret", encryptedKey: "webhook_secret", required: false },
];
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
  const response = await fetch(`${stripeOrigin.baseUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body?.toString(),
    signal: AbortSignal.timeout(stripeTransport.timeoutMs),
    cache: stripeTransport.cache,
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
      if (size > stripeTransport.maxResponseBytes) {
        await reader.cancel();
        throw new Error("Stripe response exceeded its bound");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!response.ok) {
    const requestId = response.headers.get("request-id");
    const receipt =
      requestId && /^req_[A-Za-z0-9]{1,120}$/.test(requestId)
        ? ` Stripe request: ${requestId}.`
        : "";
    const resource = path.split("/")[1]?.split("?")[0];
    console.error("[stripe] Provider request failed", {
      status: response.status,
      resource,
      requestId: requestId && /^req_[A-Za-z0-9]{1,120}$/.test(requestId) ? requestId : null,
    });
    const recovery =
      response.status === 403
        ? ` Check this workspace’s Stripe key permissions for ${resource ?? "the requested resource"} in Stripe, then reconnect it in Integrations.`
        : " Review the provider request before retrying.";
    throw new Error(`Stripe request failed (HTTP ${response.status}).${recovery}${receipt}`);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Stripe response was not an object");
  return { object: parsed as StripeObject, requestId: response.headers.get("request-id") };
}
export const stripeAdapter: IntegrationAdapter & ExtsvcAdapterContract = {
  id: "stripe",
  name: "Stripe",
  category: "crm",
  origin: stripeOrigin,
  transport: stripeTransport,
  versionPin: {
    project: "stripe-api",
    version: STRIPE_API_VERSION,
    reviewedAt: "2026-09-19T00:00:00.000Z",
  },
  credentialFields: stripeCredentials,
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
  async reconcile() {
    return {
      status: "skipped",
      provider: "stripe",
      processed: 0,
      errors: ["Stripe synchronization is not supported; invoicing uses approved actions."],
    };
  },
  async health(credentials) {
    const started = Date.now();
    const result = await this.verify(credentials);
    return {
      healthy: result.valid,
      provider: "stripe",
      latencyMs: Date.now() - started,
      error: result.valid ? undefined : result.error,
    };
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
  const encryptedWebhook = (connection.encrypted_credentials as Record<string, unknown>)
    ?.webhook_secret;
  const webhookSecret =
    typeof encryptedWebhook === "string"
      ? decryptTenantSecret(encryptedWebhook, tenantId, "stripe", "webhook_secret")
      : null;
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
    products: () => stripeRequest(apiKey, "/products?active=true&limit=100"),
    prices: (productId?: string) =>
      stripeRequest(
        apiKey,
        `/prices?${new URLSearchParams({ active: "true", limit: "100", ...(productId ? { product: productId } : {}) })}`,
      ),
    createProduct: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/products", body, key);
    },
    updateProduct: async (id: string, body: URLSearchParams, key: string) => {
      if (!/^prod_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe product");
      await assertCurrentConnection();
      return stripeRequest(apiKey, `/products/${id}`, body, key);
    },
    createPrice: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/prices", body, key);
    },
    updatePrice: async (id: string, body: URLSearchParams, key: string) => {
      if (!/^price_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe price");
      await assertCurrentConnection();
      return stripeRequest(apiKey, `/prices/${id}`, body, key);
    },
    createCustomer: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/customers", body, key);
    },
    checkoutSession: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/checkout/sessions", body, key);
    },
    retrieveCheckoutSession: (id: string) => {
      if (!/^cs_[A-Za-z0-9_]{1,200}$/.test(id)) throw new Error("Invalid Stripe checkout session");
      return stripeRequest(apiKey, `/checkout/sessions/${id}?expand[]=line_items`);
    },
    checkoutSessionsSince: (created: number) => {
      if (!Number.isSafeInteger(created) || created < 0)
        throw new Error("Invalid checkout receipt window");
      return stripeRequest(
        apiKey,
        `/checkout/sessions?${new URLSearchParams({ limit: "100", "created[gte]": String(created) })}`,
      );
    },
    paymentIntent: (id: string) => {
      if (!/^pi_[A-Za-z0-9]{1,120}$/.test(id)) throw new Error("Invalid Stripe payment intent");
      return stripeRequest(apiKey, `/payment_intents/${id}`);
    },
    charge: (id: string) => {
      if (!stripeChargeIdSchema.safeParse(id).success) throw new Error("Invalid Stripe charge");
      return stripeRequest(apiKey, `/charges/${id}`);
    },
    charges: async (startingAfter?: string) => {
      if (startingAfter && !stripeChargeIdSchema.safeParse(startingAfter).success)
        throw new Error("Invalid payment cursor");
      await assertCurrentConnection();
      return stripeRequest(
        apiKey,
        `/charges?${new URLSearchParams({ limit: "50", ...(startingAfter ? { starting_after: startingAfter } : {}) })}`,
      );
    },
    refunds: (chargeId: string) => {
      if (!stripeChargeIdSchema.safeParse(chargeId).success)
        throw new Error("Invalid payment reference");
      return stripeRequest(
        apiKey,
        `/refunds?${new URLSearchParams({ charge: chargeId, limit: "100" })}`,
      );
    },
    paymentInvoices: (paymentIntent: string) => {
      if (!/^pi_[A-Za-z0-9]{1,120}$/.test(paymentIntent)) throw new Error("Invalid payment intent");
      return stripeRequest(
        apiKey,
        `/invoice_payments?${new URLSearchParams({
          "payment[type]": "payment_intent",
          "payment[payment_intent]": paymentIntent,
          status: "paid",
          limit: "50",
          "expand[]": "data.invoice",
        })}`,
      );
    },
    createRefund: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/refunds", body, key);
    },
    subscription: (id: string) => {
      if (!/^sub_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe subscription");
      return stripeRequest(apiKey, `/subscriptions/${id}`);
    },
    updateSubscription: async (id: string, body: URLSearchParams, key: string) => {
      if (!/^sub_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe subscription");
      await assertCurrentConnection();
      return stripeRequest(apiKey, `/subscriptions/${id}`, body, key);
    },
    subscriptionInvoices: (id: string) => {
      if (!/^sub_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe subscription");
      return stripeRequest(apiKey, `/invoices?subscription=${encodeURIComponent(id)}&limit=20`);
    },
    customerInvoices: (id: string) => {
      if (!/^cus_[A-Za-z0-9]{1,80}$/.test(id)) throw new Error("Invalid Stripe customer");
      return stripeRequest(apiKey, `/invoices?customer=${encodeURIComponent(id)}&limit=20`);
    },
    invoices: async (startingAfter?: string) => {
      if (startingAfter && !/^in_[A-Za-z0-9]{1,80}$/.test(startingAfter))
        throw new Error("Invalid invoice cursor");
      await assertCurrentConnection();
      const params = new URLSearchParams({ limit: "50" });
      if (startingAfter) params.set("starting_after", startingAfter);
      return stripeRequest(apiKey, `/invoices?${params}`);
    },
    billingPortal: async (body: URLSearchParams, key: string) => {
      await assertCurrentConnection();
      return stripeRequest(apiKey, "/billing_portal/sessions", body, key);
    },
    webhookSecret,
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
      operation: "add_lines" | "finalize" | "send" | "void",
      body: URLSearchParams,
      key: string,
    ) => {
      if (
        !/^in_[A-Za-z0-9]{1,80}$/.test(id) ||
        !["add_lines", "finalize", "send", "void"].includes(operation)
      )
        throw new Error("Invalid Stripe invoice operation");
      await assertCurrentConnection();
      return stripeRequest(apiKey, `/invoices/${id}/${operation}`, body, key);
    },
  };
}
