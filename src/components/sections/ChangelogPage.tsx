"use client";

import { motion } from "framer-motion";
import { Sparkles, Wrench, Bug, Megaphone, Rss } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { changelogEntries } from "@/content/changelog";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { ChangelogEntry } from "@/lib/types";

const categoryConfig: Record<
  ChangelogEntry["category"],
  { label: string; icon: LucideIcon; color: string }
> = {
  feature: { label: "New Feature", icon: Sparkles, color: "text-emerald-400" },
  improvement: { label: "Improvement", icon: Wrench, color: "text-blue-400" },
  fix: { label: "Bug Fix", icon: Bug, color: "text-orange-400" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-[var(--gold-base)]" },
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
  const grouped = changelogEntries.reduce<Record<string, typeof changelogEntries>>(
    (acc, entry) => {
      const date = new Date(entry.publishedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    },
    {}
  );

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge variant="gold" className="mb-4">
            Changelog
          </Badge>
          <h1
            className="text-3xl md:text-5xl font-bold text-white-primary mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            What&apos;s New at{" "}
            <span className="text-gold-gradient">Accelerate</span>
          </h1>
          <p className="text-lg text-white-secondary max-w-xl mx-auto mb-4">
            Product updates, new features, and improvements. We ship fast and
            share everything.
          </p>
          <Link
            href="/changelog/rss.xml"
            className="inline-flex items-center gap-2 text-sm text-[var(--gold-light)] hover:text-white transition-colors"
          >
            <Rss className="w-4 h-4" />
            RSS Feed
          </Link>
        </motion.div>

        {/* Timeline */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {months.map((monthKey) => {
            const entries = grouped[monthKey] ?? [];
            const date = new Date(monthKey + "-01");
            const monthLabel = date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            });

            return (
              <motion.div key={monthKey} variants={fadeUp} className="mb-12">
                <h2
                  className="text-lg font-bold text-[var(--gold-base)] mb-6"
                  style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
                >
                  {monthLabel}
                </h2>

                <div className="space-y-4">
                  {entries.map((entry) => {
                    const config = categoryConfig[entry.category];
                    const Icon = config.icon;

                    return (
                      <div
                        key={entry.id}
                        className="glass rounded-xl p-5 border border-[var(--border-glass)] hover:border-[var(--border-glass-hover)] transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn("mt-0.5 shrink-0", config.color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="text-base font-semibold text-white-primary">
                                {entry.title}
                              </h3>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full border",
                                entry.category === "feature" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
                                entry.category === "improvement" && "border-blue-400/30 bg-blue-400/10 text-blue-400",
                                entry.category === "fix" && "border-orange-400/30 bg-orange-400/10 text-orange-400",
                                entry.category === "announcement" && "border-[var(--border-gold)] bg-[var(--glass-gold-bg)] text-[var(--gold-light)]"
                              )}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm text-white-secondary mb-2">
                              {entry.description}
                            </p>
                            <p className="text-xs text-white-muted">
                              {formatDate(entry.publishedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
