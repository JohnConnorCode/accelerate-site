import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { decryptTenantSecret } from "./encryption";
import type { IntegrationAdapter } from "./integration-adapters";
import type { ExtsvcAdapterContract } from "./extsvc-adapter-contract";

/**
 * Twilio Programmable Messaging with the workspace's own number. The origin,
 * API version and response bounds are fixed here; no caller supplies a URL.
 * Twilio has no idempotency key for message creation, so a send that times
 * out after Twilio may have accepted it is reported as uncertain and must be
 * reconciled against the account's message log before any retry.
 */
export const TWILIO_API_VERSION = "2010-04-01";
const twilioOrigin = {
  baseUrl: `https://api.twilio.com/${TWILIO_API_VERSION}`,
  apiVersion: TWILIO_API_VERSION,
  maxResponseBytes: 262144,
  timeoutMs: 12000,
  supportsIdempotencyKeys: false,
};
const twilioTransport = {
  maxResponseBytes: twilioOrigin.maxResponseBytes,
  timeoutMs: twilioOrigin.timeoutMs,
  followRedirects: false,
  cache: "no-store" as const,
};
const twilioCredentials: ExtsvcAdapterContract["credentialFields"] = [
  { formField: "accountSid", encryptedKey: "account_sid", required: true },
  // The auth token also signs Twilio's webhooks, so it is stored where the
  // provider resolver reads a webhook's signing secret.
  { formField: "authToken", encryptedKey: "api_key", required: true },
  { formField: "fromNumber", encryptedKey: "from_number", required: true },
];

export const TWILIO_ACCOUNT_SID = /^AC[0-9a-f]{32}$/;
export const TWILIO_AUTH_TOKEN = /^[0-9a-f]{32}$/;
/** E.164: a plus sign and 8 to 15 digits. Twilio sends and receives numbers in this form. */
export const E164_PHONE = /^\+[1-9]\d{7,14}$/;
/** Carrier opt-out and opt-in keywords Twilio documents for long codes. */
export const SMS_OPT_OUT = /^(stop|stopall|unsubscribe|cancel|end|quit)$/i;
export const SMS_OPT_IN = /^(start|unstop|yes)$/i;

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/** The send may have reached Twilio: reconcile before deciding anything else. */
export class TwilioUncertainError extends Error {}

function readCredentials(input: Record<string, unknown>): TwilioCredentials | null {
  const accountSid = typeof input.accountSid === "string" ? input.accountSid.trim() : "";
  const authToken = typeof input.authToken === "string" ? input.authToken.trim() : "";
  const fromNumber = typeof input.fromNumber === "string" ? input.fromNumber.trim() : "";
  return TWILIO_ACCOUNT_SID.test(accountSid) &&
    TWILIO_AUTH_TOKEN.test(authToken) &&
    E164_PHONE.test(fromNumber)
    ? { accountSid, authToken, fromNumber }
    : null;
}

