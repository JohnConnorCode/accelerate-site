"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  FileCode2,
  Inbox,
  Loader2,
  MailCheck,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  UserCheck,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

type SetupStatus = "ready" | "action" | "optional" | "disabled";

interface SetupCheck {
  id: string;
  label: string;
  detail: string;
  status: SetupStatus;
  required: boolean;
  keys?: string[];
}

interface SetupResponse {
  checks: SetupCheck[];
  bookingMode: "manual" | "calendly";
  summary: {
    requiredReady: number;
    requiredTotal: number;
    optionalReady: number;
    optionalTotal: number;
    launchReady: boolean;
    percent: number;
  };
}

interface SetupGuide {
  steps: string[];
  href?: string;
  linkLabel?: string;
}

const vercelEnvironmentUrl = "https://vercel.com/robert-farrells-projects/accelerate-site/settings/environment-variables";

const setupGuides: Record<string, SetupGuide> = {
  supabase: {
    steps: [
      "Open the Accelerate Supabase project settings and copy the project URL and anonymous key.",
      "Copy the service-role key separately. It is server-only and must never use the NEXT_PUBLIC_ prefix.",
      "Add all three variables to Production, Preview, and Development in Vercel, then redeploy.",
    ],
    href: "https://supabase.com/dashboard/project/skjypuwkceoiunyhhqlm/settings/api",
    linkLabel: "Open Supabase API settings",
  },
  schema: {
    steps: [
      "Open the Supabase SQL editor.",
      "Paste and run migrations/roofing-booking-machine.sql after the existing business operating-system and UTM migrations.",
      "Return here and refresh. The check reads the live opportunities table.",
    ],
    href: "https://supabase.com/dashboard/project/skjypuwkceoiunyhhqlm/sql/new",
    linkLabel: "Open the SQL editor",
  },
  email: {
    steps: [
      "Verify acceleratewith.us (or the sender domain) in Resend.",
      "Create an API key and add RESEND_API_KEY in Vercel.",
      "Set RESEND_FROM_EMAIL to a verified sender such as Accelerate <hello@acceleratewith.us>, then redeploy.",
    ],
    href: "https://resend.com/domains",
    linkLabel: "Open Resend domains",
  },
  admin_email: {
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
      "Set NEXT_PUBLIC_SITE_URL to https://www.acceleratewith.us without a trailing slash.",
      "Apply it to Production, Preview, and Development and redeploy.",
      "This keeps email resume links and webhook references on the correct origin.",
    ],
    href: vercelEnvironmentUrl,
    linkLabel: "Open Vercel environment variables",
  },
  plausible: {
    steps: [
      "Add acceleratewith.us as a Plausible site if it is not already present.",
      "Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN=acceleratewith.us and create a Stats API key for PLAUSIBLE_API_KEY.",
      "Redeploy, then complete one test qualifier to confirm events appear.",
    ],
    href: "https://plausible.io/settings/api-keys",
    linkLabel: "Open Plausible API keys",
  },
  manual_mode: {
    steps: [
      "Leave CALENDLY_ENABLED unset or set it to false.",
      "John receives the audit request, reviews the company, and replies with meeting times.",
      "No calendar credentials or webhook are needed in this mode.",
    ],
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
      "Create or select the GA4 web data stream for acceleratewith.us.",
      "Add its measurement ID as NEXT_PUBLIC_GTAG_ID in Vercel and redeploy.",
      "Keep Plausible as the primary source of truth; use GA4 for campaign and ads compatibility.",
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
  { label: "Attract", detail: "Focused /roofing campaign", icon: Target },
  { label: "Qualify", detail: "60-second operator fit gate", icon: UserCheck },
  { label: "Capture", detail: "One attributed opportunity", icon: Inbox },
  { label: "Follow up", detail: "Confirmation + owner alert", icon: MailCheck },
  { label: "Measure", detail: "Stages, source, and revenue", icon: BarChart3 },
];

const growthLayers = [
  { title: "Founder outbound cockpit", detail: "Import target accounts, prioritize daily outreach, log touches, and track replies in one queue.", icon: Workflow },
  { title: "Automatic call prep", detail: "Research each company and generate a concise leak hypothesis before John gets on the call.", icon: Sparkles },
  { title: "Audit-to-proposal system", detail: "Turn call notes into a branded audit, scoped recommendation, proposal, and timed follow-up.", icon: FileCode2 },
];

const statusMeta: Record<SetupStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ready: { label: "Ready", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  action: { label: "Action needed", icon: TriangleAlert, className: "bg-amber-500/12 text-amber-800 dark:text-amber-300" },
  optional: { label: "Optional", icon: CircleDashed, className: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]" },
  disabled: { label: "Not enabled", icon: CircleDashed, className: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]" },
};

function SetupCheckCard({ check }: { check: SetupCheck }) {
  const meta = statusMeta[check.status];
  const StatusIcon = meta.icon;
  const guide = setupGuides[check.id];

  return (
    <AdminSurface padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.className)}>
          <StatusIcon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-[-0.015em] text-[var(--admin-ink)]">{check.label}</h3>
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em]", meta.className)}>{meta.label}</span>
          </div>
          <p className="admin-copy mt-1.5 text-sm leading-6">{check.detail}</p>
          {check.keys && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {check.keys.map((key) => (
                <code key={key} className="max-w-full break-all rounded-md bg-black/[0.045] px-2 py-1 font-mono text-[10px] text-[var(--admin-muted)] dark:bg-white/[0.065]">{key}</code>
              ))}
            </div>
          )}
        </div>
      </div>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson<SetupResponse>("/api/admin/setup"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not check the launch setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const requiredChecks = useMemo(() => data?.checks.filter((check) => check.required) ?? [], [data]);
  const optionalChecks = useMemo(() => data?.checks.filter((check) => !check.required) ?? [], [data]);

  return (
    <div className="space-y-7 pb-8">
      <PageHeader
        title="Launch Setup"
        subtitle="The source of truth for launching and operating the roofing opportunity funnel. Checks reflect this running deployment; secret values are never displayed."
        actions={(
          <>
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

          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="admin-eyebrow">Required to launch</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Core capture and follow-up</h2>
              </div>
              <p className="hidden text-xs tabular-nums text-[var(--admin-muted)] sm:block">{data.summary.requiredReady}/{data.summary.requiredTotal} ready</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {requiredChecks.map((check) => <SetupCheckCard key={check.id} check={check} />)}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="admin-eyebrow">Optional upgrades</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Add only when the channel needs them</h2>
              <p className="admin-copy mt-1 text-sm">Manual review is intentionally first. Calendly, GA4, and Meta do not block launch.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {optionalChecks.map((check) => <SetupCheckCard key={check.id} check={check} />)}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="admin-eyebrow">Next growth layers</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">What I can build next</h2>
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
