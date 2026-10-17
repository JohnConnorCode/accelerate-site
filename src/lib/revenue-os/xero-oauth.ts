import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { safeErrorMessage } from "./db";

export const XERO_OAUTH_STATE_TTL_SECONDS = 10 * 60;

type OAuthStatePayload = {
  state: string;
  tenantId: string;
  tenantSlug: string;
  expiresAt: number;
};

export type XeroOperation = "authorize" | "callback" | "connection-test";

export type XeroOperatorError = {
  code:
    | "not_configured"
    | "not_connected"
    | "reconnect_required"
    | "tenant_unavailable"
    | "connection_failed";
  message: string;
};

function stateSigningKey(): string {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  return key;
}

/** Namespaced so a Xero state binding can never be replayed as a Google one. */
function signature(payload: string): string {
  return createHmac("sha256", stateSigningKey())
    .update(`xero-oauth-state.v1:${payload}`)
    .digest("base64url");
}

export function createXeroOAuthStateBinding(
  input: Omit<OAuthStatePayload, "expiresAt">,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      expiresAt: now + XERO_OAUTH_STATE_TTL_SECONDS * 1000,
    } satisfies OAuthStatePayload),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyXeroOAuthStateBinding(
  binding: string | undefined,
  expected: Omit<OAuthStatePayload, "expiresAt">,
  now = Date.now(),
): boolean {
  try {
    if (!binding) return false;
    const separator = binding.lastIndexOf(".");
    if (separator <= 0) return false;
    const payload = binding.slice(0, separator);
    const suppliedSignature = binding.slice(separator + 1);
    const expectedSignature = signature(payload);
    const suppliedBytes = Buffer.from(suppliedSignature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (
      suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(suppliedBytes, expectedBytes)
    )
      return false;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;
    return (
      decoded.state === expected.state &&
      decoded.tenantId === expected.tenantId &&
      decoded.tenantSlug === expected.tenantSlug &&
      typeof decoded.expiresAt === "number" &&
      decoded.expiresAt >= now &&
      decoded.expiresAt <= now + XERO_OAUTH_STATE_TTL_SECONDS * 1000
    );
  } catch (error) {
    // A tampered, truncated or unparseable binding is invalid by definition,
    // but the reason is still recorded rather than discarded.
    console.warn("[xero/oauth] rejected a state binding", safeErrorMessage(error));
    return false;
  }
}

export function xeroOperatorError(error: unknown, operation: XeroOperation): XeroOperatorError {
  const message = error instanceof Error ? error.message : "";
  if (/OAuth is not configured|ENCRYPTION_KEY is not configured/i.test(message)) {
    return {
      code: "not_configured",
      message: "Xero OAuth credentials and token encryption must be configured before connecting.",
    };
  }
  if (/Xero is not connected/i.test(message)) {
    return { code: "not_connected", message: "Xero is not connected." };
  }
  if (/refresh token|invalid_grant|encrypted envelope|encrypted secret format/i.test(message)) {
    return {
      code: "reconnect_required",
      message: "Xero authorization must be renewed from the Integrations workspace.",
    };
  }
  if (
    /tenant execution is unavailable|workspace is not active|explicit tenant context/i.test(message)
  ) {
    return {
      code: "tenant_unavailable",
      message: "Xero is unavailable while this workspace is inactive.",
    };
  }
  return {
    code: "connection_failed",
    message:
      operation === "connection-test"
        ? "Xero connection verification failed. Retry from the Integrations workspace."
        : "Xero connection failed. Retry from the Integrations workspace.",
  };
}

export function xeroServerErrorSummary(error: unknown, operation: XeroOperation) {
  const projected = xeroOperatorError(error, operation);
  return {
    operation,
    code: projected.code,
    errorType: error instanceof Error ? error.name : "UnknownError",
  };
}
