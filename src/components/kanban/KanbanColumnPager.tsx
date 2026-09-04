"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { KanbanColumnRecord } from "@/lib/kanban/types";

/**
 * Phone-first column switcher. One column is already full-width in the
 * board scroller; these chips jump to it without requiring a horizontal
 * swipe guess. Hidden from md up, where every column is on screen.
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
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeKey]);
  if (!columns.length) return null;
  return (
    <div className="md:hidden">
      <div
        ref={listRef}
        role="tablist"
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
              role="tab"
              aria-selected={selected}
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
              <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
