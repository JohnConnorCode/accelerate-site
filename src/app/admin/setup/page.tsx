"use client";

import { supabaseDashboard, tenant } from "@/config/tenant";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Inbox,
  Loader2,
  MailCheck,
  Megaphone,
  PlugZap,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Target,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

type SetupStatus = "ready" | "action" | "degraded" | "optional" | "disabled";
type SetupGroup = "core" | "email" | "google" | "ai" | "campaigns" | "proposals" | "analytics" | "booking" | "operations";

interface SetupCheck {
  id: string;
  group: SetupGroup;
  label: string;
  description: string;
  accomplishes: string;
  status: SetupStatus;
  required: boolean;
  keys?: string[];
  lastSuccessAt?: string | null;
  lastFailure?: string | null;
  action?: { label: string; href: string; external?: boolean };
}

interface SetupResponse {
  checks: SetupCheck[];
  bookingMode: "manual" | "calendly";
  google?: { accountEmail: string; connected: boolean; settings: { drive_folder_ids?: string[] }; scopes: string[] } | null;
  summary: {
    requiredReady: number;
    requiredTotal: number;
    optionalReady: number;
    optionalTotal: number;
    launchReady: boolean;
    percent: number;
    degraded: number;
  };
}

interface SetupGuide {
  steps: string[];
  href?: string;
  linkLabel?: string;
}

const vercelEnvironmentUrl = tenant.external.vercelProjectUrl ?? "https://vercel.com/dashboard";

