import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { importHubSpotBatch } from "@/lib/revenue-os/integration-adapters";
import type { HubSpotRawContact, HubSpotRawDeal } from "@/lib/revenue-os/integration-adapters";

export const runtime = "nodejs";

/**
 * Verify HubSpot's v3 webhook HMAC-SHA256 signature.
 * HubSpot sends: X-HubSpot-Signature-v3 = base64(HMAC-SHA256(clientSecret + timestamp + method + uri + rawBody))
 */
function verifyHubSpotSignatureV3(
  rawBody: Buffer,
  clientSecret: string,
  header: string | null,
  timestamp: string | null,
  method: string,
  uri: string,
): boolean {
  if (!header || !timestamp) return false;
  // Reject requests older than 5 minutes to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > 300_000) return false;
  const source = clientSecret + timestamp + method.toUpperCase() + uri + rawBody.toString("utf8");
  const expected = createHmac("sha256", clientSecret).update(source).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * HubSpot contact/deal webhook event shapes.
 * https://developers.hubspot.com/docs/api/webhooks
 */
interface HubSpotWebhookEvent {
  subscriptionType: string;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  eventId?: number;
  subscriptionId?: number;
  portalId?: number;
  occurredAt?: number;
  attemptNumber?: number;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "hubspot");
  const clientSecret =
    provider?.webhookSecret || (provider?.allowEnvironment ? process.env.HUBSPOT_CLIENT_SECRET : null);
  if (!provider || !clientSecret) {
    return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });
  }

  // Read raw body for signature verification
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signatureHeader = request.headers.get("x-hubspot-signature-v3");
  const timestampHeader = request.headers.get("x-hubspot-request-timestamp");
  const requestUri = request.url;

  if (
    !verifyHubSpotSignatureV3(rawBody, clientSecret, signatureHeader, timestampHeader, "POST", requestUri)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: HubSpotWebhookEvent[];
  try {
    const parsed = JSON.parse(rawBody.toString("utf8"));
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return runWithTenantRequestContext(provider.context, async () => {
    const supabase = createPlatformServiceRoleClient("hubspot-webhook");

    // HubSpot webhooks only emit change notifications (objectId + subscriptionType).
    // We batch by type and import the minimal contact/deal shapes we have from the event.
    const contactEvents = events.filter((e) =>
      e.subscriptionType?.startsWith("contact."),
    );
    const dealEvents = events.filter((e) => e.subscriptionType?.startsWith("deal."));

    // Build minimal raw objects from the webhook events — real sync
    // would re-fetch full properties, but this gives us replay-safe identity capture.
    const contacts: HubSpotRawContact[] = contactEvents.map((e) => ({
      id: String(e.objectId),
      properties: {
        // Email is sent as propertyValue when subscriptionType === contact.propertyChange and propertyName === email
        email: e.propertyName === "email" ? e.propertyValue : undefined,
      },
    }));

    const deals: HubSpotRawDeal[] = dealEvents.map((e) => ({
      id: String(e.objectId),
      properties: {
        dealname: e.propertyName === "dealname" ? e.propertyValue : `Deal ${e.objectId}`,
        amount: e.propertyName === "amount" ? e.propertyValue : undefined,
        dealstage: e.propertyName === "dealstage" ? e.propertyValue : undefined,
      },
    }));

    const filteredContacts = contacts.filter((c) => c.properties.email);
    const filteredDeals = deals.filter((d) => d.properties.dealname);

    if (filteredContacts.length === 0 && filteredDeals.length === 0) {
      return NextResponse.json({ received: true, imported: 0, reason: "no actionable properties" });
    }

    const summary = await importHubSpotBatch(supabase, {
      contacts: filteredContacts,
      deals: filteredDeals,
    });

    return NextResponse.json({
      received: true,
      imported: summary.contactsImported + summary.dealsImported,
      skipped: summary.contactsSkipped + summary.dealsSkipped,
      errors: summary.errors.length > 0 ? summary.errors : undefined,
    });
  });
}
