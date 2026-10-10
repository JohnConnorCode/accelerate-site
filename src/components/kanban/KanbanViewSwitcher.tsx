"use client";

import { useState } from "react";
import { Columns3, List } from "lucide-react";
import { AdminViewSwitcher } from "@/components/admin/AdminViewSwitcher";

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
    <AdminViewSwitcher
      label="Board view"
      value={value}
      onChange={onChange}
      options={[
        { id: "board", label: "Board", icon: Columns3 },
        { id: "list", label: "List", icon: List },
      ]}
    />
  );
}
