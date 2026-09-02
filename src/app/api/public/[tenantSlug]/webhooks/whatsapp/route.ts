import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { ingestWhatsAppMessage } from "@/lib/revenue-os/integration-adapters";
import type { WhatsAppIncomingMessagePayload } from "@/lib/revenue-os/integration-adapters";

export const runtime = "nodejs";

/**
 * Verify the Meta/WhatsApp Business Platform HMAC-SHA256 signature.
 * The header format is: sha256=<hex-digest>
 */
function verifyWhatsAppSignature(rawBody: Buffer, appSecret: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const receivedHex = header.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** GET — webhook verification challenge from Meta during app setup */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "whatsapp");
  if (!provider) return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });

  const verifyToken =
    provider.webhookSecret || (provider.allowEnvironment ? process.env.WHATSAPP_VERIFY_TOKEN : null);
  if (!verifyToken) return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** POST — incoming WhatsApp Business messages and status updates */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "whatsapp");
  const appSecret =
    provider?.apiKey || (provider?.allowEnvironment ? process.env.WHATSAPP_APP_SECRET : null);
  if (!provider || !appSecret) {
    return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });
  }

  // Read raw body for HMAC verification
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (!verifyWhatsAppSignature(rawBody, appSecret, signatureHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return runWithTenantRequestContext(provider.context, async () => {
    const supabase = createPlatformServiceRoleClient("whatsapp-webhook");
    const receipts: string[] = [];
    const errors: string[] = [];

    // Meta sends a nested structure: payload.entry[].changes[].value.messages[]
    const entries = (payload as Record<string, unknown>)?.entry;
    if (!Array.isArray(entries)) {
      return NextResponse.json({ received: true, messages: 0 });
    }

    for (const entry of entries) {
      const changes = (entry as Record<string, unknown>)?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const value = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
        const messages = value?.messages;
        if (!Array.isArray(messages)) continue;

        const businessPhoneNumberId = String(value?.metadata
          ? (value.metadata as Record<string, unknown>)?.phone_number_id ?? ""
          : "");

        for (const message of messages) {
          const msg = message as Record<string, unknown>;
          if (msg.type !== "text") continue; // Only process text messages for now
          const rawContacts = Array.isArray(value?.contacts) ? (value?.contacts as Array<Record<string, unknown>>) : [];
          const profile = rawContacts[0]?.profile as Record<string, unknown> | undefined;
          const senderName = typeof profile?.name === "string" && profile.name ? profile.name : undefined;

          const incoming: WhatsAppIncomingMessagePayload = {
            messageId: String(msg.id ?? ""),
            fromPhoneNumber: String(msg.from ?? ""),
            senderName,
            body: String((msg.text as Record<string, unknown>)?.body ?? ""),
            timestamp: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            businessPhoneNumberId,
          };

          try {
            const result = await ingestWhatsAppMessage(supabase, incoming);
            receipts.push(result.contact?.id ?? "resolved");
          } catch (err) {
            errors.push(
              `${incoming.messageId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    return NextResponse.json({
      received: true,
      messages: receipts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  });
}
