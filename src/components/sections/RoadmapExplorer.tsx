"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import { FEATURE_STATUS_META, isFeaturePriority, type FeatureStatus } from "@/lib/feature-board";
import {
  countRoadmapByStatus,
  DEFAULT_ROADMAP_FILTERS,
  filterRoadmapCards,
  groupRoadmapByStatus,
  parseRoadmapSearchParams,
  ROADMAP_PRIORITY_ORDER,
  roadmapFiltersAreDefault,
  serializeRoadmapSearchParams,
  uniqueRoadmapCategories,
  type PublicRoadmapCard,
  type RoadmapFilters,
  type RoadmapStatusFilter,
} from "@/lib/roadmap";
import { cn } from "@/lib/utils";

const STATUS_CHIP_ORDER: RoadmapStatusFilter[] = [
  "active",
  "all",
  "in_progress",
  "planned",
  "blocked",
  "backlog",
  "shipped",
];

const STATUS_CHIP_LABEL: Record<RoadmapStatusFilter, string> = {
  active: "Active",
  all: "All",
  backlog: FEATURE_STATUS_META.backlog.label,
  planned: FEATURE_STATUS_META.planned.label,
  in_progress: FEATURE_STATUS_META.in_progress.label,
  blocked: FEATURE_STATUS_META.blocked.label,
  shipped: FEATURE_STATUS_META.shipped.label,
};

const STATUS_PIP: Record<FeatureStatus, string> = {
  in_progress: "bg-amber-400",
  planned: "bg-sky-400",
  blocked: "bg-rose-400",
  backlog: "bg-zinc-400",
  shipped: "bg-emerald-400",
};

function chipClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
    active
      ? "border-border-gold bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-heading"
      : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  const lower = needle.toLowerCase();
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === lower ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-sm bg-[color-mix(in_srgb,var(--gold)_32%,transparent)] text-heading"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function writeRoadmapUrl(filters: RoadmapFilters, hash?: string) {
  const query = serializeRoadmapSearchParams(filters);
  const next = `${window.location.pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  window.history.replaceState(window.history.state, "", next);
}

export function RoadmapExplorerFromUrl({ cards }: { cards: PublicRoadmapCard[] }) {
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => parseRoadmapSearchParams(searchParams), [searchParams]);
  return <RoadmapExplorer cards={cards} initialFilters={initialFilters} />;
}

export function RoadmapExplorer({
  cards,
  initialFilters = DEFAULT_ROADMAP_FILTERS,
}: {
  cards: PublicRoadmapCard[];
  initialFilters?: RoadmapFilters;
}) {
  const [filters, setFilters] = useState<RoadmapFilters>(initialFilters);
  const categories = useMemo(() => uniqueRoadmapCategories(cards), [cards]);
  const statusCounts = useMemo(() => countRoadmapByStatus(cards), [cards]);
  const visible = useMemo(() => filterRoadmapCards(cards, filters), [cards, filters]);
  const grouped = useMemo(() => groupRoadmapByStatus(visible), [visible]);
  const hasCustomFilters = !roadmapFiltersAreDefault(filters);
  const readyCount = useMemo(() => cards.filter((card) => card.ready).length, [cards]);
  const alignedHash = useRef(false);

  useEffect(() => {
    writeRoadmapUrl(filters, window.location.hash.replace(/^#/, ""));
  }, [filters]);

  useEffect(() => {
    if (alignedHash.current) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      alignedHash.current = true;
      return;
    }
    const el = document.getElementById(hash);
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ block: "start" });
    alignedHash.current = true;
  }, [visible]);

  function update(patch: Partial<RoadmapFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="mt-10">
      <div className="lg:sticky lg:top-[calc(var(--site-header-h)+var(--safe-top))] lg:z-20 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] p-4 backdrop-blur-md sm:p-5">
        <label htmlFor="roadmap-search" className="sr-only">
          Search the roadmap
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
          <input
            id="roadmap-search"
            type="search"
            value={filters.query}
            onChange={(event) => {
              const query = event.target.value;
              if (query.trim() && filters.status === "active") update({ query, status: "all" });
              else update({ query });
            }}
            placeholder="Search titles, acceptance, and areas"
            className="admin-field w-full rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] py-2.5 pl-10 pr-9 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
          />
          {filters.query ? (
            <button
              type="button"
              onClick={() => update({ query: "" })}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white-muted transition-colors hover:text-heading"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by status">
          {STATUS_CHIP_ORDER.map((status) => {
            const count = statusCounts[status];
            return (
              <button
                key={status}
                type="button"
                aria-pressed={filters.status === status}
                onClick={() => update({ status })}
                className={chipClass(filters.status === status)}
              >
                {STATUS_CHIP_LABEL[status]} ({count})
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white-muted sm:max-w-xs">
            <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em]">Area</span>
            <select
              value={filters.category ?? ""}
              onChange={(event) => update({ category: event.target.value || null })}
              className="admin-field min-w-0 flex-1 rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] py-2 pl-3 pr-8 text-sm text-heading focus:border-border-gold focus:outline-none"
            >
              <option value="">All areas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white-muted sm:max-w-xs">
            <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em]">Priority</span>
            <select
              value={filters.priority ?? ""}
              onChange={(event) =>
                update({
                  priority: isFeaturePriority(event.target.value) ? event.target.value : null,
                })
              }
              className="admin-field min-w-0 flex-1 rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] py-2 pl-3 pr-8 text-sm text-heading focus:border-border-gold focus:outline-none"
            >
              <option value="">Any priority</option>
              {ROADMAP_PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={filters.readyOnly}
            onClick={() => update({ readyOnly: !filters.readyOnly })}
            className={chipClass(filters.readyOnly)}
          >
            Ready to pick up ({readyCount})
          </button>
          {hasCustomFilters ? (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_ROADMAP_FILTERS)}
              className="text-sm text-white-muted underline-offset-4 hover:text-heading hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-sm text-white-muted" aria-live="polite">
        Showing {visible.length} of {cards.length}
        {filters.status === "active" && !filters.query && !filters.category && !filters.priority && !filters.readyOnly
          ? ". Active is in progress, planned, and blocked."
          : "."}
      </p>

      {visible.length === 0 ? (
        <p className="mt-8 max-w-xl text-sm text-white-secondary">
          {hasCustomFilters
            ? "No cards match this search or these filters."
            : "No cards in this view yet."}{" "}
          {filters.query.trim() && filters.status !== "all" ? (
            <button
              type="button"
              onClick={() => update({ status: "all" })}
              className="underline underline-offset-4 hover:text-heading"
            >
              Search all cards
            </button>
          ) : hasCustomFilters ? (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_ROADMAP_FILTERS)}
              className="underline underline-offset-4 hover:text-heading"
            >
              Clear filters
            </button>
          ) : null}
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {grouped.map((group) => {
            const meta = FEATURE_STATUS_META[group.status];
            return (
              <section key={group.status} aria-labelledby={`roadmap-${group.status}`}>
                <div className="mb-4 flex flex-wrap items-baseline gap-3">
                  <h2
                    id={`roadmap-${group.status}`}
                    className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em] text-heading"
                  >
                    <span aria-hidden className={cn("h-2 w-2 rounded-full", STATUS_PIP[group.status])} />
                    {meta.label}
                  </h2>
                  <p className="text-sm text-white-muted">
                    {group.cards.length} · {meta.description}
                  </p>
                </div>
                <ul className="space-y-3">
                  {group.cards.map((card) => (
                    <li key={card.seedKey}>
                      <RoadmapCardRow card={card} query={filters.query} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoadmapCardRow({ card, query }: { card: PublicRoadmapCard; query: string }) {
  return (
    <details
      id={card.seedKey}
      className="group rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-5 py-4 backdrop-blur-md open:border-[var(--border-glass-hover)]"
      onToggle={(event) => {
        const hash = event.currentTarget.open ? card.seedKey : "";
        const filters = parseRoadmapSearchParams(new URLSearchParams(window.location.search));
        writeRoadmapUrl(filters, hash);
      }}
    >
      <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-3">
          <span aria-hidden className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", STATUS_PIP[card.status])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-heading">
                <Highlight text={card.title} query={query} />
              </h3>
              {card.ready ? (
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold">
                  Ready
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
              {card.category ? <span>{card.category}</span> : null}
              <span>{card.priority}</span>
              <span className="normal-case tracking-normal text-white-muted/80">{card.seedKey}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white-secondary group-open:hidden">
              <Highlight text={card.description} query={query} />
            </p>
          </div>
          <ChevronDown
            aria-hidden
            className="mt-1 h-4 w-4 shrink-0 text-white-muted transition-transform group-open:rotate-180"
          />
        </div>
      </summary>
      <div className="mt-3 border-t border-border-glass pt-3 pl-5">
        <p className="text-sm leading-relaxed text-white-secondary">
          <Highlight text={card.description} query={query} />
        </p>
        {card.acceptance.length ? (
          <ul className="mt-4 space-y-1.5">
            {card.acceptance.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-body">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
                <span>
                  <Highlight text={line} query={query} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {card.capabilities.length ? (
          <p className="mt-4 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
            {card.capabilities.join(" · ")}
          </p>
        ) : null}
      </div>
    </details>
  );
}
