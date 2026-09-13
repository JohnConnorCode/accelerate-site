import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { processStripeWebhook, verifyStripeSignature } from "@/lib/revenue-os/subscriptions";

async function readWebhookBody(request: Request, maxBytes = 262144) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Webhook payload exceeds its size limit");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Webhook body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Webhook payload exceeds its size limit");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: NextRequest, route: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await route.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "stripe");
  if (!provider?.webhookSecret) return NextResponse.json({ error: "Stripe webhook unavailable" }, { status: 404 });
  let body: string;
  try {
    body = await readWebhookBody(request);
  } catch (error) {
    console.warn(
      "[stripe-webhook] rejected request body:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Webhook payload exceeds its size limit" }, { status: 413 });
  }
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(body, signature, provider.webhookSecret)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  try {
    const event = JSON.parse(body) as Record<string, unknown>;
    const result = await processStripeWebhook(createServiceRoleClient(provider.context), event);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