async function twilioRequest(
  credentials: Pick<TwilioCredentials, "accountSid" | "authToken">,
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${twilioOrigin.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body?.toString(),
      signal: AbortSignal.timeout(twilioTransport.timeoutMs),
      cache: twilioTransport.cache,
      redirect: "error",
    });
  } catch (error) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    if (body && timedOut)
      throw new TwilioUncertainError(
        "Twilio did not answer in time. The message may have been sent; reconcile before retrying.",
      );
    throw new Error(timedOut ? "Twilio did not answer in time." : "Twilio could not be reached.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Twilio returned no response body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > twilioTransport.maxResponseBytes) {
        await reader.cancel();
        throw new Error("Twilio response exceeded its bound");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    console.warn("[twilio] Provider response was not JSON", { status: response.status });
    parsed = null;
  }
  if (!response.ok) {
    // Twilio error codes are numeric and safe to show; messages may echo input.
    const code =
      parsed && typeof parsed === "object" && Number.isInteger((parsed as { code?: unknown }).code)
        ? (parsed as { code: number }).code
        : null;
    console.error("[twilio] Provider request failed", { status: response.status, code });
    throw new Error(
      `Twilio request failed (HTTP ${response.status}${code ? `, error ${code}` : ""}). Check the account, number and message before retrying.`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Twilio response was not an object");
  return parsed as Record<string, unknown>;
}

export const twilioAdapter: IntegrationAdapter & ExtsvcAdapterContract = {
  id: "twilio",
  name: "Twilio",
  category: "messaging",
  origin: twilioOrigin,
  transport: twilioTransport,
  versionPin: {
    project: "twilio-rest-api",
    version: TWILIO_API_VERSION,
    reviewedAt: "2026-11-14T00:00:00.000Z",
  },
  credentialFields: twilioCredentials,
  async verify(input) {
    const credentials = readCredentials(input);
    if (!credentials)
      return {
        valid: false,
        provider: "twilio",
        error:
          "Enter the Account SID (AC…), the 32-character auth token and your Twilio number in +E.164 form.",
      };
    try {
      const account = await twilioRequest(credentials, `/Accounts/${credentials.accountSid}.json`);
      if (account.sid !== credentials.accountSid || account.status !== "active")
        return { valid: false, provider: "twilio", error: "This Twilio account is not active." };
      const numbers = await twilioRequest(
        credentials,
        `/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json?${new URLSearchParams({ PhoneNumber: credentials.fromNumber })}`,
      );
      const owned = Array.isArray(numbers.incoming_phone_numbers)
        ? numbers.incoming_phone_numbers.length > 0
        : false;
      if (!owned)
        return {
          valid: false,
          provider: "twilio",
          error: "That number is not on this Twilio account. Use a number the account owns.",
        };
      return {
        valid: true,
        provider: "twilio",
        accountDetails: { id: credentials.accountSid, name: credentials.fromNumber },
      };
    } catch {
      console.error("[twilio] Credential verification failed");
      return {
        valid: false,
        provider: "twilio",
        error: "Twilio verification failed. Check the Account SID and auth token.",
      };
    }
  },
  async reconcile() {
    return {
      status: "skipped",
      provider: "twilio",
      processed: 0,
      errors: ["Inbound texts arrive through the signed webhook; sends reconcile per message."],
    };
  },
  async health(credentials) {
    const started = Date.now();
    const result = await this.verify(credentials);
    return {
      healthy: result.valid,
      provider: "twilio",
      latencyMs: Date.now() - started,
      error: result.valid ? undefined : result.error,
    };
  },
  async connect(credentials) {
    const result = await this.verify(credentials);
    if (!result.valid) throw new Error(result.error);
    return {
      provider: "twilio",
      status: "active",
      connectedAt: new Date().toISOString(),
      accountIdentifier: result.accountDetails?.name,
    };
  },
};

/** The workspace's connected Twilio credentials, decrypted for one operation. */
export async function tenantTwilioClient(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Twilio requires a tenant-bound host");
  const { data: connection, error } = await db
    .from("integration_connections")
    .select("status,encrypted_credentials,credential_version")
    .eq("tenant_id", tenantId)
    .eq("provider", "twilio")
    .maybeSingle();
  if (error || !connection || connection.status !== "connected")
    throw new Error("Connect Twilio for this workspace first");
  const encrypted = (connection.encrypted_credentials ?? {}) as Record<string, unknown>;
  const read = (key: string) => {
    const value = encrypted[key];
    if (typeof value !== "string") throw new Error("Twilio credential is unavailable");
    return decryptTenantSecret(value, tenantId, "twilio", key);
  };
  const credentials = readCredentials({
    accountSid: read("account_sid"),
    authToken: read("api_key"),
    fromNumber: read("from_number"),
  });
  if (!credentials) throw new Error("Stored Twilio credentials are invalid; reconnect Twilio");
  return { tenantId, credentialVersion: Number(connection.credential_version), ...credentials };
}

/** Sends one text. A timeout after the request left throws TwilioUncertainError. */
export async function sendTwilioSms(
  client: TwilioCredentials,
  input: { to: string; body: string },
): Promise<{ sid: string; status: string }> {
  if (!E164_PHONE.test(input.to)) throw new Error("The recipient number must be in +E.164 form");
  const message = await twilioRequest(
    client,
    `/Accounts/${client.accountSid}/Messages.json`,
    new URLSearchParams({ To: input.to, From: client.fromNumber, Body: input.body }),
  );
  if (typeof message.sid !== "string" || !/^(SM|MM)[0-9a-f]{32}$/.test(message.sid))
    throw new TwilioUncertainError(
      "Twilio accepted the request without a message receipt; reconcile before retrying.",
    );
  return {
    sid: message.sid,
    status: typeof message.status === "string" ? message.status : "queued",
  };
}

/**
 * Finds a text this workspace already sent with the exact body to the same
 * number since `since`, so an uncertain send is never repeated blindly.
 */
export async function findSentTwilioSms(
  client: TwilioCredentials,
  input: { to: string; body: string; since: string },
): Promise<{ sid: string; status: string } | null> {
  const query = new URLSearchParams({
    To: input.to,
    From: client.fromNumber,
    "DateSent>": input.since.slice(0, 10),
    PageSize: "50",
  });
  const page = await twilioRequest(client, `/Accounts/${client.accountSid}/Messages.json?${query}`);
  const messages = Array.isArray(page.messages) ? (page.messages as Record<string, unknown>[]) : [];
  const match = messages.find(
    (message) =>
      message.body === input.body &&
      typeof message.sid === "string" &&
      Date.parse(String(message.date_created ?? "")) >= Date.parse(input.since) - 60_000,
  );
  return match
    ? { sid: String(match.sid), status: typeof match.status === "string" ? match.status : "sent" }
    : null;
}

/** Twilio's request signature: HMAC-SHA1 of the URL plus each sorted parameter name and value. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = Object.keys(params)
    .sort()
    .reduce((text, key) => text + key + params[key], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  header: string | null,
) {
  if (!header) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
