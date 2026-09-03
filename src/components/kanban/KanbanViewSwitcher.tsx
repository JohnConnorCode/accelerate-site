"use client";

import { useState } from "react";
import { Columns3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type KanbanView = "board" | "list";

const STORAGE_PREFIX = "kanban-view:";

function readStoredView(boardKey: string, defaultView: KanbanView): KanbanView {
  if (typeof window === "undefined") return defaultView;
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + boardKey);
    return stored === "board" || stored === "list" ? stored : defaultView;
  } catch {
    return defaultView;
  }
}

/** Per-viewer convenience only (not synced data) — remembers the last view a
 * browser used for this board, matching Pipeline's existing Board/List
 * pattern generalized for every board. Read once via lazy initial state
 * (not an effect) so there's no cascading re-render on mount. */
export function useKanbanView(boardKey: string, defaultView: KanbanView = "board") {
  const [view, setView] = useState<KanbanView>(() => readStoredView(boardKey, defaultView));

  const update = (next: KanbanView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + boardKey, next);
    } catch {
      // Ignore — the view still updates for this render, just won't persist.
    }
  };

  return [view, update] as const;
}

export function KanbanViewSwitcher({
  value,
  onChange,
}: {
  value: KanbanView;
  onChange: (view: KanbanView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-black/[0.045] p-0.5 dark:bg-white/[0.06]">
      {(
        [
          { view: "board" as const, label: "Board", Icon: Columns3 },
          { view: "list" as const, label: "List", Icon: List },
        ]
      ).map(({ view, label, Icon }) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150",
            value === view
              ? "bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]",
          )}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}
