import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readBoundedText } from "@/lib/http/bounded-json";
import { ingestInboundSms } from "@/lib/revenue-os/sms";
import { verifyTwilioSignature } from "@/lib/revenue-os/twilio-adapter";

export const runtime = "nodejs";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = (status = 200) =>
  new NextResponse(EMPTY_TWIML, { status, headers: { "Content-Type": "text/xml" } });

/**
 * The URLs Twilio may have signed: the request as received, and the same path
 * on the public origin a proxy forwarded. Twilio signs the exact webhook URL.
 */
function signedUrlCandidates(request: NextRequest) {
  const received = new URL(request.url);
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  const urls = new Set([received.toString()]);
  if (host && proto) urls.add(`${proto}://${host}${received.pathname}${received.search}`);
  return [...urls];
}

/** POST: an inbound text to the workspace's Twilio number, signed with its auth token. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "twilio");
  if (!provider?.apiKey)
    return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });
  let body: string;
  try {
    body = await readBoundedText(request, 65536);
  } catch (error) {
    console.warn(
      "[twilio-webhook] rejected request body:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Webhook payload exceeds its size limit" }, { status: 413 });
  }
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = request.headers.get("x-twilio-signature");
  const signed = signedUrlCandidates(request).some((url) =>
    verifyTwilioSignature(provider.apiKey!, url, params, signature),
  );
  if (!signed) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // Delivery status callbacks carry no Body; only inbound texts become messages.
  if (typeof params.Body !== "string" || !params.MessageSid) return twiml();
  return runWithTenantRequestContext(provider.context, async () => {
    const db = createServiceRoleClient(provider.context);
    try {
      await ingestInboundSms(db, {
        messageSid: params.MessageSid!,
        from: params.From ?? "",
        to: params.To ?? "",
        body: params.Body!.slice(0, 1600),
        receivedAt: new Date().toISOString(),
      });
      return twiml();
    } catch (error) {
      console.error(
        "[twilio-webhook] inbound text not recorded:",
        error instanceof Error ? error.message : "unknown error",
      );
      return twiml(500);
    }
  });
}
