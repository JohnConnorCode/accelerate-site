import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SetupCapability } from "@/lib/revenue-os/types";
import { GOOGLE_SCOPES } from "@/lib/revenue-os/google";

interface SourceRunRow { source_key: string; status: string; summary: unknown; error: string | null; finished_at: string | null }
interface JobRunRow { job_key: string; status: string; summary: unknown; error: string | null; finished_at: string | null; claimed_at: string }

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  const calendlyEnabled = process.env.CALENDLY_ENABLED === "true";
  const supabaseConfigured = configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const googleConfigured = configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") && Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [schemaResult, featureBoardResult, googleResult, sourceRunsResult, jobRunsResult, proposalResult] = supabaseConfigured
    ? await Promise.all([
        supabase.from("action_queue").select("id", { count: "exact", head: true }).limit(1),
        supabase.from("feature_requests").select("id", { count: "exact", head: true }).limit(1),
        supabase.from("integration_connections").select("account_email,status,scopes,last_success_at,last_error,settings").eq("provider", "google").maybeSingle(),
        supabase.from("source_runs").select("source_key,status,summary,error,finished_at").order("started_at", { ascending: false }).limit(40),
        supabase.from("job_runs").select("job_key,status,summary,error,finished_at,claimed_at").order("claimed_at", { ascending: false }).limit(40),
        supabase.from("proposals").select("id", { count: "exact", head: true }).limit(1),
      ])
    : [
        { error: new Error("Supabase is not configured"), count: null },
        { error: new Error("Supabase is not configured"), count: null },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { error: new Error("Supabase is not configured"), count: null },
      ];

  const schemaReady = !schemaResult.error;
  const google = googleResult.data;
  const scopes: string[] = google?.scopes ?? [];
  const requiredGoogleScopes = GOOGLE_SCOPES.filter((scope) => !["openid", "email"].includes(scope));
  const googleScopesReady = requiredGoogleScopes.every((scope) => scopes.includes(scope));
  const googleConnected = google?.status === "connected" && Boolean(google.account_email) && googleScopesReady;
  const latestSource = new Map<string, SourceRunRow>();
  for (const run of sourceRunsResult.data ?? []) if (!latestSource.has(run.source_key)) latestSource.set(run.source_key, run);
  const latestJob = new Map<string, JobRunRow>();
  for (const run of jobRunsResult.data ?? []) if (!latestJob.has(run.job_key)) latestJob.set(run.job_key, run);

  const checks: SetupCapability[] = [
    {
      id: "supabase",
      group: "core",
      label: "Supabase connection",
      description: supabaseConfigured ? "Runtime database credentials are present." : "Add the project URL, anonymous key, and server-only service key.",
      accomplishes: "Stores the pipeline, conversations, campaign state, tasks, proposals, and audit history.",
      status: supabaseConfigured ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      action: { label: "Open Supabase API settings", href: "https://supabase.com/dashboard/project/skjypuwkceoiunyhhqlm/settings/api", external: true },
    },
    {
      id: "schema",
      group: "core",
      label: "Revenue OS schema",
      description: schemaReady ? "Canonical pipeline and operating ledgers are available." : "Apply migrations/20260816-revenue-os.sql after the existing migrations.",
      accomplishes: "Replaces split lead and booking silos with one auditable revenue model.",
      status: schemaReady ? "ready" : "action",
      required: true,
      keys: ["migrations/20260816-revenue-os.sql"],
      action: { label: "Open Supabase SQL editor", href: "https://supabase.com/dashboard/project/skjypuwkceoiunyhhqlm/sql/new", external: true },
    },
    {
      id: "founder_access",
      group: "core",
      label: "Founder-only access",
      description: configured("ADMIN_EMAIL") ? `Admin access is restricted to ${process.env.ADMIN_EMAIL}.` : "Set the one email allowed to use the admin.",
      accomplishes: "Prevents any other authenticated Supabase account from entering or calling admin APIs.",
      status: configured("ADMIN_EMAIL") ? "ready" : "action",
      required: true,
      keys: ["ADMIN_EMAIL"],
    },
    {
      id: "feature_board",
      group: "operations",
      label: "Feature Board roadmap",
      description: !featureBoardResult.error ? "The prioritized internal roadmap is available and keeps drag order durably." : "Apply migrations/20260816-feature-board.sql after the Revenue OS migration.",
      accomplishes: "Turns upcoming work into one owned, labeled, prioritized delivery queue instead of scattered notes.",
      status: !featureBoardResult.error ? "ready" : "action",
      required: false,
      keys: ["migrations/20260816-feature-board.sql"],
      action: { label: !featureBoardResult.error ? "Open Feature Board" : "Open Supabase SQL editor", href: !featureBoardResult.error ? "/admin/features" : "https://supabase.com/dashboard/project/skjypuwkceoiunyhhqlm/sql/new", external: Boolean(featureBoardResult.error) },
    },
    {
      id: "site_url",
      group: "core",
      label: "Canonical site URL",
      description: configured("NEXT_PUBLIC_SITE_URL") ? "Public links and OAuth callbacks use a stable production origin." : "Set NEXT_PUBLIC_SITE_URL to the production www URL.",
      accomplishes: "Keeps proposal links, OAuth callbacks, and email links on the correct deployment.",
      status: configured("NEXT_PUBLIC_SITE_URL") ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_SITE_URL"],
    },
    {
      id: "email",
      group: "email",
      label: "Resend delivery",
      description: configured("RESEND_API_KEY", "RESEND_FROM_EMAIL") ? "A server-only API key and verified sender are configured." : "Add the Resend API key and verified sender.",
      accomplishes: "Sends approved campaigns, confirmations, proposals, and transactional messages with receipts.",
      status: configured("RESEND_API_KEY", "RESEND_FROM_EMAIL") ? "ready" : "action",
      required: true,
      keys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      action: { label: "Open Resend domains", href: "https://resend.com/domains", external: true },
    },
    {
      id: "google_oauth",
      group: "google",
      label: "Google OAuth application",
      description: googleConfigured ? "OAuth credentials and server-side token encryption are configured." : "Add OAuth credentials and an encryption key before connecting Workspace.",
      accomplishes: "Creates one protected connection for Gmail, Calendar, and selected Drive folders.",
      status: googleConfigured ? "ready" : "action",
      required: false,
      keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TOKEN_ENCRYPTION_KEY"],
      action: { label: "Open Google Cloud credentials", href: "https://console.cloud.google.com/apis/credentials", external: true },
    },
    {
      id: "google_connection",
      group: "google",
      label: "Google Workspace account",
      description: googleConnected ? `${google.account_email} is connected with all required scopes.` : google?.last_error ? `Connection needs attention: ${google.last_error}` : "Connect the founder's Workspace account after OAuth is configured.",
      accomplishes: "Synchronizes real conversations and meetings and makes selected Drive documents available to operations.",
      status: !googleConfigured ? "disabled" : googleConnected ? "ready" : google?.status === "degraded" || google?.status === "revoked" ? "degraded" : "action",
      required: false,
      keys: requiredGoogleScopes,
      lastSuccessAt: google?.last_success_at ?? null,
      lastFailure: google?.last_error ?? null,
      action: { label: googleConnected ? "Manage connection" : "Connect Google Workspace", href: googleConnected ? "/admin/setup#google" : "/api/admin/google/authorize" },
    },
    {
      id: "gmail_sync",
      group: "google",
      label: "Gmail synchronization",
      description: latestSource.get("gmail")?.status === "success" ? "Gmail threads are synchronizing into Conversations." : "Run the first Workspace sync after connecting Google.",
      accomplishes: "Keeps replies, thread history, unread work, and campaign stop conditions current.",
      status: !googleConnected ? "disabled" : latestSource.get("gmail")?.status === "success" ? "ready" : latestSource.get("gmail")?.status === "failed" ? "degraded" : "action",
      required: false,
      lastSuccessAt: latestSource.get("gmail")?.status === "success" ? latestSource.get("gmail")?.finished_at : null,
      lastFailure: latestSource.get("gmail")?.error ?? null,
    },
    {
      id: "calendar_sync",
      group: "google",
      label: "Google Calendar synchronization",
      description: latestSource.get("google_calendar")?.status === "success" ? "Upcoming and recent calendar events are available to Today and call prep." : "Calendar activates with the first Workspace sync.",
      accomplishes: "Connects meetings to the pipeline and supports meeting preparation and follow-up.",
      status: !googleConnected ? "disabled" : latestSource.get("google_calendar")?.status === "success" ? "ready" : latestSource.get("google_calendar")?.status === "failed" ? "degraded" : "action",
      required: false,
      lastSuccessAt: latestSource.get("google_calendar")?.status === "success" ? latestSource.get("google_calendar")?.finished_at : null,
      lastFailure: latestSource.get("google_calendar")?.error ?? null,
    },
    {
      id: "drive_sync",
      group: "google",
      label: "Selected Drive folders",
      description: latestSource.get("google_drive")?.status === "success" ? "Configured Drive folders are indexed." : "Optional: add specific folder IDs; unrelated Drive files remain unavailable.",
      accomplishes: "Grounds research, call notes, and proposal drafts in approved source documents.",
      status: !googleConnected ? "disabled" : latestSource.get("google_drive")?.status === "success" ? "ready" : "optional",
      required: false,
      lastSuccessAt: latestSource.get("google_drive")?.status === "success" ? latestSource.get("google_drive")?.finished_at : null,
      lastFailure: latestSource.get("google_drive")?.error ?? null,
    },
    {
      id: "ai",
      group: "ai",
      label: "Revenue copilot",
      description: configured("ANTHROPIC_API_KEY") ? "The command agent can read live records and stage approved actions." : "Add ANTHROPIC_API_KEY to enable the Revenue copilot.",
      accomplishes: "Researches, prioritizes, drafts, summarizes, and proposes actions without bypassing confirmation gates.",
      status: configured("ANTHROPIC_API_KEY") ? "ready" : "action",
      required: false,
      keys: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "campaigns",
      group: "campaigns",
      label: "Controlled campaign engine",
      description: schemaReady && configured("CRON_SECRET", "RESEND_API_KEY") ? "Campaigns can be approved once and executed just in time." : "The schema, cron secret, and Resend delivery are required.",
      accomplishes: "Automates approved follow-up while preserving pause, reply, booking, bounce, and unsubscribe stops.",
      status: schemaReady && configured("CRON_SECRET", "RESEND_API_KEY") ? "ready" : "action",
      required: true,
      keys: ["CRON_SECRET", "RESEND_API_KEY"],
      lastSuccessAt: latestJob.get("revenue-campaigns")?.status === "success" ? latestJob.get("revenue-campaigns")?.finished_at : null,
      lastFailure: latestJob.get("revenue-campaigns")?.error ?? null,
    },
    {
      id: "proposals",
      group: "proposals",
      label: "Proposal response flow",
      description: !proposalResult.error && configured("NEXT_PUBLIC_SITE_URL") ? "Public proposals can be viewed, accepted, or declined without payment." : "Apply the proposal schema and configure the public site URL.",
      accomplishes: "Turns proposal interest into an auditable pipeline outcome and founder follow-up.",
      status: !proposalResult.error && configured("NEXT_PUBLIC_SITE_URL") ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_SITE_URL"],
    },
    {
      id: "plausible",
      group: "analytics",
      label: "Plausible attribution",
      description: configured("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY") ? "Funnel events and admin reports can use Plausible." : "Add the domain and server-side Stats API key.",
      accomplishes: "Measures the path from campaign or page visit through qualified opportunity and revenue.",
      status: configured("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY") ? "ready" : "action",
      required: true,
      keys: ["NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY"],
      action: { label: "Open Plausible API keys", href: "https://plausible.io/settings/api-keys", external: true },
    },
    {
      id: "manual_booking",
      group: "booking",
      label: calendlyEnabled ? "Calendly booking mode" : "Manual scheduling mode",
      description: calendlyEnabled ? "Qualified opportunities may self-book through Calendly." : "Calendly is off. The founder reviews opportunities and schedules through direct email or Google Calendar.",
      accomplishes: "Keeps calendar activation optional without blocking the revenue workflow.",
      status: calendlyEnabled ? configured("CALENDLY_PERSONAL_ACCESS_TOKEN", "CALENDLY_WEBHOOK_SECRET") ? "ready" : "degraded" : "ready",
      required: false,
      keys: ["CALENDLY_ENABLED"],
    },
    {
      id: "calendly",
      group: "booking",
      label: "Calendly attribution",
      description: calendlyEnabled ? "Webhook credentials must remain valid." : "Optional and intentionally disabled until self-booking is activated.",
      accomplishes: "Adds self-booking and cancellation attribution through the canonical opportunity service.",
      status: calendlyEnabled ? configured("CALENDLY_PERSONAL_ACCESS_TOKEN", "CALENDLY_WEBHOOK_SECRET") ? "ready" : "action" : "disabled",
      required: false,
      keys: ["CALENDLY_PERSONAL_ACCESS_TOKEN", "CALENDLY_WEBHOOK_SECRET"],
    },
    {
      id: "operations",
      group: "operations",
      label: "Scheduled operations and receipts",
      description: configured("CRON_SECRET") ? "Cron endpoints are protected and record terminal job receipts." : "Set a long random CRON_SECRET before scheduling jobs.",
      accomplishes: "Makes automation health, failures, retries, and last successful work visible instead of silently returning 200.",
      status: configured("CRON_SECRET") ? "ready" : "action",
      required: true,
      keys: ["CRON_SECRET"],
      lastSuccessAt: [...latestJob.values()].find((run) => run.status === "success")?.finished_at ?? null,
      lastFailure: [...latestJob.values()].find((run) => run.status === "failed")?.error ?? null,
    },
  ];

  const required = checks.filter((check) => check.required);
  const optional = checks.filter((check) => !check.required);
  const requiredReady = required.filter((check) => check.status === "ready").length;
  const optionalReady = optional.filter((check) => check.status === "ready").length;
  return NextResponse.json({
    checks,
    bookingMode: calendlyEnabled ? "calendly" : "manual",
    google: google ? { accountEmail: google.account_email, connected: googleConnected, settings: google.settings ?? {}, scopes } : null,
    summary: {
      requiredReady,
      requiredTotal: required.length,
      optionalReady,
      optionalTotal: optional.length,
      launchReady: requiredReady === required.length,
      percent: required.length ? Math.round((requiredReady / required.length) * 100) : 0,
      degraded: checks.filter((check) => check.status === "degraded").length,
    },
  });
}
