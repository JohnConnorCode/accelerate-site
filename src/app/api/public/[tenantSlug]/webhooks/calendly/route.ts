import { NextRequest, NextResponse } from "next/server";
import { handleCalendlyWebhook } from "@/app/api/webhooks/calendly/route";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";

export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  const provider = await resolveTenantProviderSecrets(tenantSlug, "calendly");
  const webhookSecret = provider?.webhookSecret || (provider?.allowEnvironment ? process.env.CALENDLY_WEBHOOK_SECRET : null);
  if (!provider || !webhookSecret) return NextResponse.json({ error: "Tenant webhook unavailable" }, { status: 404 });
  return runWithTenantRequestContext(provider.context, () => handleCalendlyWebhook(request, {
    webhookSecret,
    tenantContext: provider.context,
  }));
}

