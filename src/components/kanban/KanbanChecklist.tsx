"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Square, SquareCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

interface KanbanChecklistProps {
  items: KanbanChecklistItem[];
  /** Card face: remaining items only, no editor chrome. */
  compact?: boolean;
  compactLimit?: number;
  disabled?: boolean;
  onToggle?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onRemove?: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  onAdd?: (title: string) => void;
  addPlaceholder?: string;
}

/**
 * Shared checklist used by Feature Board cards/dialogs. Pipeline and content
 * boards can pass the same `{id,title,done}` shape when they grow checklists.
 */
export function KanbanChecklist({
  items,
  compact = false,
  compactLimit = 3,
  disabled = false,
  onToggle,
  onRename,
  onRemove,
  onMove,
  onAdd,
  addPlaceholder = "Add a subtask",
}: KanbanChecklistProps) {
  const [draft, setDraft] = useState("");
  const visible = compact ? items.filter((item) => !item.done).slice(0, compactLimit) : items;
  const hiddenCount = compact
    ? Math.max(0, items.filter((item) => !item.done).length - visible.length)
    : 0;

  const add = () => {
    const title = draft.trim();
    if (!title || !onAdd) return;
    onAdd(title);
    setDraft("");
  };

  return (
    <div
      className="space-y-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {visible.length > 0 && (
        <ul className="space-y-1">
          {visible.map((item, index) => (
            <li key={item.id} className="flex items-start gap-1.5">
              <button
                type="button"
                disabled={disabled || !onToggle}
                aria-pressed={item.done}
                aria-label={item.done ? `Mark "${item.title}" open` : `Complete "${item.title}"`}
                onClick={() => onToggle?.(item.id)}
                className={cn(
                  "grid shrink-0 place-items-center rounded-md text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-40",
                  compact ? "size-6" : "mt-0.5 size-7",
                )}
              >
                {item.done ? (
                  <SquareCheck className={compact ? "size-3.5" : "size-4"} />
                ) : (
                  <Square className={compact ? "size-3.5" : "size-4"} />
                )}
              </button>
              {compact || !onRename ? (
                <span
                  className={cn(
                    "min-w-0 flex-1 leading-5",
                    compact ? "pt-0.5 text-[11px]" : "pt-1 text-sm",
                    item.done && "text-[var(--admin-muted)] line-through",
                  )}
                >
                  {item.title}
                </span>
              ) : (
                <ChecklistTitle item={item} disabled={disabled} onRename={onRename} />
              )}
              {!compact && onMove && (
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={`Move ${item.title} up`}
                    onClick={() => onMove(item.id, -1)}
                    className="grid size-5 place-items-center text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === visible.length - 1}
                    aria-label={`Move ${item.title} down`}
                    onClick={() => onMove(item.id, 1)}
                    className="grid size-5 place-items-center text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </span>
              )}
              {!compact && onRemove && (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${item.title}`}
                  onClick={() => onRemove(item.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className="pl-7 text-[10px] font-medium text-[var(--admin-muted)]">
          +{hiddenCount} more
        </p>
      )}
      {!compact && onAdd && (
        <div className="flex gap-2 pt-0.5">
          <input
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            maxLength={180}
            placeholder={addPlaceholder}
            className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)]/65 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10"
          />
          <button
            type="button"
            onClick={add}
            disabled={disabled || !draft.trim()}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-[var(--admin-border)] px-3 text-xs font-semibold text-[var(--admin-ink)] disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ChecklistTitle({
  item,
  disabled,
  onRename,
}: {
  item: KanbanChecklistItem;
  disabled?: boolean;
  onRename: (id: string, title: string) => void;
}) {
  return (
    <input
      key={item.title}
      defaultValue={item.title}
      disabled={disabled}
      aria-label={`Subtask title: ${item.title}`}
      onBlur={(event) => {
        const next = event.target.value.trim();
        if (next === item.title) return;
        onRename(item.id, next);
      }}
      className={cn(
        "min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm leading-5 outline-none focus:bg-[var(--admin-surface-subtle)]",
        item.done && "text-[var(--admin-muted)] line-through",
      )}
    />
  );
}
