"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "@/components/admin/AdminLink";
import {
  ArrowRight,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  CircleDashed,
  Cloud,
  Database,
  ExternalLink,
  FileText,
  Mail,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  TriangleAlert,
  WalletCards,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import type { IntegrationCatalog, IntegrationView } from "@/lib/revenue-os/integrations";
import type { IntegrationStatus } from "@/lib/revenue-os/integration-registry";
import { cn } from "@/lib/utils";
import { TenantProviderControls } from "@/components/admin/TenantProviderControls";

const providerIcons: Record<string, LucideIcon> = {
  supabase: Database,
  google: Cloud,
  resend: Mail,
  openrouter: Bot,
  "first-party": Network,
  microsoft: Cloud,
  stripe: WalletCards,
  slack: MessageSquare,
  notion: FileText,
  hubspot: Boxes,
  accounting: WalletCards,
  "delivery-tools": Workflow,
  n8n: Workflow,
  mcp: Network,
};

const statusMeta: Record<IntegrationStatus, { label: string; icon: LucideIcon; className: string; dot: string }> = {
  ready: { label: "Ready", icon: Check, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  degraded: { label: "Degraded", icon: TriangleAlert, className: "bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  action: { label: "Needs verification", icon: TriangleAlert, className: "bg-amber-500/12 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  available: { label: "Available", icon: CircleDashed, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  planned: { label: "Planned", icon: CircleDashed, className: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]", dot: "bg-black/25 dark:bg-white/30" },
};

type Filter = "all" | "operational" | "attention" | "available" | "planned";

function relativeTime(value: string | null) {
  if (!value) return "No receipt yet";
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed)) return "Unknown time";
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ProviderCard({ provider }: { provider: IntegrationView }) {
  const Icon = providerIcons[provider.id] ?? Boxes;
  const meta = statusMeta[provider.status];
  const StatusIcon = meta.icon;

  return (
    <AdminSurface padding="none" className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] shadow-sm dark:bg-white/[0.065]">
              <Icon className="size-[19px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-balance text-base font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">{provider.name}</h2>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]", meta.className)}>
                  <StatusIcon className="size-3" aria-hidden="true" /> {meta.label}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--admin-muted)]">{provider.strategicRole}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-black/[0.035] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.05]">{provider.cost.label}</span>
        </div>

        <p className="admin-copy mt-4 text-pretty text-sm leading-6">{provider.description}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {provider.capabilities.map((capability) => {
            const capabilityMeta = statusMeta[capability.status];
            return (
              <div key={capability.id} className="rounded-xl bg-black/[0.027] p-3.5 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[var(--admin-ink)]">{capability.label}</p>
                  <span className={cn("size-2 shrink-0 rounded-full", capabilityMeta.dot)} title={capabilityMeta.label} />
                </div>
                <p className="mt-1.5 text-pretty text-[11px] leading-5 text-[var(--admin-muted)]">{capability.statusReason}</p>
                {capability.lastEvidenceAt && <p className="mt-2 font-mono text-[9px] tabular-nums text-[var(--admin-muted)]">Receipt {relativeTime(capability.lastEvidenceAt)}</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {provider.transports.map((transport) => <span key={transport} className="rounded-md bg-black/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.07em] text-[var(--admin-muted)] dark:bg-white/[0.055]">{transport.replaceAll("_", " ")}</span>)}
        </div>
      </div>

      <details className="group border-t border-[var(--admin-border)]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-semibold text-[var(--admin-ink)] transition-[background-color] duration-150 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-ink)] dark:hover:bg-white/[0.035] sm:px-5">
          Operating contract
          <ChevronDown className="size-4 shrink-0 text-[var(--admin-muted)] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-[var(--admin-border)] bg-black/[0.018] p-4 dark:bg-white/[0.018] sm:p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="admin-eyebrow">Cost posture</p>
              <p className="admin-copy mt-1.5 text-xs leading-5">{provider.cost.detail}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Authentication</p>
              <p className="admin-copy mt-1.5 text-xs leading-5">{provider.auth}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Data boundary</p>
              <p className="admin-copy mt-1.5 text-xs leading-5">{provider.dataClasses.join(" · ")}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Guardrail</p>
              <p className="admin-copy mt-1.5 text-xs leading-5">{provider.guardrail}</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2">
            {provider.limits.map((limit) => <li key={limit} className="relative pl-3 text-xs leading-5 text-[var(--admin-muted)] before:absolute before:left-0 before:top-[0.58rem] before:size-1 before:rounded-full before:bg-[var(--admin-muted)]/55">{limit}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {provider.setupHref && (
              <Link href={provider.setupHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]">
                {provider.status === "planned" ? "View roadmap" : "Open setup"} <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            {provider.docsHref.startsWith("/") ? (
              <Link href={provider.docsHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]">Reference <ArrowRight className="size-3.5" /></Link>
            ) : (
              <a href={provider.docsHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]">Provider docs <ExternalLink className="size-3.5" /></a>
            )}
          </div>
        </div>
      </details>
    </AdminSurface>
  );
}

export default function IntegrationsPage() {
  const integrationsQuery = useAdminQuery<IntegrationCatalog>(["admin", "integrations"], "/api/admin/integrations");
  const data = integrationsQuery.data ?? null;
  const loading = integrationsQuery.isPending;
  const error = integrationsQuery.error?.message || "";
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => { await integrationsQuery.refetch(); }, [integrationsQuery]);

  const providers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.providers ?? []).filter((provider) => {
      const matchesFilter = filter === "all"
        || (filter === "operational" && provider.status === "ready")
        || (filter === "attention" && ["degraded", "action"].includes(provider.status))
        || (filter === "available" && provider.status === "available")
        || (filter === "planned" && provider.status === "planned");
      const matchesQuery = !needle || [provider.name, provider.description, provider.strategicRole, provider.category, ...provider.capabilities.map((item) => item.label)].join(" ").toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  const filters: Array<{ id: Filter; label: string; count?: number }> = [
    { id: "all", label: "All", count: data?.summary.total },
    { id: "operational", label: "Ready", count: data?.summary.ready },
    { id: "attention", label: "Attention", count: data?.summary.attention },
    { id: "available", label: "Available", count: data?.summary.available },
    { id: "planned", label: "Planned", count: data?.summary.planned },
  ];

  return (
    <div className="space-y-7 pb-10">
      <PageHeader
        title="Integrations"
        subtitle="One capability map for the tools that power the Command Center. Ready means behavior was verified, not merely that a key exists."
        actions={<button type="button" onClick={() => void load()} disabled={integrationsQuery.isFetching} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:cursor-wait disabled:opacity-55"><RefreshCw className={cn("size-3.5", integrationsQuery.isFetching && "animate-spin")} /> Refresh evidence</button>}
      />

      <TenantProviderControls />

      <AdminReadBody loading={loading} hasData={Boolean(data)} error={error} onRetry={() => void load()} refreshing={integrationsQuery.isFetching} loadingFallback={<LoadingSkeleton variant="page" />} label="Loading integrations">
      {data && (
        <>
          {!data.evidenceAvailable && <AdminSurface tone="attention" className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="text-sm font-semibold text-[var(--admin-ink)]">Operational evidence is incomplete</p><p className="admin-copy mt-1 text-xs leading-5">The catalog remains usable, but no affected provider is shown as healthy until the receipt tables can be read again.</p></div></AdminSurface>}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Behaviorally ready", value: data.summary.ready, detail: "Fresh successful evidence", tone: "text-emerald-600 dark:text-emerald-300" },
              { label: "Needs attention", value: data.summary.attention, detail: "Degraded or unverified", tone: data.summary.attention ? "text-amber-700 dark:text-amber-300" : "text-[var(--admin-ink)]" },
              { label: "Available now", value: data.summary.available, detail: "Native connector, not configured", tone: "text-sky-700 dark:text-sky-300" },
              { label: "Planned and edge", value: data.summary.planned, detail: "Sequenced, not installed", tone: "text-[var(--admin-ink)]" },
            ].map((metric) => <AdminSurface key={metric.label} padding="md"><p className="admin-eyebrow">{metric.label}</p><p className={cn("mt-3 font-mono text-3xl font-semibold tabular-nums tracking-[-0.045em]", metric.tone)}>{metric.value}</p><p className="admin-copy mt-1 text-xs">{metric.detail}</p></AdminSurface>)}
          </section>

          <AdminSurface padding="sm" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-full gap-1 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Integration status">
              {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]", filter === item.id ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "text-[var(--admin-muted)] hover:bg-black/[0.04] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.055]")}><span>{item.label}</span><span className="font-mono text-[9px] tabular-nums opacity-65">{item.count ?? 0}</span></button>)}
            </div>
            <label className="relative block w-full lg:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-muted)]" /><span className="sr-only">Search integrations</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools or capabilities" className="min-h-11 w-full rounded-xl bg-black/[0.035] pl-9 pr-3 text-sm text-[var(--admin-ink)] outline-none shadow-[var(--admin-shadow-border)] transition-[box-shadow] duration-150 placeholder:text-[var(--admin-muted)] focus:shadow-[var(--admin-shadow-border-hover)] dark:bg-white/[0.045]" /></label>
          </AdminSurface>

          {providers.length ? <section className="grid items-start gap-4 xl:grid-cols-2">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</section> : <AdminSurface className="py-14 text-center"><Search className="mx-auto size-5 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">No integrations match this view</p><button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="mt-3 min-h-10 text-xs font-semibold underline underline-offset-4">Clear filters</button></AdminSurface>}

          <p className="text-center font-mono text-[9px] uppercase tracking-[0.09em] text-[var(--admin-muted)]">Registry {data.registryVersion} · evidence generated {new Date(data.generatedAt).toLocaleString()}</p>
        </>
      )}
      </AdminReadBody>
    </div>
  );
}