const setupGuides: Record<string, SetupGuide> = {
  supabase: {
    steps: [
      `Open the ${tenant.brand.name} Supabase project settings and copy the project URL and anonymous key.`,
      "Copy the service-role key separately. It is server-only and must never use the NEXT_PUBLIC_ prefix.",
      "Add all three variables to Production, Preview, and Development in Vercel, then redeploy.",
    ],
    href: supabaseDashboard("/settings/api"),
    linkLabel: "Open Supabase API settings",
  },
  schema: {
    steps: [
      "Use the agent-owned migration command in the documented order; agents run it directly and never require dashboard SQL pasting.",
      "Apply migrations/20260817-schema-verification.sql after the existing Revenue OS migrations.",
      "Run npm run db:verify-schema -- --record. It reads only database metadata and records a receipt for the exact deployed contract version.",
      "Return here and refresh. Ready means runtime access and the latest complete metadata receipt agree; it does not claim external integrations are healthy.",
    ],
    href: "/admin/setup#schema",
    linkLabel: "Review verification status",
  },
  feature_board: {
    steps: [
      "Apply migrations/20260816-revenue-os.sql first if it is not already active.",
      "Paste and run migrations/20260816-feature-board.sql in the Supabase SQL editor.",
      "Run npm run seed:features -- --apply from the project to reconcile the entire active board to the agent-ready master backlog.",
      "Open Feature Board and verify the managed count, phases, workstreams, dependencies, acceptance criteria, and handoff notes.",
    ],
    href: supabaseDashboard("/sql/new"),
    linkLabel: "Open the SQL editor",
  },
  email_studio: {
    steps: [
      "Apply migrations/20260816-email-studio.sql in the Supabase SQL editor.",
      "Open Email Studio, choose a template, save a draft, and send a test to the founder account.",
      "Review the rendered desktop and mobile preview, then publish only when the exact copy is ready for recipients.",
    ],
    href: "/admin/emails",
    linkLabel: "Open Email Studio",
  },
  email: {
    steps: [
      `Verify ${tenant.brand.domain} (or the sender domain) in Resend.`,
      "Create an API key and add RESEND_API_KEY in Vercel.",
      `Set RESEND_FROM_EMAIL to a verified sender such as ${tenant.brand.name} <hello@${tenant.brand.domain}>, then redeploy.`,
    ],
    href: "https://resend.com/domains",
    linkLabel: "Open Resend domains",
  },
  founder_access: {
    steps: [
      "Choose the inbox John actively monitors.",
      "Set ADMIN_EMAIL to that exact address in Vercel and redeploy.",
      "This address owns new audit alerts and also controls admin access.",
    ],
    href: vercelEnvironmentUrl,
    linkLabel: "Open Vercel environment variables",
  },
  site_url: {
    steps: [
      `Set NEXT_PUBLIC_SITE_URL to ${tenant.brand.siteUrl} without a trailing slash.`,
      "Apply it to Production, Preview, and Development and redeploy.",
      "This keeps email resume links and webhook references on the correct origin.",
    ],
    href: vercelEnvironmentUrl,
    linkLabel: "Open Vercel environment variables",
  },
  first_party_analytics: {
    steps: [
      "Apply migrations/20260816-first-party-analytics.sql after the Revenue OS migration.",
      "Deploy the site. Page views and conversion events begin capturing automatically; no vendor account or API key is needed.",
      "Visit a public page and submit a test inquiry, then use Analytics to confirm the website activity and canonical revenue funnel update.",
    ],
    href: "#analytics",
    linkLabel: "Open Analytics",
  },
  manual_booking: {
    steps: [
      "Leave CALENDLY_ENABLED unset or set it to false.",
      "John receives the audit request, reviews the company, and replies with meeting times.",
      "No calendar credentials or webhook are needed in this mode.",
    ],
  },
  google_oauth: {
    steps: [
      "Create a Google Cloud OAuth web application and enable Gmail, Calendar, and Drive APIs.",
      `Add the production callback shown here to Authorized redirect URIs: ${tenant.brand.siteUrl}/api/admin/google/callback.`,
      "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and a long random GOOGLE_TOKEN_ENCRYPTION_KEY in Vercel, then redeploy.",
    ],
    href: "https://console.cloud.google.com/apis/credentials",
    linkLabel: "Open Google Cloud credentials",
  },
  google_connection: {
    steps: [
      "Finish the Google OAuth application setup above.",
      "Choose Connect Google Workspace and approve Gmail read/send, Calendar events, and Drive read-only access.",
      "Return here and run a Workspace sync. The status turns ready only after usable scopes and credentials are stored.",
    ],
  },
  ai: {
    steps: [
      `Create one OpenRouter API key. This is the only AI provider credential ${tenant.brand.name} uses.`,
      "Store OPENROUTER_API_KEY in Vercel only. OPENROUTER_MODEL is optional; the app has a documented default.",
      "Redeploy, then open AI Operations or Contact Import. Writes remain behind their normal approval and service boundaries.",
    ],
    href: "https://openrouter.ai/settings/keys",
    linkLabel: "Create OpenRouter key",
  },
  contact_importer: {
    steps: [
      "Apply migrations/20260816-contact-importer.sql after the Revenue OS migration.",
      "Configure OPENROUTER_API_KEY once in Vercel and redeploy.",
      "Open Contact Import, analyze a safe sample, edit the preview, and approve only the exact reviewed snapshot.",
      "Verify the completed batch reports row receipts. Analysis never imports, and execution never sends or creates opportunities.",
    ],
    href: "/admin/contact-imports",
    linkLabel: "Open Contact Import",
  },
  campaigns: {
    steps: [
      "Set a long random CRON_SECRET in Vercel and keep RESEND_API_KEY configured.",
      "Apply the Revenue OS migration and deploy vercel.json with the scheduled executor.",
      "Create a draft campaign, review its dry-run recipients, and activate one version. Material edits require reapproval.",
    ],
  },
  operations: {
    steps: [
      "Set CRON_SECRET in Vercel and redeploy.",
      "Confirm the Revenue campaigns and Google Workspace jobs appear in Vercel Cron Jobs.",
      "Run each job once; this page reports terminal job and source receipts instead of relying on HTTP status alone.",
    ],
    href: vercelEnvironmentUrl,
    linkLabel: "Open Vercel environment variables",
  },
  calendly: {
    steps: [
      "Keep CALENDLY_ENABLED=false until the token and webhook are fully tested.",
      "Add CALENDLY_PERSONAL_ACCESS_TOKEN and a long random CALENDLY_WEBHOOK_SECRET in Vercel.",
      "Create invitee.created and invitee.canceled subscriptions for /api/webhooks/calendly?secret=<CALENDLY_WEBHOOK_SECRET>.",
      "Set CALENDLY_ENABLED=true, redeploy, and test a booking plus cancellation from /roofing.",
    ],
    href: "https://calendly.com/integrations/api_webhooks",
    linkLabel: "Open Calendly API & webhooks",
  },
  google_analytics: {
    steps: [
      `Create or select the GA4 web data stream for ${tenant.brand.domain}.`,
      "Add its measurement ID as NEXT_PUBLIC_GTAG_ID in Vercel and redeploy.",
      "Keep the built-in first-party Revenue OS analytics as the source of truth; add GA4 only when paid advertising compatibility needs it.",
    ],
    href: "https://analytics.google.com/analytics/web/",
    linkLabel: "Open Google Analytics",
  },
  meta_pixel: {
    steps: [
      "Create a Meta data source only when a Meta campaign is planned.",
      "Add the pixel ID as NEXT_PUBLIC_META_PIXEL_ID and redeploy.",
      "Verify qualifier and booking events in Events Manager before spending on ads.",
    ],
    href: "https://business.facebook.com/events_manager2",
    linkLabel: "Open Events Manager",
  },
};

