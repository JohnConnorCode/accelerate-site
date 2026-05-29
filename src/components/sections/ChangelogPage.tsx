"use client";

import Link from "next/link";
import { Sparkles, Wrench, Bug, Megaphone, Rss } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { cn } from "@/lib/utils";
import { changelogEntries } from "@/content/changelog";
import type { ChangelogEntry } from "@/lib/types";

const categoryConfig: Record<
  ChangelogEntry["category"],
  { label: string; icon: LucideIcon; accent: string }
> = {
  feature:      { label: "new feature",  icon: Sparkles,  accent: "text-emerald-400" },
  improvement:  { label: "improvement",  icon: Wrench,    accent: "text-sky-400" },
  fix:          { label: "fix",          icon: Bug,       accent: "text-amber-400" },
  announcement: { label: "announcement", icon: Megaphone, accent: "text-gold" },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function ChangelogPage() {
  const grouped = changelogEntries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const d = new Date(entry.publishedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Section width="wide" className="pt-32">
      <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        {/* sticky left rail — the page identity travels with you */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Eyebrow className="mb-7">changelog</Eyebrow>
          <Heading size={2} as="h1" className="leading-[1.04]">
            What&apos;s new at <span className="display-italic">Accelerate.</span>
          </Heading>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-white-secondary">
            Product updates, new features, and improvements. We ship fast and
            share everything.
          </p>
          <Link
            href="/changelog/rss.xml"
            data-cursor="link"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-border-glass px-4 py-2 text-sm font-medium text-heading transition-colors hover:border-border-gold hover:text-gold"
          >
            <Rss className="h-4 w-4 text-gold" />
            RSS feed
          </Link>
        </div>

        {/* timeline — vertical connector with month markers */}
        <div className="relative flex flex-col gap-12 border-l border-border-glass pl-8 sm:pl-10">
          {months.map((monthKey) => {
            const entries = grouped[monthKey] ?? [];
            const monthLabel = new Date(monthKey + "-01")
              .toLocaleDateString("en-US", { year: "numeric", month: "long" });
            return (
              <div key={monthKey} className="relative">
                {/* month node on the rail */}
                <span aria-hidden className="absolute -left-[2.45rem] top-1 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-[var(--bg-base)] sm:-left-[2.95rem]" />
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
                              <span className={cn("font-mono text-[0.6rem] uppercase tracking-[0.18em]", config.accent)}>
                                {config.label}
                              </span>
                            </div>
                            <p className="mb-2 text-sm leading-relaxed text-white-secondary">{entry.description}</p>
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
