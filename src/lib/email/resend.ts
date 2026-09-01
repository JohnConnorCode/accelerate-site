import { Resend } from "resend";
import { adminEmail, fromEmail } from "@/config/tenant";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, isEncryptedSecret } from "@/lib/revenue-os/encryption";
import { ACCELERATE_TENANT_ID, getTenantRequestContext } from "@/lib/tenancy/context";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { assertActiveTenantExecution } from "@/lib/tenancy/system";

let _resend: Resend | null = null;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

export async function getTenantResend(supabase: SupabaseClient): Promise<Resend> {
  await assertActiveTenantExecution(supabase, "resend");
  const context = getTenantRequestContext();
  const tenantId =
    tenantIdForDatabase(supabase) ||
    (context?.kind === "actor" ? context.tenant.id : context?.tenantId);
  if (!tenantId) throw new Error("Tenant context is required for provider access");
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("encrypted_credentials,environment_fallback_allowed,status")
    .eq("provider", "resend")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const credentials =
    connection?.encrypted_credentials && typeof connection.encrypted_credentials === "object"
      ? (connection.encrypted_credentials as Record<string, unknown>)
      : {};
  const encryptedApiKey = typeof credentials.api_key === "string" ? credentials.api_key : "";
  if (encryptedApiKey && connection?.status === "connected") {
    if (!isEncryptedSecret(encryptedApiKey))
      throw new Error("Resend credential is not in the encrypted envelope");
    return new Resend(decryptSecret(encryptedApiKey));
  }
  if (encryptedApiKey) throw new Error("Resend is not active for this tenant");
  const mayUseEnvironment =
    tenantId === ACCELERATE_TENANT_ID && (!connection || connection.environment_fallback_allowed);
  if (mayUseEnvironment && process.env.RESEND_API_KEY) return getResend();
  throw new Error("Resend is not configured for this tenant");
}

/** Resolves the non-secret, Resend-verified sender identity for this workspace.
 * Client workspaces never inherit the bootstrap environment sender. */
export async function getTenantFromEmail(supabase: SupabaseClient): Promise<string> {
  const context = getTenantRequestContext();
  const tenantId =
    tenantIdForDatabase(supabase) ||
    (context?.kind === "actor" ? context.tenant.id : context?.tenantId);
  if (!tenantId) throw new Error("Tenant context is required for sender identity");
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("account_email,status,environment_fallback_allowed")
    .eq("provider", "resend")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const configured =
    typeof connection?.account_email === "string"
      ? connection.account_email.trim().toLowerCase()
      : "";
  if (connection?.status === "connected") {
    if (!configured) throw new Error("Resend sender email is required for this tenant");
    return configured;
  }
  const mayUseEnvironment =
    tenantId === ACCELERATE_TENANT_ID && (!connection || connection.environment_fallback_allowed);
  if (mayUseEnvironment && process.env.RESEND_API_KEY) return FROM_EMAIL;
  throw new Error("Resend sender email is not configured for this tenant");
}

/**
 * The delivery identity and the inbox that handles replies are deliberately
 * separate. A Resend-verified domain can send mail without being a mailbox, so
 * using the `From` address as `Reply-To` would make an otherwise healthy
 * recovery campaign unable to convert a prospect response.
 */
export async function getTenantReplyToEmail(supabase: SupabaseClient): Promise<string> {
  const context = getTenantRequestContext();
  const tenantId =
    tenantIdForDatabase(supabase) ||
    (context?.kind === "actor" ? context.tenant.id : context?.tenantId);
  if (!tenantId) throw new Error("Tenant context is required for reply routing");
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("account_email,settings,status,environment_fallback_allowed")
    .eq("provider", "resend")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings =
    connection?.settings && typeof connection.settings === "object"
      ? (connection.settings as Record<string, unknown>)
      : {};
  const configured =
    typeof settings.reply_to_email === "string" ? settings.reply_to_email.trim().toLowerCase() : "";
  if (connection?.status === "connected") {
    if (EMAIL_PATTERN.test(configured)) return configured;
    // Existing connected workspaces predate the distinct reply inbox setting.
    // Preserve their established delivery behavior until the next credential
    // rotation, while every new configuration requires an explicit inbox.
    const legacySender =
      typeof connection.account_email === "string"
        ? connection.account_email.trim().toLowerCase()
        : "";
    if (EMAIL_PATTERN.test(legacySender)) return legacySender;
    throw new Error("A monitored reply-to inbox is required for this tenant");
  }
  const mayUseEnvironment =
    tenantId === ACCELERATE_TENANT_ID && (!connection || connection.environment_fallback_allowed);
  if (mayUseEnvironment && process.env.RESEND_API_KEY) return ADMIN_EMAIL || FROM_EMAIL;
  throw new Error("Resend reply-to inbox is not configured for this tenant");
}

export const FROM_EMAIL = fromEmail();
export const ADMIN_EMAIL = adminEmail();
