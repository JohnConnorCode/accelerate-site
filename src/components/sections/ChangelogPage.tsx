"use client";

import { Sparkles, Wrench, Bug, Megaphone, Rss } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import { changelogEntries } from "@/content/changelog";
import { cn } from "@/lib/utils";
import type { ChangelogEntry } from "@/lib/types";

const categoryConfig: Record<
  ChangelogEntry["category"],
  { label: string; icon: LucideIcon; color: string }
> = {
  feature: { label: "New Feature", icon: Sparkles, color: "text-emerald-400" },
  improvement: { label: "Improvement", icon: Wrench, color: "text-blue-400" },
  fix: { label: "Bug Fix", icon: Bug, color: "text-orange-400" },
  announcement: {
    label: "Announcement",
    icon: Megaphone,
    color: "text-[var(--gold-base)]",
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ChangelogPage() {
  // Group entries by month
  const grouped = changelogEntries.reduce<
    Record<string, typeof changelogEntries>
  >((acc, entry) => {
    const date = new Date(entry.publishedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <>
      {/* Hero */}
      <PageHero
        label="Changelog"
        background="orbs"
        itemAnimation={fadeUp}
        title={
          <>
            What&apos;s New at{" "}
            <span className="text-gold-gradient">Accelerate</span>
          </>
        }
        description="Product updates, new features, and improvements. We ship fast and share everything."
      >
        <div className="mt-6">
          <Link
            href="/changelog/rss.xml"
            className="inline-flex items-center gap-2 text-sm text-[var(--gold-light)] hover:text-[var(--white-primary)] transition-colors"
          >
            <Rss className="w-4 h-4" />
            RSS Feed
          </Link>
        </div>
      </PageHero>

      <SectionDivider variant="fade" />

      {/* Timeline */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {months.map((monthKey, monthIndex) => {
            const entries = grouped[monthKey] ?? [];
            const date = new Date(monthKey + "-01");
            const monthLabel = date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            });

            return (
              <div key={monthKey}>
                {monthIndex > 0 && <SectionDivider variant="line" />}
                <AnimateOnScroll className="mb-4">
                  <h2 className="font-display text-lg font-bold text-[var(--gold-base)]">
                    {monthLabel}
                  </h2>
                </AnimateOnScroll>

                <StaggerContainer className="space-y-4 mb-12">
                  {entries.map((entry) => {
                    const config = categoryConfig[entry.category];
                    const Icon = config.icon;

                    return (
                      <AnimateOnScroll key={entry.id} variants={fadeUp}>
                        <div className="glass rounded-xl p-5 border border-[var(--border-glass)] hover:border-[var(--border-glass-hover)] transition-colors">
                          <div className="flex items-start gap-4">
                            <div
                              className={cn(
                                "mt-0.5 shrink-0",
                                config.color
                              )}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1 flex-wrap">
                                <h3 className="text-base font-semibold text-[var(--white-primary)]">
                                  {entry.title}
                                </h3>
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    config.color
                                  )}
                                >
                                  {config.label}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--white-secondary)] mb-2">
                                {entry.description}
                              </p>
                              <p className="text-xs text-[var(--white-muted)]">
                                {formatDate(entry.publishedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </AnimateOnScroll>
                    );
                  })}
                </StaggerContainer>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
