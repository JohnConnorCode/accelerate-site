import { z } from "zod";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/**
 * External Capability Service Adapter Contract
 *
 * This contract defines the ONLY supported shape for integrating external
 * open-source systems (including AGPL upstreams) into the platform.
 *
 * PRINCIPLES:
 * - Operator self-hosts the external service.
 * - URL and credentials travel the encrypted adapter path (integration-adapters.ts).
 * - Origin is pinned: the adapter hardcodes the provider base URL.
 * - Bytes and time are bounded: every outbound call has a byte limit and deadline.
 * - Idempotency is tenant-scoped: every external effect uses a tenant/action key.
 * - No upstream code is vendored into this repository.
 * - Version pin is recorded: the adapter declares the upstream version it targets.
 *
 * The Stripe adapter (stripe-adapter.ts) is the reference implementation.
 * Every new external capability adapter MUST follow this pattern.
 */

export const EXTSVC_ADAPTER_CONTRACT_VERSION = "extsvc-adapter.v1";

/**
 * Pinned provider origin configuration. The adapter hardcodes these.
 * No plugin or caller supplies a URL, header, key, or arbitrary network binding.
 */
export const providerOriginSchema = z
  .object({
    /** Exact base URL including version path, e.g. "https://api.stripe.com/v1" */
    baseUrl: z.string().url().startsWith("https://"),
    /** Pinned API version string, e.g. "2025-06-30.basil" */
    apiVersion: z.string().min(1).max(64),
    /** Maximum response bytes for any single call. Enforced at the transport layer. */
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    /** Per-call deadline in milliseconds. Enforced via AbortSignal.timeout. */
    timeoutMs: z.number().int().positive().max(60_000),
    /** Whether the provider supports idempotency keys. If true, the adapter MUST use them. */
    supportsIdempotencyKeys: z.boolean(),
  })
  .strict();

export type ProviderOrigin = z.infer<typeof providerOriginSchema>;

/**
 * Bounded transport options. The adapter's internal request function MUST enforce these.
 */
export const boundedTransportOptionsSchema = z
  .object({
    /** Hard limit on response body size. Stream reader must enforce before buffering. */
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    /** Per-call deadline in milliseconds. Must use AbortSignal.timeout. */
    timeoutMs: z.number().int().positive().max(60_000),
    /** Whether to follow redirects. Defaults to false for safety. */
    followRedirects: z.boolean().optional().default(false),
    /** Whether to allow caching. Defaults to no-store. */
    cache: z.enum(["no-store", "force-cache"]).optional().default("no-store"),
  })
  .strict();

export type BoundedTransportOptions = z.infer<typeof boundedTransportOptionsSchema>;

/**
 * Upstream version pinning. The adapter MUST declare the exact upstream version it targets.
 * A version bump requires a reviewed adapter update.
 */
export const versionPinSchema = z
  .object({
    /** The upstream project name, e.g. "stagehand", "activepieces", "crawlee" */
    project: z.string().min(1).max(64),
    /** Exact semantic version or commit hash the adapter was developed against. */
    version: z.string().min(1).max(128),
    /** Date the pin was reviewed, ISO 8601. */
    reviewedAt: z.string().datetime(),
    /** Optional: known breaking changes since this pin that would require adapter updates. */
    breakingChangesSince: z.string().max(500).optional(),
  })
  .strict();

export type VersionPin = z.infer<typeof versionPinSchema>;

/**
 * Tenant-scoped idempotency key format. Every external effect MUST use this pattern.
 * Format: `<capability>:<tenantId>:<action>:<digest>`
 * The digest is a SHA-256 of the exact request payload, hex-encoded.
 */
export function buildIdempotencyKey(
  capability: string,
  tenantId: string,
  action: string,
  payload: unknown,
): string {
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
  return `${capability}:${tenantId}:${action}:${digest}`;
}

/**
 * Credential schema for an external capability adapter.
 * Mirrors integration-adapters.ts credentialFields but adds origin binding.
 */
export const extsvcCredentialSchema = z
  .object({
    /** The field name in the admin form. */
    formField: z.string().min(1).max(64),
    /** The key under which this credential is stored encrypted. */
    encryptedKey: z.string().min(1).max(64),
    /** Whether this credential is required for the adapter to function. */
    required: z.boolean().default(true),
    /** Optional: description for the admin UI. */
    description: z.string().max(200).optional(),
  })
  .strict();

export type ExtsvcCredentialField = z.infer<typeof extsvcCredentialSchema>;

/**
 * The complete adapter contract that every external capability adapter must satisfy.
 * This is validated at build time and runtime.
 */
