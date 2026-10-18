"use client";

import Link from "@/components/admin/AdminLink";
import { motion, useReducedMotion } from "framer-motion";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminSparkline } from "@/components/admin/charts/Sparkline";

export interface MetricComparison {
  /** Named comparison window, e.g. "vs last month". Always shown with a delta. */
  label: string;
  direction?: "up" | "down" | "flat";
  /** Formatted delta text, e.g. "+26.35%". */
  text?: string;
}

export interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  icon?: LucideIcon;
  index?: number;
  /** Optional supporting caption under the value. */
  note?: string;
  /**
   * `estimate` tints the surface so a projection is never read as a measurement;
   * `attention` raises it for a figure that needs review.
   */
  tone?: "default" | "estimate" | "attention";
  /** A named comparison. When omitted no delta is shown. */
  comparison?: MetricComparison;
  /** Optional trend values drawn as a sparkline. */
  sparkline?: number[];
  /** When the figure was last refreshed, e.g. "Updated 4 min ago". */
  freshness?: string;
  /** Link to the records behind the figure. */
  href?: string;
  state?: "ready" | "unknown";
  unknownMessage?: string;
  className?: string;
  /** @deprecated Use `comparison`. Rendered as plain muted text when no comparison is given. */
  change?: string;
  /** @deprecated Use `comparison.direction`. */
  trend?: "up" | "down" | "neutral";
}

function DirectionMark({ direction }: { direction: NonNullable<MetricComparison["direction"]> }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return <Icon className="h-3 w-3 shrink-0" aria-hidden />;
}

/**
 * The one KPI primitive.
 *
 * Renders a labelled value with an optional named comparison, sparkline,
 * freshness stamp and provenance link. A delta is only ever shown together
 * with its comparison window, so a dashboard never shows an unlabelled number.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  index = 0,
  note,
  tone = "default",
  comparison,
  sparkline,
  freshness,
  href,
  state = "ready",
  unknownMessage = "Not available",
  className,
  change,
  trend,
}: StatCardProps) {
  const reducedMotion = useReducedMotion();
  const direction =
    comparison?.direction ?? (trend === "up" ? "up" : trend === "down" ? "down" : undefined);
  const hasComparison = Boolean(comparison?.label.trim());
  const unavailable =
    state === "unknown" ||
    value === null ||
    value === undefined ||
    value === "—" ||
    (typeof value === "number" && !Number.isFinite(value));

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: index * 0.04, duration: 0.24 }}
      className="h-full"
    >
      <AdminSurface
        padding="lg"
        tone={tone === "attention" ? "attention" : "default"}
        className={cn(
          "flex h-full flex-col",
          tone === "estimate" && "bg-[var(--admin-accent-soft)]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="admin-eyebrow">{label}</span>
          {Icon ? <Icon className="size-4 text-[var(--admin-muted)]" aria-hidden /> : null}
        </div>

        {unavailable ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">{unknownMessage}</p>
        ) : (
          <p className="admin-stat-value mt-3">{value}</p>
        )}

        {note ? (
          <p className="admin-copy mt-1.5 max-w-[32ch] text-pretty text-[11px] leading-4">{note}</p>
        ) : null}

        {hasComparison && !unavailable ? (
          <p className={cn("mt-2 flex items-center gap-1 text-xs", "text-[var(--admin-ink)]")}>
            {direction ? <DirectionMark direction={direction} /> : null}
            {comparison?.text ? <span className="tabular-nums">{comparison.text}</span> : null}
            <span className="text-[var(--admin-muted)]">{comparison?.label}</span>
          </p>
        ) : change && !unavailable ? (
          <p className="admin-copy mt-2 text-xs">{change}</p>
        ) : null}

        {!unavailable && sparkline && sparkline.length > 0 ? (
          <div className="mt-3">
            <AdminSparkline data={sparkline} width={120} label={`${label} trend`} />
          </div>
        ) : null}

        {freshness || href ? (
          <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] text-[var(--admin-muted)]">
            <span>{freshness}</span>
            {href ? (
              <Link
                href={href}
                className="inline-flex min-h-11 items-center font-medium text-[var(--admin-ink)] underline underline-offset-4"
              >
                View records
              </Link>
            ) : null}
          </div>
        ) : null}
      </AdminSurface>
    </motion.div>
  );
}
