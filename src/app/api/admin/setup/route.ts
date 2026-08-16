import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type SetupStatus = "ready" | "action" | "optional" | "disabled";

export interface SetupCheck {
  id: string;
  label: string;
  detail: string;
  status: SetupStatus;
  required: boolean;
  keys?: string[];
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const has = (...keys: string[]) => keys.every((key) => Boolean(process.env[key]?.trim()));
  const calendlyEnabled = process.env.CALENDLY_ENABLED === "true";
  const supabaseConfigured = has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  let schemaReady = false;
  let schemaDetail = "Run the roofing booking-machine migration in Supabase.";

  if (supabaseConfigured) {
    try {
      const { error } = await createServiceRoleClient().from("opportunities").select("id", { head: true, count: "exact" }).limit(1);
      schemaReady = !error;
      if (error) schemaDetail = "Supabase is connected, but the opportunities schema is not available yet.";
    } catch {
      schemaDetail = "Supabase credentials exist, but the schema check could not connect.";
    }
  }

  const checks: SetupCheck[] = [
    {
      id: "supabase",
      label: "Supabase connection",
      detail: supabaseConfigured ? "Runtime database credentials are present." : "The funnel needs its Supabase URL, anon key, and server-only service key.",
      status: supabaseConfigured ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    },
    {
      id: "schema",
      label: "Opportunity schema",
      detail: schemaReady ? "Opportunity, stage-history, and webhook-receipt tables are available." : schemaDetail,
      status: schemaReady ? "ready" : "action",
      required: true,
      keys: ["migrations/roofing-booking-machine.sql"],
    },
    {
      id: "email",
      label: "Confirmation and nurture email",
      detail: has("RESEND_API_KEY", "RESEND_FROM_EMAIL") ? "Resend can deliver audit confirmations and follow-up." : "Add the Resend API key and verified sender to deliver confirmations.",
      status: has("RESEND_API_KEY", "RESEND_FROM_EMAIL") ? "ready" : "action",
      required: true,
      keys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    },
    {
      id: "admin_email",
      label: "Owner notification inbox",
      detail: has("ADMIN_EMAIL") ? "New qualified requests have an owner destination." : "Set the inbox that should receive and own new opportunities.",
      status: has("ADMIN_EMAIL") ? "ready" : "action",
      required: true,
      keys: ["ADMIN_EMAIL"],
    },
    {
      id: "site_url",
      label: "Production site URL",
      detail: has("NEXT_PUBLIC_SITE_URL") ? "Absolute links in confirmations and resumes have a canonical origin." : "Set the canonical production site URL.",
      status: has("NEXT_PUBLIC_SITE_URL") ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_SITE_URL"],
    },
    {
      id: "plausible",
      label: "First-party analytics",
      detail: has("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY") ? "Campaign events and the admin analytics report are connected to Plausible." : "Add the Plausible domain and API key to measure the funnel in the admin.",
      status: has("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY") ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY"],
    },
    {
      id: "manual_mode",
      label: calendlyEnabled ? "Calendar booking mode" : "Manual review mode",
      detail: calendlyEnabled
        ? "Qualified prospects are sent directly to the embedded calendar."
        : "Qualified prospects receive confirmation; John reviews and replies personally. Calendly is not required.",
      status: "ready",
      required: false,
      keys: ["CALENDLY_ENABLED"],
    },
    {
      id: "calendly",
      label: "Calendly booking attribution",
      detail: calendlyEnabled
        ? has("CALENDLY_WEBHOOK_SECRET", "CALENDLY_PERSONAL_ACCESS_TOKEN")
          ? "Calendar credentials and webhook protection are configured."
          : "Calendar mode is on, but its webhook secret or API token is missing."
        : "Optional. Enable later when you want qualified prospects to self-book.",
      status: calendlyEnabled
        ? has("CALENDLY_WEBHOOK_SECRET", "CALENDLY_PERSONAL_ACCESS_TOKEN") ? "ready" : "action"
        : "disabled",
      required: false,
      keys: ["CALENDLY_ENABLED", "CALENDLY_WEBHOOK_SECRET", "CALENDLY_PERSONAL_ACCESS_TOKEN"],
    },
    {
      id: "google_analytics",
      label: "Google Analytics 4",
      detail: has("NEXT_PUBLIC_GTAG_ID") ? "GA4 conversion events are enabled." : "Optional secondary analytics and ad-platform attribution.",
      status: has("NEXT_PUBLIC_GTAG_ID") ? "ready" : "optional",
      required: false,
      keys: ["NEXT_PUBLIC_GTAG_ID"],
    },
    {
      id: "meta_pixel",
      label: "Meta Pixel",
      detail: has("NEXT_PUBLIC_META_PIXEL_ID") ? "Meta conversion events are enabled." : "Optional. Add only before running Meta campaigns.",
      status: has("NEXT_PUBLIC_META_PIXEL_ID") ? "ready" : "optional",
      required: false,
      keys: ["NEXT_PUBLIC_META_PIXEL_ID"],
    },
  ];

  const required = checks.filter((check) => check.required);
  const optional = checks.filter((check) => !check.required && check.id !== "manual_mode");
  const requiredReady = required.filter((check) => check.status === "ready").length;
  const optionalReady = optional.filter((check) => check.status === "ready").length;

  return NextResponse.json({
    checks,
    bookingMode: calendlyEnabled ? "calendly" : "manual",
    summary: {
      requiredReady,
      requiredTotal: required.length,
      optionalReady,
      optionalTotal: optional.length,
      launchReady: requiredReady === required.length,
      percent: Math.round((requiredReady / required.length) * 100),
    },
  });
}
