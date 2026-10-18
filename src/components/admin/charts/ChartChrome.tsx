"use client";

import type { TooltipContentProps } from "recharts";
import { cn } from "@/lib/utils";

export interface ChartTooltipProps extends Omit<TooltipContentProps, "formatter"> {
  /** Formats a series value for display. Receives the raw recharts value. */
  formatter?: (value: unknown, name: string) => string;
}

function formatFallback(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((part) => formatFallback(part)).join(" – ");
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/** Shared tooltip content. Use via `<Tooltip content={(props) => <ChartTooltip {...props} />} />`. */
export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-surface admin-surface--outlined px-2.5 py-2">
      {label !== undefined && label !== null ? (
        <p className="admin-eyebrow mb-1.5">{String(label)}</p>
      ) : null}
      <ul className="grid gap-1">
        {payload.map((entry, index) => {
          const name = String(entry.name ?? entry.dataKey ?? "Value");
          const value = formatter ? formatter(entry.value, name) : formatFallback(entry.value);
          return (
            <li key={`${name}-${index}`} className="flex items-center gap-2 text-xs tabular-nums">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-sm"
                style={{ background: entry.color ?? "var(--admin-accent)" }}
              />
              <span className="text-[var(--admin-muted)]">{name}</span>
              <span className="ml-auto font-semibold text-[var(--admin-ink)]">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ChartLegendItem {
  label: string;
  color: string;
  value?: string;
}

/**
 * Shared inline legend with values.
 *
 * The legend carries the value as text, so status is never communicated by
 * color alone.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs">
          <span aria-hidden className="size-2 rounded-sm" style={{ background: item.color }} />
          <span className="text-[var(--admin-muted)]">{item.label}</span>
          {item.value ? (
            <span className="font-semibold tabular-nums text-[var(--admin-ink)]">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