const flowSteps = [
  { label: "Attract", detail: "Inbound and approved outbound", icon: Target },
  { label: "Convert", detail: "Replies, meetings, and follow-up", icon: UserCheck },
  { label: "Propose", detail: "Auditable client decisions", icon: FileCode2 },
  { label: "Operate", detail: "One prioritized founder queue", icon: Inbox },
  { label: "Measure", detail: "Source through won revenue", icon: BarChart3 },
];

const growthLayers = [
  { title: "Controlled campaigns", detail: "Approve one campaign version, then send just in time with reply, booking, bounce, unsubscribe, and pause stops.", icon: Megaphone },
  { title: "Workspace intelligence", detail: "Connect Gmail conversations, Calendar meetings, and only the Drive folders you explicitly approve.", icon: PlugZap },
  { title: "Safe Revenue copilot", detail: "Research, prioritize, draft, and propose actions from live records; external actions remain confirmation-gated.", icon: Bot },
];

const statusMeta: Record<SetupStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ready: { label: "Ready", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  action: { label: "Action needed", icon: TriangleAlert, className: "bg-amber-500/12 text-amber-800 dark:text-amber-300" },
  degraded: { label: "Degraded", icon: TriangleAlert, className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  optional: { label: "Optional", icon: CircleDashed, className: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]" },
  disabled: { label: "Not enabled", icon: CircleDashed, className: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]" },
};

function SetupCheckCard({ check }: { check: SetupCheck }) {
  const meta = statusMeta[check.status];
  const StatusIcon = meta.icon;
  const guide = setupGuides[check.id];

  return (
    <AdminSurface id={check.id} padding="none" className="scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.className)}>
          <StatusIcon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-[-0.015em] text-[var(--admin-ink)]">{check.label}</h3>
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em]", meta.className)}>{meta.label}</span>
          </div>
          <p className="admin-copy mt-1.5 text-pretty text-sm leading-6">{check.description}</p>
          <p className="mt-3 text-pretty text-xs leading-5 text-[var(--admin-ink)]/72">
            <span className="font-semibold text-[var(--admin-ink)]">What it unlocks:</span> {check.accomplishes}
          </p>
          {(check.lastSuccessAt || check.lastFailure) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--admin-muted)]">
              {check.lastSuccessAt && <span>Last success {new Date(check.lastSuccessAt).toLocaleString()}</span>}
              {check.lastFailure && <span className="text-rose-700 dark:text-rose-300">Last failure: {check.lastFailure}</span>}
            </div>
          )}
          {check.keys && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {check.keys.map((key) => (
                <code key={key} className="max-w-full break-all rounded-md bg-black/[0.045] px-2 py-1 font-mono text-[10px] text-[var(--admin-muted)] dark:bg-white/[0.065]">{key}</code>
              ))}
            </div>
          )}
        </div>
      </div>
      {check.action && (
        <div className="border-t border-[var(--admin-border)] px-4 py-3 sm:px-5">
          {check.action.external ? (
            <a href={check.action.href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 transition-[opacity,transform] duration-150 hover:opacity-65 active:scale-[0.96]">
              {check.action.label} <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : (
            <Link href={check.action.href} className="inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 transition-[opacity,transform] duration-150 hover:opacity-65 active:scale-[0.96]">
              {check.action.label} <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      {guide && (
        <details className="group border-t border-[var(--admin-border)]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-[var(--admin-ink)] transition-colors duration-150 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-ink)] dark:hover:bg-white/[0.035] sm:px-5">
            {check.status === "ready" ? "Review setup" : "How to finish this"}
            <ChevronDown className="size-4 shrink-0 text-[var(--admin-muted)] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-[var(--admin-border)] bg-black/[0.018] px-4 py-4 dark:bg-white/[0.018] sm:px-5">
            <ol className="space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-[var(--admin-muted)]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--admin-ink)] font-mono text-[9px] tabular-nums text-[var(--admin-surface)]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {guide.href && (
              <a href={guide.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96]">
                {guide.linkLabel} <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </details>
      )}
    </AdminSurface>
  );
}

export default function AdminSetupPage() {
  const [data, setData] = useState<SetupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [driveFolders, setDriveFolders] = useState("");
  const [googleMessage, setGoogleMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchJson<SetupResponse>("/api/admin/setup");
      setData(next);
      setDriveFolders((next.google?.settings.drive_folder_ids ?? []).join("\n"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not check the launch setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groupedChecks = useMemo(() => {
    const map = new Map<SetupGroup, SetupCheck[]>();
    for (const check of data?.checks ?? []) map.set(check.group, [...(map.get(check.group) ?? []), check]);
    return map;
  }, [data]);

  const syncGoogle = async (source: "all" | "gmail" | "calendar" | "drive") => {
    setGoogleSyncing(true);
    setGoogleMessage(null);
    try {
      await fetchJson("/api/admin/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      setGoogleMessage({ tone: "success", text: `${source === "all" ? "Workspace" : source} sync completed.` });
      await load();
    } catch (syncError) {
      setGoogleMessage({ tone: "error", text: syncError instanceof Error ? syncError.message : "Google sync failed." });
    } finally {
      setGoogleSyncing(false);
    }
  };

  const saveDriveFolders = async () => {
    setGoogleSyncing(true);
    setGoogleMessage(null);
    try {
      const driveFolderIds = driveFolders.split(/\n|,/).map((id) => id.trim()).filter(Boolean);
      await fetchJson("/api/admin/google/sync", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driveFolderIds }) });
      setGoogleMessage({ tone: "success", text: "Drive folder access saved. Run Drive sync to verify it." });
      await load();
    } catch (saveError) {
      setGoogleMessage({ tone: "error", text: saveError instanceof Error ? saveError.message : "Could not save Drive folders." });
    } finally {
      setGoogleSyncing(false);
    }
  };

  const groupMeta: Array<{ id: SetupGroup; eyebrow: string; title: string; description: string; icon: typeof ShieldCheck }> = [
    { id: "core", eyebrow: "Foundation", title: "Core system", description: "Identity, database, access, and the canonical production origin.", icon: ShieldCheck },
    { id: "email", eyebrow: "Communication", title: "Email delivery", description: "Approved transactional and campaign delivery with provider receipts.", icon: MailCheck },
    { id: "google", eyebrow: "Connection", title: "Google Workspace", description: "One encrypted connection for Gmail, Calendar, and selected Drive folders.", icon: PlugZap },
    { id: "ai", eyebrow: "Intelligence", title: "Revenue copilot", description: "Grounded analysis and confirmation-gated action proposals.", icon: Bot },
    { id: "campaigns", eyebrow: "Outbound", title: "Campaign automation", description: "Versioned approval, just-in-time sending, and immediate stop controls.", icon: Megaphone },
    { id: "proposals", eyebrow: "Closing", title: "Proposal decisions", description: "Public view, acceptance, decline, and pipeline attribution without payment.", icon: FileCode2 },
    { id: "analytics", eyebrow: "Measurement", title: "Revenue attribution", description: "Campaign and source performance through won revenue.", icon: BarChart3 },
    { id: "booking", eyebrow: "Scheduling", title: "Booking mode", description: "Manual scheduling now, with Calendly preserved as an optional later channel.", icon: CalendarDays },
    { id: "operations", eyebrow: "Reliability", title: "Operations health", description: "Protected jobs, terminal receipts, failures, and recovery evidence.", icon: Settings2 },
  ];

  return (
    <div className="space-y-7 pb-8">
      <PageHeader
        title="Setup Center"
        subtitle="Connect, verify, and operate the complete Revenue OS. Every status reflects this deployment; secrets are never displayed or stored in the admin database."
        actions={(
          <>
            <Link href="/admin/integrations" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]">
              Integration map <PlugZap className="size-3.5" aria-hidden="true" />
            </Link>
            <Link href="/roofing" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-sm transition-[transform,background-color] duration-150 hover:bg-[var(--admin-surface-subtle)] active:scale-[0.96]">
              View funnel <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] disabled:cursor-wait disabled:opacity-55">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" /> Refresh checks
            </button>
          </>
        )}
      />

      {loading && !data ? (
        <AdminSurface className="flex min-h-64 items-center justify-center">
          <div className="text-center"><Loader2 className="mx-auto size-6 animate-spin text-[var(--admin-muted)]" /><p className="admin-copy mt-3 text-sm">Checking the running deployment…</p></div>
        </AdminSurface>
      ) : error && !data ? (
        <AdminSurface tone="attention" className="flex min-h-64 flex-col items-center justify-center text-center">
          <TriangleAlert className="size-6 text-amber-700 dark:text-amber-300" />
          <p className="mt-3 font-semibold text-[var(--admin-ink)]">Setup check failed</p>
          <p className="admin-copy mt-1 max-w-md text-sm">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 min-h-11 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] active:scale-[0.96]">Try again</button>
        </AdminSurface>
      ) : data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-7">
          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <AdminSurface tone="ink" padding="lg" className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#d7ff5f]/10 blur-3xl" />
              <div className="relative">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#d7ff5f]">Production readiness</p>
                    <h2 className="mt-3 text-balance text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                      {data.summary.launchReady ? "Ready to generate opportunities." : "A few launch items need attention."}
                    </h2>
                    <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-white/58">
                      {data.summary.launchReady
                        ? "The required capture, email, database, and measurement systems are connected."
                        : `${data.summary.requiredReady} of ${data.summary.requiredTotal} required systems are ready. Open the checks below for exact instructions.`}
                    </p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.05em] text-white">{data.summary.percent}%</p>
                    <p className="mt-1 text-xs text-white/42">required complete</p>
                  </div>
                </div>
                <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${data.summary.percent}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-[#d7ff5f]" />
                </div>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/52">
                  <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#d7ff5f]" /> Secrets hidden</span>
                  <span className="flex items-center gap-2"><Check className="size-4 text-[#d7ff5f]" /> Live environment checks</span>
                  <span className="flex items-center gap-2"><Settings2 className="size-4 text-[#d7ff5f]" /> Exact setup instructions</span>
                </div>
              </div>
            </AdminSurface>

            <AdminSurface tone="attention" padding="lg">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500/12 text-amber-800 dark:text-amber-300">
                {data.bookingMode === "manual" ? <UserCheck className="size-5" /> : <CalendarClock className="size-5" />}
              </span>
              <p className="admin-eyebrow mt-5">Current booking mode</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">
                {data.bookingMode === "manual" ? "Personal review" : "Calendly self-booking"}
              </h2>
              <p className="admin-copy mt-2 text-sm leading-6">
                {data.bookingMode === "manual"
                  ? "This is launch-safe. Qualified prospects receive confirmation, enter Bookings, and wait for John’s personal reply."
                  : "Qualified prospects can choose a time immediately, with webhook-based stage attribution."}
              </p>
              <Link href="/admin/bookings" className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 transition-opacity duration-150 hover:opacity-65">
                Open opportunity pipeline <ArrowRight className="size-3.5" />
              </Link>
            </AdminSurface>
          </section>

          <section>
            <div className="mb-3">
              <p className="admin-eyebrow">What this accomplishes</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">One measurable path from attention to revenue</h2>
            </div>
            <AdminSurface padding="sm">
              <div className="grid gap-2 md:grid-cols-5">
                {flowSteps.map(({ label, detail, icon: Icon }, index) => (
                  <div key={label} className="relative rounded-xl bg-black/[0.025] p-4 dark:bg-white/[0.025]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-sm"><Icon className="size-4" /></span>
                      <span className="font-mono text-[9px] tabular-nums text-[var(--admin-muted)]">0{index + 1}</span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">{label}</p>
                    <p className="admin-copy mt-1 text-xs leading-5">{detail}</p>
                  </div>
                ))}
              </div>
            </AdminSurface>
          </section>

          {data.google?.connected && (
            <section id="google">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="admin-eyebrow">Workspace control</p>
                  <h2 className="mt-1 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Connected as {data.google.accountEmail}</h2>
                  <p className="admin-copy mt-1 text-pretty text-sm">Sync on demand, then let protected scheduled jobs keep conversations and meetings current.</p>
                </div>
                <button type="button" onClick={() => void syncGoogle("all")} disabled={googleSyncing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--admin-ink)] pl-4 pr-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:cursor-wait disabled:opacity-50">
                  <RefreshCw className={cn("size-3.5", googleSyncing && "animate-spin")} /> Sync Workspace
                </button>
              </div>
              <AdminSurface padding="lg">
                <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><FolderOpen className="size-[18px]" /></span>
                      <div><h3 className="font-semibold text-[var(--admin-ink)]">Approved Drive folders</h3><p className="admin-copy mt-0.5 text-xs">One folder ID per line, maximum 10.</p></div>
                    </div>
                    <textarea value={driveFolders} onChange={(event) => setDriveFolders(event.target.value)} rows={4} placeholder="1AbCdEf..." className="mt-4 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 font-mono text-xs text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/60 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void saveDriveFolders()} disabled={googleSyncing} className="min-h-10 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50">Save folders</button>
                      <button type="button" onClick={() => void syncGoogle("drive")} disabled={googleSyncing} className="min-h-10 rounded-lg px-3.5 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-50">Sync Drive</button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { label: "Gmail", detail: "Threads, unread work, replies, and campaign stops", source: "gmail" as const, icon: MailCheck },
                      { label: "Calendar", detail: "Upcoming meetings and recent meeting history", source: "calendar" as const, icon: CalendarDays },
                    ].map(({ label, detail, source, icon: Icon }) => (
                      <div key={label} className="rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.025]">
                        <div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
                          <Icon className="size-4 text-[var(--admin-ink)]" />
                          <h3 className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">{label}</h3>
                          <p className="admin-copy mt-1 text-pretty text-xs leading-5">{detail}</p>
                          <button type="button" onClick={() => void syncGoogle(source)} disabled={googleSyncing} className="mt-4 min-h-10 text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 transition-[opacity,transform] duration-150 hover:opacity-65 active:scale-[0.96] disabled:opacity-50">Sync {label}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {googleMessage && <p className={cn("mt-5 rounded-xl px-4 py-3 text-sm", googleMessage.tone === "success" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "bg-rose-500/10 text-rose-800 dark:text-rose-200")}>{googleMessage.text}</p>}
              </AdminSurface>
            </section>
          )}

          {groupMeta.map(({ id, eyebrow, title, description, icon: Icon }) => {
            const checks = groupedChecks.get(id) ?? [];
            if (!checks.length) return null;
            return (
              <section key={id}>
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><Icon className="size-[18px]" /></span>
                  <div>
                    <p className="admin-eyebrow">{eyebrow}</p>
                    <h2 className="mt-1 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">{title}</h2>
                    <p className="admin-copy mt-1 text-pretty text-sm">{description}</p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {checks.map((check) => <SetupCheckCard key={check.id} check={check} />)}
                </div>
              </section>
            );
          })}

          <section>
            <div className="mb-3">
              <p className="admin-eyebrow">Operating capabilities</p>
              <h2 className="mt-1 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">What the connected system now does</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {growthLayers.map(({ title, detail, icon: Icon }) => (
                <AdminSurface key={title} padding="lg">
                  <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><Icon className="size-[18px]" /></span>
                  <h3 className="mt-5 font-semibold tracking-[-0.015em] text-[var(--admin-ink)]">{title}</h3>
                  <p className="admin-copy mt-2 text-sm leading-6">{detail}</p>
                </AdminSurface>
              ))}
            </div>
          </section>

          <p className="flex items-start gap-2 text-xs leading-5 text-[var(--admin-muted)]">
            <Rocket className="mt-0.5 size-3.5 shrink-0" /> Application preferences live in Settings. Deployment integrations and credentials live in Vercel and are verified here after redeploying.
          </p>
        </motion.div>
      )}
    </div>
  );
}