export interface ExtsvcAdapterContract {
  /** Stable unique identifier, e.g. "stagehand", "crawlee", "activepieces-pieces" */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category matching integration-adapters.ts: "crm" | "messaging" | "notifications" | "delivery" */
  category: "crm" | "messaging" | "notifications" | "delivery";
  /** Pinned provider origin. Hardcoded in the adapter. */
  origin: ProviderOrigin;
  /** Bounded transport options for all outbound calls. */
  transport: BoundedTransportOptions;
  /** Upstream version pin. */
  versionPin: VersionPin;
  /** Credential fields mapping admin form → encrypted storage. */
  credentialFields: ReadonlyArray<ExtsvcCredentialField>;
  /**
   * Verify credentials against the provider. Must make a real call.
   * Must not expose credentials in errors or logs.
   */
  verify(credentials: Record<string, unknown>): Promise<{
    valid: boolean;
    error?: string;
    accountDetails?: { id: string; name?: string; email?: string };
  }>;
  /**
   * Connect using verified credentials. Returns a connection receipt.
   * Does not stage a proposal; this is a setup-time operation.
   */
  connect(credentials: Record<string, unknown>): Promise<{
    connectedAt: string;
    status: "active" | "error" | "pending";
    accountIdentifier?: string;
    scopes?: string[];
    expiresAt?: string;
  }>;
  /**
   * Reconcile external state with canonical records.
   * Must authenticate, claim via runs.ts, preserve provider IDs, honor rate limits,
   * and terminate with status success|partial|skipped|failed.
   */
  reconcile(
    supabase: SupabaseClient,
    credentials: Record<string, unknown>,
    cursor?: string,
  ): Promise<{
    status: "success" | "partial" | "skipped" | "failed";
    processed: number;
    errors: string[];
    cursor?: string;
  }>;
  /**
   * Health check without side effects. Returns latency and healthy flag.
   */
  health(credentials: Record<string, unknown>): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }>;
}

/**
 * Conformance test checklist. Every external capability adapter MUST pass all items.
 * This is exported so the test suite can assert on it programmatically.
 */
export const EXTSVC_ADAPTER_CONFORMANCE_CHECKLIST = [
  {
    id: "pinned-origin",
    description: "Adapter hardcodes provider base URL; no caller-supplied URL accepted",
    severity: "blocking" as const,
  },
  {
    id: "bounded-bytes",
    description: "Every outbound call enforces maxResponseBytes at the stream reader",
    severity: "blocking" as const,
  },
  {
    id: "bounded-time",
    description: "Every outbound call uses AbortSignal.timeout with declared timeoutMs",
    severity: "blocking" as const,
  },
  {
    id: "tenant-idempotency",
    description: "Every external effect uses tenant-scoped idempotency key via buildIdempotencyKey",
    severity: "blocking" as const,
  },
  {
    id: "version-pin",
    description: "Adapter declares exact upstream version pin with reviewedAt date",
    severity: "blocking" as const,
  },
  {
    id: "no-vendored-code",
    description: "No upstream source code is copied into this repository",
    severity: "blocking" as const,
  },
  {
    id: "credential-encryption",
    description: "Credentials only via encryptSecret/resolveTenantProviderSecrets; never plaintext",
    severity: "blocking" as const,
  },
  {
    id: "bounded-client",
    description: "System-context paths use createServiceRoleClient(context), never unbound client",
    severity: "blocking" as const,
  },
  {
    id: "error-sanitization",
    description: "Errors and logs never contain credentials, payloads, or PII",
    severity: "blocking" as const,
  },
  {
    id: "idempotency-expiry",
    description: "Idempotency keys have documented TTL (e.g., 20h for Stripe)",
    severity: "warning" as const,
  },
  {
    id: "rate-limit-respect",
    description: "Adapter honors provider rate limits and reports remaining in health/reconcile",
    severity: "warning" as const,
  },
] as const;

/**
 * Reference implementation check: the Stripe adapter must pass all blocking checks.
 * This is validated in the test suite.
 */
export const REFERENCE_ADAPTER_ID = "stripe";

/**
 * Build a conformance test result for a given adapter.
 */
export function checkConformance(adapter: ExtsvcAdapterContract): {
  passed: boolean;
  blockingFailures: string[];
  warnings: string[];
} {
  const blockingFailures: string[] = [];
  const warnings: string[] = [];

  // pinned-origin
  if (!adapter.origin?.baseUrl || !adapter.origin.baseUrl.startsWith("https://")) {
    blockingFailures.push("pinned-origin: missing or non-HTTPS baseUrl");
  }
  if (!adapter.origin?.apiVersion) {
    blockingFailures.push("pinned-origin: missing apiVersion");
  }

  // bounded-bytes
  if (
    !adapter.transport?.maxResponseBytes ||
    adapter.transport.maxResponseBytes > 10 * 1024 * 1024
  ) {
    blockingFailures.push("bounded-bytes: missing or exceeds 10 MiB limit");
  }

  // bounded-time
  if (!adapter.transport?.timeoutMs || adapter.transport.timeoutMs > 60_000) {
    blockingFailures.push("bounded-time: missing or exceeds 60s limit");
  }

  // version-pin
  if (
    !adapter.versionPin?.project ||
    !adapter.versionPin?.version ||
    !adapter.versionPin?.reviewedAt
  ) {
    blockingFailures.push("version-pin: incomplete (project, version, reviewedAt required)");
  }

  // tenant-idempotency: verified at runtime via buildIdempotencyKey usage

  // no-vendored-code: static analysis in test suite

  // credential-encryption: verified by integration-adapters.ts usage pattern

  // bounded-client: verified by integration-adapters.ts usage pattern

  // error-sanitization: spot-checked in test suite

  // idempotency-expiry
  if (!adapter.versionPin?.breakingChangesSince) {
    warnings.push("idempotency-expiry: no documented TTL for idempotency keys");
  }

  // rate-limit-respect
  if (!adapter.health || !adapter.reconcile) {
    warnings.push("rate-limit-respect: health/reconcile not fully implemented");
  }

  return {
    passed: blockingFailures.length === 0,
    blockingFailures,
    warnings,
  };
}
