import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateIdentity } from "./identity";
import { recordActivity } from "./activities";

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
}

export interface IntegrationAdapter<TCreds = Record<string, unknown>> {
  id: string;
  name: string;
  category: "crm" | "messaging" | "notifications" | "delivery";
  verify(credentials: TCreds): Promise<IntegrationVerificationResult>;
  connect(credentials: TCreds): Promise<IntegrationConnectionReceipt>;
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

  // Resolve or create identity
  const identity = await resolveOrCreateIdentity(supabase, {
    name: payload.senderName || `WhatsApp User (${normalizedPhone})`,
    phone: normalizedPhone,
    source: "whatsapp",
    sourceRecordType: "whatsapp_message",
    sourceRecordId: `whatsapp:${payload.messageId}`,
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

  const hubspotContactToCanonicalId = new Map<string, string>();

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
      const identity = await resolveOrCreateIdentity(supabase, {
        name: fullName || "Imported Contact",
        email,
        phone,
        companyName: (rawContact.properties.company as string) || undefined,
        source: "hubspot_import",
        sourceRecordType: "hubspot_contact",
        sourceRecordId: `hubspot:${rawContact.id}`,
      });

      if (identity.contact?.id) {
        hubspotContactToCanonicalId.set(rawContact.id, identity.contact.id);
        summary.contactsImported++;
      } else {
        summary.contactsSkipped++;
      }
    } catch (err) {
      summary.contactsSkipped++;
      summary.errors.push(`Failed to import contact ${rawContact.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Process Deals
  for (const rawDeal of batch.deals) {
    const dealName = rawDeal.properties.dealname || "Imported Deal";
    const amountNum = typeof rawDeal.properties.amount === "number"
      ? rawDeal.properties.amount
      : rawDeal.properties.amount ? parseFloat(String(rawDeal.properties.amount)) : 0;

    const primaryContactHubspotId = rawDeal.associatedContactIds?.[0];
    const canonicalContactId = primaryContactHubspotId ? hubspotContactToCanonicalId.get(primaryContactHubspotId) : undefined;

    try {
      const { data: existingOpp } = await supabase
        .from("opportunities")
        .select("id")
        .eq("source_id", `hubspot:${rawDeal.id}`)
        .maybeSingle();

      if (existingOpp) {
        summary.dealsSkipped++; // Idempotent skip
        continue;
      }

      const { error: insertError } = await supabase
        .from("opportunities")
        .insert({
          title: dealName,
          value: isNaN(amountNum) ? 0 : amountNum,
          stage: "inquiry", // Start in canonical inquiry/triage stage
          contact_id: canonicalContactId || null,
          source: "hubspot_import",
          source_id: `hubspot:${rawDeal.id}`,
          status: "open",
        });

      if (insertError) {
        summary.dealsSkipped++;
        summary.errors.push(`HubSpot deal ${rawDeal.id} insert error: ${insertError.message}`);
      } else {
        summary.dealsImported++;
      }
    } catch (err) {
      summary.dealsSkipped++;
      summary.errors.push(`Failed to import deal ${rawDeal.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
