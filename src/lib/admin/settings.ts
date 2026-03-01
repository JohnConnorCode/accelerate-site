import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Get a setting value: checks admin_settings DB table first, falls back to process.env
 */
export async function getSetting(key: string): Promise<string> {
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

  return process.env[key] || "";
}

/**
 * Mask a secret value for display: show first 3 and last 3 chars
 */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) return value ? "****" : "";
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}
