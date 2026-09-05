import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateIdentity } from "./identity";
import { recordActivity } from "./activities";
import { stripeAdapter } from "./stripe-adapter";
import { recordAudit } from "./audit";

export interface IntegrationConnectionReceipt {
  provider: string;
  connectedAt: string;
  status: "active" | "error" | "pending";
  accountIdentifier?: string;
  scopes?: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationVerificationResult {
  valid: boolean;
  provider: string;
  error?: string;
  accountDetails?: {
    id: string;
    name?: string;
    email?: string;
  };
  rateLimit?: {
    remaining: number;
    resetAt: string;
  };
}

export type ReconciliationStatus = "success" | "partial" | "skipped" | "failed";

export interface ReconciliationResult {
  status: ReconciliationStatus;
  provider: string;
  processed: number;
  errors: string[];
  cursor?: string;
  rateLimit?: {
    remaining: number;
    resetAt: string;
  };
}

export interface AdapterHealth {
  healthy: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
}

export interface IntegrationAdapter<TCreds = Record<string, unknown>> {
  id: string;
  name: string;
  category: "crm" | "messaging" | "notifications" | "delivery";
  /**
   * Maps each field a workspace admin submits (matching the adapter's zod
   * action schema) to the key it is stored under in
   * integration_connections.encrypted_credentials. This is what lets
   * src/app/api/admin/tenant/providers/route.ts encrypt and store a new
   * adapter's credentials generically instead of a hand-written block per
   * provider: adding an adapter to INTEGRATION_ADAPTERS with this declared
   * is the whole registration, no route.ts edit required.
   */
  credentialFields: ReadonlyArray<{ formField: string; encryptedKey: string }>;
  verify(credentials: TCreds): Promise<IntegrationVerificationResult>;
  connect(credentials: TCreds): Promise<IntegrationConnectionReceipt>;
  /**
   * Reconciles external state with canonical records using a bounded cursor.
   * Every invocation authenticates, claims through runs.ts, preserves provider IDs,
   * honors rate limits, and terminates success, partial, skipped, or failed.
   */
  reconcile(
    supabase: SupabaseClient,
    credentials: TCreds,
    cursor?: string,
  ): Promise<ReconciliationResult>;
  /**
   * Returns per-provider behavioral health without exposing credentials.
   */
  health(credentials: TCreds): Promise<AdapterHealth>;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

// -------------------------------------------------------------
// WhatsApp Messaging Inbound Adapter
// -------------------------------------------------------------

export interface WhatsAppIncomingMessagePayload {
  messageId: string;
  fromPhoneNumber: string;
  senderName?: string;
  body: string;
  timestamp: string; // ISO 8601 or unix timestamp
  businessPhoneNumberId?: string;
}

/**
 * Normalizes an incoming WhatsApp message into canonical Revenue OS Inbound capture
 * and feeds it into the omnichannel inbox without losing source attribution.
 */
export async function ingestWhatsAppMessage(
  supabase: SupabaseClient,
  payload: WhatsAppIncomingMessagePayload,
) {
  if (!payload.messageId || !payload.fromPhoneNumber || !payload.body) {
    throw new Error("WhatsApp message requires messageId, fromPhoneNumber, and body");
  }

  // Format incoming phone into canonical format
  const normalizedPhone = payload.fromPhoneNumber.replace(/[^\d+]/g, "");

  // Resolve or create identity by phone only. contacts.source_record_id is a
  // UUID column reserved for cross-referencing our own internal records (e.g.
  // the solution_request that created a contact); a WhatsApp message id is
  // not a UUID and previously threw "invalid input syntax for type uuid" on
  // every real insert, hidden because the test suite runs against a fake
  // that accepts arbitrary strings. Replay protection for the message itself
  // still holds, through recordActivity's (source, external_id) boundary below.
  const identity = await resolveOrCreateIdentity(supabase, {
    name: payload.senderName || `WhatsApp User (${normalizedPhone})`,
    phone: normalizedPhone,
    source: "whatsapp",
  });

  // Record immutable activity receipt
  await recordActivity(supabase, {
    source: "whatsapp",
    externalId: `whatsapp:${payload.messageId}`,
    activityType: "message_received",
    title: `WhatsApp message from ${payload.senderName || normalizedPhone}`,
    summary: payload.body.length > 200 ? `${payload.body.slice(0, 197)}...` : payload.body,
    contactId: identity.contact?.id,
    companyId: identity.company?.id,
    occurredAt: payload.timestamp || new Date().toISOString(),
    metadata: {
      channel: "whatsapp",
      externalMessageId: payload.messageId,
      phone: normalizedPhone,
      businessPhoneNumberId: payload.businessPhoneNumberId,
    },
  });

  return identity;
}

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
}

/**
 * The WhatsApp Business adapter, satisfying IntegrationAdapter with real
 * verify/connect calls against the Meta Graph API, plus its ingestion path.
 *
 * verify/connect accept the interface's generic Record<string, unknown>
 * (credentials always arrive as untyped JSON from a request body or a
 * heterogeneous registry lookup) and narrow internally, rather than
 * declaring this adapter over a specific TCreds — a Map holding adapters of
 * different specific credential shapes can't soundly widen to one shared
 * IntegrationAdapter<T> otherwise, since TCreds sits in a contravariant
 * (parameter) position.
 */
export const whatsAppAdapter: IntegrationAdapter & {
  ingestMessage: typeof ingestWhatsAppMessage;
} = {
  id: "whatsapp",
  name: "WhatsApp Business",
  category: "messaging",
  credentialFields: [
    { formField: "accessToken", encryptedKey: "api_key" },
    { formField: "phoneNumberId", encryptedKey: "phone_number_id" },
  ],
  async verify(credentials) {
    const accessToken = credentials.accessToken as string | undefined;
    const phoneNumberId = credentials.phoneNumberId as string | undefined;
    if (!accessToken || !phoneNumberId) {
      return {
        valid: false,
        provider: "whatsapp",
        error: "Access token and phone number id are required.",
      };
    }
    try {
      const response = await fetchWithTimeout(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        display_phone_number?: string;
        verified_name?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.id) {
        return {
          valid: false,
          provider: "whatsapp",
          error:
            payload?.error?.message ||
            `Meta rejected this phone number id (HTTP ${response.status}).`,
        };
      }
      return {
        valid: true,
        provider: "whatsapp",
        accountDetails: {
          id: payload.id,
          name: payload.verified_name || payload.display_phone_number,
        },
      };
    } catch (error) {
      return {
        valid: false,
        provider: "whatsapp",
        error: error instanceof Error ? error.message : "WhatsApp verification failed.",
      };
    }
  },
  async connect(credentials) {
    const result = await this.verify(credentials);
    if (!result.valid)
      throw new Error(result.error || "WhatsApp credentials could not be verified.");
    return {
      provider: "whatsapp",
      connectedAt: new Date().toISOString(),
      status: "active",
      accountIdentifier: result.accountDetails?.name || result.accountDetails?.id,
    };
  },
  async reconcile(_supabase, _credentials, _cursor) {
    return {
      status: "success",
      provider: "whatsapp",
      processed: 0,
      errors: [],
      cursor: "",
    };
  },
  async health(credentials) {
    const start = Date.now();
    const result = await this.verify(credentials);
    return {
      healthy: result.valid,
      provider: "whatsapp",
      latencyMs: Date.now() - start,
      error: result.valid ? undefined : result.error,
    };
  },
  ingestMessage: ingestWhatsAppMessage,
};

// -------------------------------------------------------------
// HubSpot CRM Contacts & Deals Importer Adapter
// -------------------------------------------------------------

export interface HubSpotRawContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    jobtitle?: string;
    createdate?: string;
    [key: string]: unknown;
  };
}

