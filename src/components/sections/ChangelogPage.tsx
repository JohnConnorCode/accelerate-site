"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Wrench, Bug, Megaphone, Rss, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { cn } from "@/lib/utils";
import { changelogEntries } from "@/content/changelog";
import type { ChangelogEntry } from "@/lib/types";
import { formatDateOnly, getUtcMonthKey } from "@/lib/date-format";

const categoryConfig: Record<
  ChangelogEntry["category"],
  { label: string; icon: LucideIcon; accent: string }
> = {
  feature: { label: "Shipped", icon: Sparkles, accent: "text-gold" },
  improvement: { label: "Sharpened", icon: Wrench, accent: "text-white-muted" },
  fix: { label: "Fixed", icon: Bug, accent: "text-white-muted" },
  announcement: { label: "News", icon: Megaphone, accent: "text-white-muted" },
};

const categoryOrder = Object.keys(categoryConfig) as ChangelogEntry["category"][];

const fmtDate = (s: string) =>
  formatDateOnly(s, { year: "numeric", month: "long", day: "numeric" });

export function ChangelogPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ChangelogEntry["category"] | "all">("all");

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ChangelogEntry["category"], number>> = {};
    for (const entry of changelogEntries)
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    return counts;
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return changelogEntries.filter((entry) => {
      if (activeCategory !== "all" && entry.category !== activeCategory) return false;
      if (!normalizedQuery) return true;
      return (
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, activeCategory]);

  const grouped = filteredEntries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const key = getUtcMonthKey(entry.publishedAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const hasFilters = activeCategory !== "all" || query.trim().length > 0;

  return (
    <Section width="wide" className="page-offset-roomy">
      <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        {/* sticky left rail — the page identity travels with you */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Eyebrow className="mb-7">changelog</Eyebrow>
          <Heading size={2} as="h1" className="leading-[1.04]">
            What we&apos;ve been <span className="display-italic">building.</span>
          </Heading>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-white-secondary">
            New capabilities, sharper systems, and what we&apos;re shipping for the businesses we
            run alongside. We move fast and share the work.
          </p>
          <Link
            href="/changelog/rss.xml"
            data-cursor="link"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-border-glass px-4 py-2 text-sm font-medium text-heading transition-colors hover:border-border-gold hover:text-gold"
          >
            <Rss className="h-4 w-4 text-gold" />
            RSS feed
          </Link>

          <div className="mt-8">
            <label htmlFor="changelog-search" className="sr-only">
              Search the changelog
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
              <input
                id="changelog-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search updates…"
                className="admin-field w-full rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] py-2.5 pl-10 pr-9 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white-muted transition-colors hover:text-heading"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
                  activeCategory === "all"
                    ? "border-border-gold text-gold"
                    : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
                )}
              >
                All ({changelogEntries.length})
              </button>
              {categoryOrder.map((category) => {
                const count = categoryCounts[category];
                if (!count) return null;
                const config = categoryConfig[category];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
                      activeCategory === category
                        ? "border-border-gold text-gold"
                        : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
                    )}
                  >
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* timeline — vertical connector with month markers */}
        <div
          className="relative flex flex-col gap-12 border-l border-border-glass pl-8 sm:pl-10"
          aria-live="polite"
        >
          {months.length === 0 && (
            <p className="text-sm text-white-secondary">
              {hasFilters ? "No updates match your search or filter." : "No updates yet."}
            </p>
          )}
          {months.map((monthKey) => {
            const entries = grouped[monthKey] ?? [];
            const monthLabel = formatDateOnly(monthKey + "-01", { year: "numeric", month: "long" });
            return (
              <div key={monthKey} className="relative">
                {/* month node on the rail */}
                <span
                  aria-hidden
                  className="absolute -left-[2.45rem] top-1 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-[var(--bg-base)] sm:-left-[2.95rem]"
                />
                <p className="mb-5 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-gold">
                  {monthLabel}
                </p>
                <div className="flex flex-col gap-4">
                  {entries.map((entry, i) => {
                    const config = categoryConfig[entry.category];
                    const Icon = config.icon;
                    return (
                      <AnimateOnScroll
                        key={entry.id}
                        as="div"
                        delay={i * 0.04}
                        className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] p-6 backdrop-blur-md transition-colors hover:border-[var(--border-glass-hover)]"
                      >
                        <div className="flex items-start gap-4">
                          <span className={cn("mt-0.5 shrink-0", config.accent)}>
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-3">
                              <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-heading">
                                {entry.title}
                              </h3>
                              <span
                                className={cn(
                                  "font-mono text-[0.6rem] uppercase tracking-[0.18em]",
                                  config.accent,
                                )}
                              >
                                {config.label}
                              </span>
                            </div>
                            <p className="mb-2 text-sm leading-relaxed text-white-secondary">
                              {entry.description}
                            </p>
                            <p className="text-xs text-white-muted">{fmtDate(entry.publishedAt)}</p>
                          </div>
                        </div>
                      </AnimateOnScroll>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
