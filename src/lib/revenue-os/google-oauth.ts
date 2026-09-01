import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_OAUTH_STATE_TTL_SECONDS = 10 * 60;

type OAuthStatePayload = {
  state: string;
  tenantId: string;
  tenantSlug: string;
  expiresAt: number;
};

export type GoogleOperation = "authorize" | "callback" | "connection-test" | "sync";

export type GoogleOperatorError = {
  code:
    | "not_configured"
    | "not_connected"
    | "reconnect_required"
    | "tenant_unavailable"
    | "connection_failed"
    | "sync_failed";
  message: string;
};

function stateSigningKey(): string {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  return key;
}

function signature(payload: string): string {
  return createHmac("sha256", stateSigningKey())
    .update(`google-oauth-state.v1:${payload}`)
    .digest("base64url");
}

export function createGoogleOAuthStateBinding(
  input: Omit<OAuthStatePayload, "expiresAt">,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      expiresAt: now + GOOGLE_OAUTH_STATE_TTL_SECONDS * 1000,
    } satisfies OAuthStatePayload),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyGoogleOAuthStateBinding(
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
      decoded.expiresAt <= now + GOOGLE_OAUTH_STATE_TTL_SECONDS * 1000
    );
  } catch {
    return false;
  }
}

export function googleOperatorError(
  error: unknown,
  operation: GoogleOperation,
): GoogleOperatorError {
  const message = error instanceof Error ? error.message : "";
  if (/OAuth is not configured|ENCRYPTION_KEY is not configured/i.test(message)) {
    return {
      code: "not_configured",
      message:
        "Google OAuth credentials and token encryption must be configured before connecting.",
    };
  }
  if (/Workspace is not connected/i.test(message)) {
    return { code: "not_connected", message: "Google Workspace is not connected." };
  }
  if (/refresh token|invalid_grant|encrypted envelope|encrypted secret format/i.test(message)) {
    return {
      code: "reconnect_required",
      message: "Google authorization must be renewed from the Integrations workspace.",
    };
  }
  if (
    /tenant execution is unavailable|workspace is not active|explicit tenant context/i.test(message)
  ) {
    return {
      code: "tenant_unavailable",
      message: "Google is unavailable while this workspace is inactive.",
    };
  }
  return operation === "sync"
    ? {
        code: "sync_failed",
        message:
          "Google sync failed. Review the connection and latest source receipt before retrying.",
      }
    : {
        code: "connection_failed",
        message: "Google connection verification failed. Retry from the Integrations workspace.",
      };
}

export function googleServerErrorSummary(error: unknown, operation: GoogleOperation) {
  const projected = googleOperatorError(error, operation);
  return {
    operation,
    code: projected.code,
    errorType: error instanceof Error ? error.name : "UnknownError",
  };
}
