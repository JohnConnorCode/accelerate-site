import "server-only";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { decryptSecret, isEncryptedSecret } from "@/lib/revenue-os/encryption";
import { ACCELERATE_TENANT_ID, type TenantSystemContext } from "@/lib/tenancy/context";

export async function resolveTenantProviderSecrets(
  tenantSlug: string,
  provider: "resend" | "calendly" | "whatsapp" | "hubspot" | "mcp",
) {
  const platform = createPlatformServiceRoleClient(`provider-resolver:${provider}`);
  const { data: tenant } = await platform
    .from("tenants")
    .select("id,slug,status")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (!tenant || tenant.status !== "active") return null;
  const { data: connection } = await platform
    .from("integration_connections")
    .select("status,encrypted_credentials,environment_fallback_allowed")
    .eq("tenant_id", tenant.id)
    .eq("provider", provider)
    .maybeSingle();
  const encrypted =
    connection?.encrypted_credentials && typeof connection.encrypted_credentials === "object"
      ? (connection.encrypted_credentials as Record<string, unknown>)
      : {};
  const read = (key: string) => {
    const value = encrypted[key];
    if (typeof value !== "string" || !value) return null;
    if (!isEncryptedSecret(value))
      throw new Error(`${provider} ${key} is not in the encrypted envelope`);
    return decryptSecret(value);
  };
  const allowEnvironment =
    tenant.id === ACCELERATE_TENANT_ID && (!connection || connection.environment_fallback_allowed);
  const context: TenantSystemContext = {
    kind: "system",
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    source: `${provider}-webhook`,
  };
  return {
    context,
    apiKey: connection?.status === "connected" ? read("api_key") : null,
    webhookSecret: connection?.status === "connected" ? read("webhook_secret") : null,
    allowEnvironment,
  };
}
