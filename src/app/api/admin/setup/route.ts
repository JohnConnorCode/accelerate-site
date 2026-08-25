import { supabaseDashboard } from "@/config/tenant";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { STALLED_JOB_MINUTES } from "@/lib/revenue-os/health";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SetupCapability } from "@/lib/revenue-os/types";
import { GOOGLE_SCOPES } from "@/lib/revenue-os/google";
import { isGoogleTokenEncryptionKeyConfigured } from "@/lib/revenue-os/encryption";
import {
  REVENUE_SCHEMA_CONTRACT_VERSION,
  type SchemaVerificationRun,
  computeSchemaCenterStatus,
  verifyRevenueSchemaDataAccess,
} from "@/lib/revenue-os/schema-contract";

interface SourceRunRow { source_key: string; status: string; summary: unknown; error: string | null; finished_at: string | null }
interface JobRunRow { job_key: string; status: string; summary: unknown; error: string | null; finished_at: string | null; claimed_at: string }
interface SchedulerStatus { configured: boolean; active: boolean; schedule: string; last_run_status: string | null; last_run_at: string | null }

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  // Keep Setup Center truthful with the public qualified-lead flow: Calendly is
  // active by default and only turns off during an explicit emergency pause.
  const calendlyEnabled = process.env.CALENDLY_ENABLED !== "false";
  const supabaseConfigured = configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const googleConfigured = configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") && isGoogleTokenEncryptionKeyConfigured();

  const runtimeSchema = supabaseConfigured
    ? await verifyRevenueSchemaDataAccess(supabase)
    : { status: "connectivity_failure" as const, issues: [], checkedAt: new Date().toISOString() };
  const [featureBoardResult, googleResult, sourceRunsResult, jobRunsResult, proposalResult, analyticsResult, emailStudioResult, contactImporterResult, schemaVerificationResult, schedulerResult] = supabaseConfigured
    ? await Promise.all([
        supabase.from("feature_requests").select("id", { count: "exact" }).eq("source", "revenue-os-master-plan").is("archived_at", null).limit(1),
        supabase.from("integration_connections").select("account_email,status,scopes,last_success_at,last_error,settings").eq("provider", "google").maybeSingle(),
        supabase.from("source_runs").select("source_key,status,summary,error,finished_at").order("started_at", { ascending: false }).limit(40),
        supabase.from("job_runs").select("job_key,status,summary,error,finished_at,claimed_at").order("claimed_at", { ascending: false }).limit(40),
        supabase.from("proposals").select("id").limit(1),
        supabase.from("website_events").select("id").limit(1),
        supabase.from("email_template_versions").select("id", { count: "exact" }).limit(1),
        supabase.from("contact_import_batches").select("id,status,review_digest,approval_digest,ai_provider", { count: "exact" }).limit(1),
        supabase.from("schema_verification_runs").select("contract_version,status,failure_detail,checked_at").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc("command_center_scheduler_status"),
      ])
    : [
        { error: new Error("Supabase is not configured"), count: null },
        { error: new Error("Supabase is not configured"), count: null },
        { error: new Error("Supabase is not configured"), count: null },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { error: new Error("Supabase is not configured"), count: null },
        { error: new Error("Supabase is not configured"), count: null },
        { error: new Error("Supabase is not configured"), data: null },
        { error: new Error("Supabase is not configured"), data: null },
      ];

  const latestSchemaVerification = schemaVerificationResult.data as SchemaVerificationRun | null;
  const schemaCenter = computeSchemaCenterStatus({
    runtimeStatus: runtimeSchema.status,
    latestVerification: latestSchemaVerification
      ? latestSchemaVerification.contract_version === REVENUE_SCHEMA_CONTRACT_VERSION && latestSchemaVerification.status === "success"
        ? latestSchemaVerification
        : null
      : null,
  });
  const schemaReady = schemaCenter.ready;
  const firstPartyAnalyticsReady = !analyticsResult.error;
  const emailStudioReady = !emailStudioResult.error;
  const contactImporterReady = !contactImporterResult.error;
  // Presence, not an exact count. A hardcoded expected total drifts every time
  // the manifest changes, and detecting drift is what
  // `npm run seed:features -- --verify` is for.
  const featureBoardReady = !featureBoardResult.error && (featureBoardResult.count ?? 0) > 0;
  const google = googleResult.data;
  const scopes: string[] = google?.scopes ?? [];
  const requiredGoogleScopes = GOOGLE_SCOPES.filter((scope) => !["openid", "email"].includes(scope));
  const googleScopesReady = requiredGoogleScopes.every((scope) => scopes.includes(scope));
  const googleConnected = google?.status === "connected" && Boolean(google.account_email) && googleScopesReady;
  const latestSource = new Map<string, SourceRunRow>();
  for (const run of sourceRunsResult.data ?? []) if (!latestSource.has(run.source_key)) latestSource.set(run.source_key, run);
  const latestJob = new Map<string, JobRunRow>();
  for (const run of jobRunsResult.data ?? []) if (!latestJob.has(run.job_key)) latestJob.set(run.job_key, run);
  const scheduler = schedulerResult.data as SchedulerStatus | null;
  const healthSnapshotRun = latestJob.get("system-health-snapshot");
  const healthSnapshotFresh = healthSnapshotRun?.status === "success"
    && Boolean(healthSnapshotRun.finished_at)
    && Date.now() - Date.parse(healthSnapshotRun.finished_at as string) <= 30 * 60_000;

  // Same rule the claim function and the health service use: a run claimed
  // longer ago than the recovery window and never closed means the process died.
  const stalledJobs = [...latestJob.values()]
    .filter((run) => run.status === "running" && (!run.claimed_at || Date.now() - Date.parse(run.claimed_at) > STALLED_JOB_MINUTES * 60_000))
    .map((run) => ({ key: run.job_key }));

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
      action: { label: "Open Supabase API settings", href: supabaseDashboard("/settings/api"), external: true },
    },
    {
      id: "schema",
      group: "core",
      label: "Revenue OS schema",
      description: schemaReady
        ? `Contract ${REVENUE_SCHEMA_CONTRACT_VERSION} is live and metadata-verified across tables, columns, constraints, indexes, functions, and access policies.`
        : runtimeSchema.status === "connectivity_failure"
          ? "The runtime database connection could not be verified. Check Supabase credentials and retry."
          : runtimeSchema.status === "unapplied_migration"
            ? "A required migration is not applied. Run the ordered agent-owned migration command, then record a fresh schema verification."
            : latestSchemaVerification?.status === "drift"
              ? "The last metadata verification found incompatible database drift. Review its receipt before shipping."
              : "The runtime schema is reachable but has no current full metadata-verification receipt. Run the read-only verifier and record it.",
      accomplishes: "Replaces split lead and booking silos with one auditable revenue model.",
      status: schemaCenter.status,
      required: true,
      keys: ["migrations/20260816-revenue-os.sql", "migrations/20260817-schema-verification.sql", "npm run db:verify-schema -- --record"],
      lastSuccessAt: latestSchemaVerification?.status === "success" ? latestSchemaVerification.checked_at : null,
      lastFailure: schemaCenter.ready ? null : (latestSchemaVerification?.failure_detail ?? runtimeSchema.issues[0]?.message ?? schemaCenter.reason),
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
      description: featureBoardReady ? `${featureBoardResult.count} agent-ready Revenue OS work items are loaded and ordered.` : !featureBoardResult.error ? "No managed work items are loaded. Run npm run seed:features -- --apply." : "Apply migrations/20260816-feature-board.sql, then seed the managed backlog.",
      accomplishes: "Turns upcoming work into one owned, labeled, prioritized delivery queue instead of scattered notes.",
      status: featureBoardReady ? "ready" : "action",
      required: false,
      keys: ["migrations/20260816-feature-board.sql", "npm run seed:features -- --apply"],
      action: { label: featureBoardReady ? "Open Feature Board" : featureBoardResult.error ? "Open Supabase SQL editor" : "Review backlog instructions", href: featureBoardReady ? "/admin/features" : featureBoardResult.error ? supabaseDashboard("/sql/new") : "/admin/setup#feature_board", external: Boolean(featureBoardResult.error) },
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
      id: "resend_webhooks",
      group: "email",
      label: "Resend delivery feedback",
      description: configured("RESEND_WEBHOOK_SECRET") ? "Signed Resend delivery, bounce, complaint, and engagement receipts can update the canonical message and suppression ledger." : "Add a signed Resend webhook for /api/webhooks/resend, then save its secret as RESEND_WEBHOOK_SECRET.",
      accomplishes: "Turns real delivery failures and spam complaints into immediate campaign suppression instead of assuming every API acceptance reached an inbox.",
      status: configured("RESEND_WEBHOOK_SECRET") ? "ready" : "action",
      required: false,
      keys: ["RESEND_WEBHOOK_SECRET", "/api/webhooks/resend"],
      action: { label: "Open Resend webhooks", href: "https://resend.com/webhooks", external: true },
    },
    {
      id: "email_studio",
      group: "email",
      label: "Email Studio publishing",
      description: emailStudioReady ? `${emailStudioResult.count ?? 0} editable email revision${emailStudioResult.count === 1 ? " is" : "s are"} stored. Built-in copy remains the fallback.` : "Apply the Email Studio migration to edit, test, and publish the copy used by real sends.",
      accomplishes: "Provides safe draft/live email editing, rendered previews, founder-only test sends, and an auditable revision history without another provider key.",
      status: emailStudioReady ? "ready" : "action",
      required: false,
      keys: ["migrations/20260816-email-studio.sql"],
      action: { label: emailStudioReady ? "Open Email Studio" : "Open Supabase SQL editor", href: emailStudioReady ? "/admin/emails" : supabaseDashboard("/sql/new"), external: !emailStudioReady },
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
      label: "OpenRouter intelligence gateway",
      description: configured("OPENROUTER_API_KEY") ? `All AI workflows use OpenRouter${process.env.OPENROUTER_MODEL ? ` with ${process.env.OPENROUTER_MODEL}` : " with the documented default model"}.` : "Add one OpenRouter API key to activate every AI workflow.",
      accomplishes: "Runs contact cleanup, Revenue Copilot, website chat, plan generation, insights, briefs, and drafts through one governed provider gateway.",
      status: configured("OPENROUTER_API_KEY") ? "ready" : "action",
      required: false,
      keys: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL (optional)"],
      action: { label: configured("OPENROUTER_API_KEY") ? "Open AI Operations" : "Create OpenRouter key", href: configured("OPENROUTER_API_KEY") ? "/admin/ai-operations" : "https://openrouter.ai/settings/keys", external: !configured("OPENROUTER_API_KEY") },
    },
    {
      id: "contact_importer",
      group: "ai",
      label: "Approval-gated Contact Import",
      description: !contactImporterReady ? "Apply the Contact Import migration." : configured("OPENROUTER_API_KEY") ? `${contactImporterResult.count ?? 0} import batch${contactImporterResult.count === 1 ? " is" : "es are"} stored with review and execution receipts.` : "The import ledger is ready; OpenRouter is still needed for cleanup and mapping.",
      accomplishes: "Cleans pasted lists, CSV, TSV, JSON, and notes into reviewed canonical contacts without sending messages or creating opportunities.",
      status: !contactImporterReady ? "action" : configured("OPENROUTER_API_KEY") ? "ready" : "degraded",
      required: false,
      keys: ["migrations/20260816-contact-importer.sql", "OPENROUTER_API_KEY"],
      action: { label: contactImporterReady ? "Open Contact Import" : "Open Supabase SQL editor", href: contactImporterReady ? "/admin/contact-imports" : supabaseDashboard("/sql/new"), external: !contactImporterReady },
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
      id: "first_party_analytics",
      group: "analytics",
      label: "First-party website analytics",
      description: firstPartyAnalyticsReady ? "Page views and conversion events are captured by this site and reported beside canonical revenue—no analytics vendor account or API key required." : "Apply migrations/20260816-first-party-analytics.sql to enable turn-key website measurement.",
      accomplishes: "Measures the path from page visit and conversion signal through qualified opportunity and revenue without a third-party analytics dependency.",
      status: firstPartyAnalyticsReady ? "ready" : "action",
      required: true,
      keys: ["migrations/20260816-first-party-analytics.sql"],
      action: firstPartyAnalyticsReady ? { label: "Open Analytics", href: "/admin/analytics" } : { label: "Open Supabase SQL editor", href: supabaseDashboard("/sql/new"), external: true },
    },
    {
      id: "manual_booking",
      group: "booking",
      label: calendlyEnabled ? "Public Calendly booking" : "Manual scheduling mode",
      description: calendlyEnabled ? "The public contact page embeds the configured free Calendly event for self-booking. API attribution is tracked separately." : "Calendly is off. The founder reviews opportunities and schedules through direct email or Google Calendar.",
      accomplishes: "Keeps calendar activation optional without blocking the revenue workflow.",
      status: "ready",
      required: false,
      keys: ["CALENDLY_ENABLED"],
    },
    {
      id: "calendly",
      group: "booking",
      label: "Calendly attribution",
      description: calendlyEnabled ? "Public booking is active; Calendly API/webhook credentials are optional and required only for automatic booking and cancellation attribution." : "Optional and intentionally disabled until self-booking is activated.",
      accomplishes: "Adds self-booking and cancellation attribution through the canonical opportunity service.",
      status: calendlyEnabled ? configured("CALENDLY_PERSONAL_ACCESS_TOKEN", "CALENDLY_WEBHOOK_SECRET") ? "ready" : "action" : "disabled",
      required: false,
      keys: ["CALENDLY_PERSONAL_ACCESS_TOKEN", "CALENDLY_WEBHOOK_SECRET"],
    },
    {
      id: "continuous_scheduler",
      group: "operations",
      label: "Continuous scheduler",
      description: schedulerResult.error
        ? "Apply the Command Center scheduler migration before enabling sub-daily operations."
        : !scheduler?.configured
          ? "The 15-minute Supabase Cron wake-up is installed but its encrypted production endpoint is not configured."
          : healthSnapshotFresh
            ? "Supabase Cron is waking the authenticated health adapter every 15 minutes and the latest Revenue OS receipt is fresh."
            : "The scheduler is configured, but no fresh successful application receipt proves the wake-up completed.",
      accomplishes: "Removes the daily-only ceiling for proactive intelligence without moving business rules out of Revenue OS services.",
      status: schedulerResult.error || !scheduler?.configured
        ? "action"
        : !scheduler.active || scheduler.last_run_status === "failed" || !healthSnapshotFresh
          ? "degraded"
          : "ready",
      required: false,
      keys: ["migrations/20260823-command-center-scheduler.sql", "npm run scheduler:configure", "/api/cron/system-health-snapshot"],
      lastSuccessAt: healthSnapshotFresh ? healthSnapshotRun?.finished_at ?? null : null,
      lastFailure: scheduler?.last_run_status === "failed"
        ? "The latest Supabase Cron wake-up failed. Review Cron history and the system-health job receipt."
        : healthSnapshotRun?.status === "failed" ? healthSnapshotRun.error : null,
      action: { label: "Review integration health", href: "/admin/integrations" },
    },
    {
      id: "operations",
      group: "operations",
      label: "Scheduled operations and receipts",
      description: configured("CRON_SECRET") ? "Cron endpoints are protected and record terminal job receipts." : "Set a long random CRON_SECRET before scheduling jobs.",
      accomplishes: "Makes automation health, failures, retries, and last successful work visible instead of silently returning 200.",
      // A job stuck `running` is the state a crashed process leaves behind. It
      // must not read as ready just because nothing said "failed".
      status: !configured("CRON_SECRET") ? "action" : stalledJobs.length ? "degraded" : "ready",
      required: true,
      keys: ["CRON_SECRET"],
      lastSuccessAt: [...latestJob.values()].find((run) => run.status === "success")?.finished_at ?? null,
      lastFailure: stalledJobs.length
        ? `${stalledJobs.map((run) => run.key).join(", ")} claimed a run and never reported a result. The next run takes the claim over.`
        : [...latestJob.values()].find((run) => run.status === "failed")?.error ?? null,
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