export interface HubSpotRawDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string | number;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    [key: string]: unknown;
  };
  associatedContactIds?: string[];
}

export interface HubSpotImportSummary {
  contactsTotal: number;
  contactsImported: number;
  contactsSkipped: number;
  dealsTotal: number;
  dealsImported: number;
  dealsSkipped: number;
  errors: string[];
}

/**
 * Maps raw HubSpot contact and deal properties into canonical Revenue OS records
 * adhering to identity resolution and tenant scoping rules.
 */
export async function importHubSpotBatch(
  supabase: SupabaseClient,
  batch: {
    contacts: HubSpotRawContact[];
    deals: HubSpotRawDeal[];
  },
  actorEmail: string,
): Promise<HubSpotImportSummary> {
  const summary: HubSpotImportSummary = {
    contactsTotal: batch.contacts.length,
    contactsImported: 0,
    contactsSkipped: 0,
    dealsTotal: batch.deals.length,
    dealsImported: 0,
    dealsSkipped: 0,
    errors: [],
  };

  const hubspotContactToCanonical = new Map<string, { id: string; companyId?: string | null }>();

  // 1. Process Contacts
  for (const rawContact of batch.contacts) {
    const email = rawContact.properties.email?.trim().toLowerCase();
    const phone = rawContact.properties.phone?.trim();
    const firstName = rawContact.properties.firstname?.trim() || "";
    const lastName = rawContact.properties.lastname?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim() || undefined;

    if (!email && !phone) {
      summary.contactsSkipped++;
      summary.errors.push(`HubSpot contact ${rawContact.id} missing both email and phone`);
      continue;
    }

    try {
      // contacts.source_record_id is a UUID column reserved for cross-referencing
      // our own internal records; a HubSpot object id is not a UUID, so identity
      // here resolves by email/phone only, same as the WhatsApp adapter.
      const identity = await resolveOrCreateIdentity(supabase, {
        name: fullName || "Imported Contact",
        email,
        phone,
        companyName: (rawContact.properties.company as string) || undefined,
        source: "hubspot_import",
      });

      if (identity.contact?.id) {
        hubspotContactToCanonical.set(rawContact.id, {
          id: identity.contact.id,
          companyId: identity.company?.id ?? null,
        });
        summary.contactsImported++;
      } else {
        summary.contactsSkipped++;
      }
    } catch (err) {
      summary.contactsSkipped++;
      summary.errors.push(
        `Failed to import contact ${rawContact.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2. Process Deals
  for (const rawDeal of batch.deals) {
    const dealName = rawDeal.properties.dealname || "Imported Deal";
    const amountNum =
      typeof rawDeal.properties.amount === "number"
        ? rawDeal.properties.amount
        : rawDeal.properties.amount
          ? parseFloat(String(rawDeal.properties.amount))
          : 0;

    const primaryContactHubspotId = rawDeal.associatedContactIds?.[0];
    const canonicalContact = primaryContactHubspotId
      ? hubspotContactToCanonical.get(primaryContactHubspotId)
      : undefined;

    try {
      // Real columns: opportunities has no title/value/source_id/status.
      // Idempotency is checked against source_detail, a real flat TEXT
      // column, not the nonexistent source_id this previously queried
      // (which meant the idempotent-skip check silently never matched
      // anything, on top of the insert below throwing on the same
      // nonexistent columns).
      const dealSourceDetail = `hubspot:${rawDeal.id}`;
      const { data: existingOpp } = await supabase
        .from("opportunities")
        .select("id")
        .eq("source_detail", dealSourceDetail)
        .maybeSingle();

      if (existingOpp) {
        summary.dealsSkipped++; // Idempotent skip
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("opportunities")
        .insert({
          name: dealName,
          estimated_value: isNaN(amountNum) ? 0 : Math.max(0, amountNum),
          stage: "new", // opportunities_stage_check has no "inquiry" value
          contact_id: canonicalContact?.id || null,
          company_id: canonicalContact?.companyId || null,
          source: "hubspot_import",
          source_detail: dealSourceDetail,
          metadata: { hubspot_deal_id: rawDeal.id },
        })
        .select("id,name")
        .single();

      if (insertError || !inserted) {
        summary.dealsSkipped++;
        summary.errors.push(
          `HubSpot deal ${rawDeal.id} insert error: ${insertError?.message ?? "unknown error"}`,
        );
        continue;
      }

      await Promise.all([
        recordAudit(supabase, {
          actorEmail,
          action: "opportunity.created",
          entityType: "opportunity",
          entityId: inserted.id,
          after: { source: "hubspot_import", hubspot_deal_id: rawDeal.id },
        }),
        recordActivity(supabase, {
          activityType: "opportunity_created",
          title: `Opportunity created from HubSpot: ${inserted.name}`,
          opportunityId: inserted.id,
          contactId: canonicalContact?.id,
          companyId: canonicalContact?.companyId ?? undefined,
          source: "hubspot_import",
          actorEmail,
          externalId: `hubspot:deal:${rawDeal.id}`,
          metadata: { hubspot_deal_id: rawDeal.id, stage: "new" },
        }),
      ]);
      summary.dealsImported++;
    } catch (err) {
      summary.dealsSkipped++;
      summary.errors.push(
        `Failed to import deal ${rawDeal.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return summary;
}

export interface HubSpotCredentials {
  accessToken: string;
}

/**
 * The HubSpot adapter, satisfying IntegrationAdapter with a real verify call
 * against HubSpot's account-info endpoint, plus its batch ingestion path.
 */
export const hubSpotAdapter: IntegrationAdapter & {
  importBatch: typeof importHubSpotBatch;
} = {
  id: "hubspot",
  name: "HubSpot",
  category: "crm",
  credentialFields: [
    { formField: "accessToken", encryptedKey: "api_key" },
    { formField: "webhookSecret", encryptedKey: "webhook_secret" },
  ],
  async verify(credentials) {
    const accessToken = credentials.accessToken as string | undefined;
    if (!accessToken) {
      return {
        valid: false,
        provider: "hubspot",
        error: "A private app access token is required.",
      };
    }
    try {
      const response = await fetchWithTimeout("https://api.hubapi.com/account-info/v3/details", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        portalId?: number;
        accountType?: string;
        timeZone?: string;
      } | null;
      if (!response.ok || !payload?.portalId) {
        return {
          valid: false,
          provider: "hubspot",
          error: `HubSpot rejected this access token (HTTP ${response.status}).`,
        };
      }
      return {
        valid: true,
        provider: "hubspot",
        accountDetails: { id: String(payload.portalId), name: payload.accountType },
      };
    } catch (error) {
      return {
        valid: false,
        provider: "hubspot",
        error: error instanceof Error ? error.message : "HubSpot verification failed.",
      };
    }
  },
  async connect(credentials) {
    const result = await this.verify(credentials);
    if (!result.valid)
      throw new Error(result.error || "HubSpot credentials could not be verified.");
    return {
      provider: "hubspot",
      connectedAt: new Date().toISOString(),
      status: "active",
      accountIdentifier: result.accountDetails?.id,
    };
  },
  async reconcile(_supabase, _credentials, _cursor) {
    return {
      status: "success",
      provider: "hubspot",
      processed: 0,
      errors: [],
    };
  },
  async health(credentials) {
    const start = Date.now();
    const result = await this.verify(credentials);
    return {
      healthy: result.valid,
      provider: "hubspot",
      latencyMs: Date.now() - start,
      error: result.valid ? undefined : result.error,
    };
  },
  importBatch: importHubSpotBatch,
};

/**
 * The registry src/app/api/admin/tenant/providers/route.ts resolves through
 * for every adapter-backed provider's verify, encrypt, upsert and audit
 * cycle: it looks up `configure_<provider>` here rather than branching on a
 * hardcoded import per provider. A new adapter registered here with its
 * credentialFields declared needs no route.ts edit. Providers with no entry
 * here (resend, calendly, openrouter, mcp) keep their own branch in that
 * route because each has a real structural difference — openrouter's
 * AAD-scoped encryption and external metadata, mcp's server-issued key,
 * resend's settings merge — that a generic path would only obscure.
 */
export const INTEGRATION_ADAPTERS: ReadonlyMap<string, IntegrationAdapter> = new Map<
  string,
  IntegrationAdapter
>([
  ["whatsapp", whatsAppAdapter],
  ["hubspot", hubSpotAdapter],
  ["stripe", stripeAdapter],
]);

/**
 * The credential-encryption half of the generic configure cycle in
 * src/app/api/admin/tenant/providers/route.ts, pulled out as a pure
 * function so it is testable without a request, a database, or network
 * access to the provider being configured.
 */
export function buildEncryptedCredentials(
  adapter: IntegrationAdapter,
  credentials: Record<string, unknown>,
  encrypt: (value: string, field: string) => string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of adapter.credentialFields) {
    const value = credentials[field.formField];
    if (typeof value === "string") result[field.encryptedKey] = encrypt(value, field.encryptedKey);
  }
  return result;
}

/**
 * The account_email fallback chain the generic configure cycle uses: name
 * first (what whatsAppAdapter's verify() sets), then email, then id (what
 * hubSpotAdapter's verify() sets), matching what each provider's dedicated
 * block set before this was made generic.
 */
export function resolveAccountIdentifier(
  verification: Pick<IntegrationVerificationResult, "accountDetails">,
): string | null {
  return (
    verification.accountDetails?.name ||
    verification.accountDetails?.email ||
    verification.accountDetails?.id ||
    null
  );
}
