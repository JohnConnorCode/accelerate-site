import { createServiceRoleClient } from "@/lib/supabase/server";

export const SERVER_ONLY_SECRET_KEYS = new Set([
  "OPENROUTER_API_KEY",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PLAUSIBLE_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "CALENDLY_PERSONAL_ACCESS_TOKEN",
  "CALENDLY_WEBHOOK_SECRET",
]);

/** Secret configuration is environment-only. Non-secret operator preferences
 * may still live in admin_settings. Environment variables always win. */
export async function getSetting(key: string): Promise<string> {
  if (process.env[key]) return process.env[key] || "";
  if (SERVER_ONLY_SECRET_KEYS.has(key)) return "";
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (data?.value) return data.value;
  } catch {
    // Fall through to env var
  }

  return "";
}

/**
 * Mask a secret value for display: show first 3 and last 3 chars
 */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) return value ? "****" : "";
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}
