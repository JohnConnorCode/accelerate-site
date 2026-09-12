"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { KanbanColumnRecord } from "@/lib/kanban/types";

/**
 * Explicit regional navigation at every width. Revealing the selected chip
 * scrolls this strip only; manual board scrolling never navigates an ancestor.
 */
export function KanbanColumnPager({
  columns,
  counts,
  activeKey,
  onSelect,
}: {
  columns: KanbanColumnRecord[];
  counts: Record<string, number>;
  activeKey: string | null;
  onSelect: (columnKey: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    const root = listRef.current;
    if (root && selected)
      root.scrollTo({
        left: selected.offsetLeft - root.offsetLeft - (root.clientWidth - selected.clientWidth) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [activeKey]);
  if (!columns.length) return null;
  return (
    <div className="min-w-0">
      <div
        ref={listRef}
        role="group"
        aria-label="Board columns"
        className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {columns.map((column) => {
          const selected = column.column_key === activeKey;
          const count = counts[column.column_key] ?? 0;
          return (
            <button
              key={column.column_key}
              type="button"
              aria-pressed={selected}
              data-selected={selected}
              onClick={() => onSelect(column.column_key)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold",
                "transition-colors duration-150",
                selected
                  ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                  : "bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", column.color || "bg-slate-400")}
                aria-hidden="true"
              />
              {column.label}
              <span className="font-mono text-[10px] tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
