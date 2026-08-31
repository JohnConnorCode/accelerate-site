import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { handleResendWebhook } from "@/app/api/webhooks/resend/route";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";

export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "resend");
  const webhookSecret = provider?.webhookSecret || (provider?.allowEnvironment ? process.env.RESEND_WEBHOOK_SECRET : null);
  const apiKey = provider?.apiKey || (provider?.allowEnvironment ? process.env.RESEND_API_KEY : null);
  if (!provider || !webhookSecret || !apiKey) return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });
  return runWithTenantRequestContext(provider.context, () => handleResendWebhook(request, {
    webhookSecret,
    resend: new Resend(apiKey),
    tenantContext: provider.context,
  }));
}

