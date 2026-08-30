"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FilterX, ScrollText } from "lucide-react";
import Link from "@/components/admin/AdminLink";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { EmptyState } from "@/components/admin/EmptyState";
import { adminListItemVariants, adminListVariants } from "@/lib/admin/motion";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

interface AuditHistoryEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

interface AuditHistoryResult {
  entries: AuditHistoryEntry[];
  filterOptions: {
    actors: string[];
    entityTypes: string[];
    actions: string[];
    sources: string[];
  };
}

const FILTER_KEYS = ["actor", "entity", "action", "source", "from", "to"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function entityHref(entityType: string, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "opportunity") return `/admin/pipeline?opportunity=${encodeURIComponent(entityId)}`;
  if (entityType === "conversation") return "/admin/conversations";
  if (entityType === "task") return "/admin/today";
  if (entityType === "proposal") return "/admin/proposals";
  if (entityType === "campaign") return "/admin/campaigns";
  if (entityType === "feature_request") return "/admin/features";
  if (entityType === "admin_settings") return "/admin/settings";
  if (entityType === "integration" || entityType === "integration_connection") return "/admin/integrations";
  return null;
}

function formatTime(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return timestamp;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}

function scalarEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [] as Array<[string, string]>;
  return Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== null && child !== undefined && typeof child !== "object")
    .map(([key, child]) => [key.replace(/_/g, " "), String(child)] as [string, string]);
}

function changeSummary(entry: AuditHistoryEntry) {
  const before = Object.fromEntries(scalarEntries(entry.before));
  const after = Object.fromEntries(scalarEntries(entry.after));
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key]).slice(0, 4);
  if (keys.length) return keys.map((key) => `${key} ${before[key] ?? "—"} → ${after[key] ?? "—"}`).join(" · ");
  return scalarEntries(entry.after).slice(0, 4).map(([key, value]) => `${key} ${value}`).join(" · ") || null;
}

function FilterSelect({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: FilterKey;
  value: string;
  options: string[];
  onChange: (name: FilterKey, value: string) => void;
}) {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="admin-field min-h-11 w-full text-xs font-semibold"
      >
        <option value="">{label}: All</option>
        {choices.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const nav = useAdminNavigation();
  const filters = useMemo(() => ({
    actor: searchParams.get("actor")?.trim() || "",
    entity: searchParams.get("entity")?.trim() || "",
    action: searchParams.get("action")?.trim() || "",
    source: searchParams.get("source")?.trim() || "",
    from: searchParams.get("from")?.trim() || "",
    to: searchParams.get("to")?.trim() || "",
  }), [searchParams]);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
    return params.toString();
  }, [filters]);
  const historyQuery = useAdminQuery<AuditHistoryResult>(
    ["admin", "activity", query],
    query ? `/api/admin/activity?${query}` : "/api/admin/activity",
  );
  const entries = historyQuery.data?.entries ?? [];
  const options = historyQuery.data?.filterOptions ?? { actors: [], entityTypes: [], actions: [], sources: [] };
  const activeFilterCount = FILTER_KEYS.filter((key) => filters[key]).length;

  const replaceFilters = (next: Partial<typeof filters>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    for (const key of FILTER_KEYS) if (merged[key]) params.set(key, merged[key]);
    const href = params.toString() ? `/admin/activity?${params}` : "/admin/activity";
    nav.push(href, "preserve");
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Activity"
        subtitle="Actor, origin, target, and before/after history for material changes."
      />
      <AdminReadBody
        loading={historyQuery.isPending}
        hasData={Boolean(historyQuery.data)}
        error={historyQuery.error?.message}
        onRetry={() => void historyQuery.refetch()}
        refreshing={historyQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="table" rows={10} />}
        label="Loading audit history"
      >
        <AdminSurface padding="none" className="mb-4 overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="admin-eyebrow">Audit filters</p>
                <h2 className="mt-1 text-balance text-base font-semibold">Narrow the ledger without leaving this page</h2>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => replaceFilters({ actor: "", entity: "", action: "", source: "", from: "", to: "" })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] duration-150 hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
                >
                  <FilterX className="size-4" />
                  Clear {activeFilterCount} filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <FilterSelect label="Actor" name="actor" value={filters.actor} options={options.actors} onChange={(name, value) => replaceFilters({ [name]: value })} />
              <FilterSelect label="Entity" name="entity" value={filters.entity} options={options.entityTypes} onChange={(name, value) => replaceFilters({ [name]: value })} />
              <FilterSelect label="Action" name="action" value={filters.action} options={options.actions} onChange={(name, value) => replaceFilters({ [name]: value })} />
              <FilterSelect label="Source" name="source" value={filters.source} options={options.sources} onChange={(name, value) => replaceFilters({ [name]: value })} />
              <label className="min-w-0">
                <span className="sr-only">From date</span>
                <input type="date" value={filters.from} onChange={(event) => replaceFilters({ from: event.target.value })} className="admin-field min-h-11 w-full [color-scheme:light] dark:[color-scheme:dark]" />
              </label>
              <label className="min-w-0">
                <span className="sr-only">To date</span>
                <input type="date" value={filters.to} onChange={(event) => replaceFilters({ to: event.target.value })} className="admin-field min-h-11 w-full [color-scheme:light] dark:[color-scheme:dark]" />
              </label>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface padding="none" className="overflow-hidden">
          {entries.length === 0 ? (
            <EmptyState
              title="No matching audit history"
              message="No matching audit history"
              description="Try a wider date range or clear a filter. New material writes appear here after they are recorded."
              icon={ScrollText}
            />
          ) : (
            <motion.div variants={adminListVariants} initial={false} animate="visible" className="divide-y divide-[var(--admin-border)]">
              {entries.map((entry) => {
                const href = entityHref(entry.entityType, entry.entityId);
                const change = changeSummary(entry);
                return (
                  <motion.article key={entry.id} variants={adminListItemVariants} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                        {entry.source} · {entry.entityType.replace(/_/g, " ")}
                      </p>
                      <h2 className="mt-1 truncate text-sm font-semibold text-[var(--admin-ink)]">{entry.action.replace(/\./g, " · ")}</h2>
                      <p className="admin-copy mt-1 text-pretty text-xs">
                        {entry.actorEmail || "Unattributed"}
                        {entry.entityId ? ` · ${entry.entityId}` : ""}
                      </p>
                      {change && <p className="admin-copy mt-1 line-clamp-2 text-pretty text-xs">{change}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                      <time className="text-xs tabular-nums text-[var(--admin-muted)]" dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                      {href && (
                        <Link href={href} className="text-xs font-semibold text-[var(--admin-ink)] underline-offset-2 hover:underline">
                          Open record
                        </Link>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AdminSurface>
      </AdminReadBody>
    </motion.div>
  );
}
