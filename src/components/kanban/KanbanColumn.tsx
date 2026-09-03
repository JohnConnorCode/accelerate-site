"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CircleDot, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import { KanbanCannotDeleteLastRoleError, KanbanColumnHasCardsError } from "@/lib/kanban/api";
import type { KanbanColumnRecord } from "@/lib/kanban/types";
import { KanbanCard, type KanbanCardRenderOpts } from "./KanbanCard";

interface KanbanColumnProps<T> {
  column: KanbanColumnRecord;
  otherColumns: KanbanColumnRecord[];
  items: T[];
  getItemId: (item: T) => string;
  renderCard: (item: T, opts: KanbanCardRenderOpts) => React.ReactNode;
  dragDisabled: boolean;
  emptyHint?: string;
  onRename?: (label: string) => Promise<unknown>;
  onDelete?: (options?: { reassignTo?: string }) => Promise<void>;
}

interface ColumnMenuProps {
  columnLabel: string;
  hasCards: boolean;
  otherColumns: KanbanColumnRecord[];
  onDelete: (options?: { reassignTo?: string }) => Promise<void>;
}

function ColumnMenu({ columnLabel, hasCards, otherColumns, onDelete }: ColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState(otherColumns[0]?.column_key ?? "");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const runDelete = async (options?: { reassignTo?: string }) => {
    setBusy(true);
    try {
      await onDelete(options);
      setReassignOpen(false);
      setOpen(false);
    } catch (error) {
      if (error instanceof KanbanColumnHasCardsError) {
        toast.error(error.message);
        setReassignOpen(true);
      } else if (error instanceof KanbanCannotDeleteLastRoleError) {
        toast.error(error.message);
        setReassignOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = () => {
    if (hasCards) {
      setReassignTo(otherColumns[0]?.column_key ?? "");
      setReassignOpen(true);
      setOpen(false);
      return;
    }
    if (!window.confirm("Delete this empty column? This cannot be undone.")) return;
    void runDelete();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Column options for ${columnLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "grid shrink-0 place-items-center rounded-xl text-[var(--admin-muted)]",
          "transition-[background-color,color,transform] duration-150",
          "hover:bg-black/[0.045] hover:text-[var(--admin-ink)]",
          "active:scale-[0.96]",
          "dark:hover:bg-white/[0.06]",
          "size-10",
          "sm:size-8",
        )}
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-20 mt-1 rounded-xl bg-[var(--admin-surface)] p-1",
            "shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]",
            "ring-1 ring-[var(--admin-border)]",
            "min-w-40",
            "sm:min-w-36",
            "right-0",
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300"
          >
            <Trash2 className="size-3.5" /> Delete column
          </button>
        </div>
      )}
      <AdminDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign cards before deleting"
        labelledBy="kanban-reassign-title"
        maxWidth="sm"
      >
        <div className="w-full rounded-[20px] bg-[var(--admin-surface)] p-5 shadow-2xl">
          <h2
            id="kanban-reassign-title"
            className="text-base font-semibold text-[var(--admin-ink)]"
          >
            Move cards to another column
          </h2>
          <p className="admin-copy mt-1.5 text-xs leading-5">
            This column still has cards on it. Choose where they should go before the column is
            deleted.
          </p>
          {otherColumns.length ? (
            <>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                aria-label="Move cards to column"
                className="mt-4 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
              >
                {otherColumns.map((option) => (
                  <option key={option.column_key} value={option.column_key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignOpen(false)}
                  className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !reassignTo}
                  onClick={() => void runDelete({ reassignTo })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Move cards & delete
                </button>
              </div>
            </>
          ) : (
            <p className="admin-copy mt-4 text-xs">
              There is no other column to move these cards to. Add another column first.
            </p>
          )}
        </div>
      </AdminDialog>
    </div>
  );
}

/**
 * Mobile-first Kanban column component with touch-optimized interactions,
 * keyboard navigation support, and responsive design.
 */
export function KanbanColumn<T>({
  column,
  otherColumns,
  items,
  getItemId,
  renderCard,
  dragDisabled,
  emptyHint = "Drop a card here",
  onRename,
  onDelete,
}: KanbanColumnProps<T>) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.column_key}`,
    data: { type: "column", columnKey: column.column_key },
  });
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(column.label);
  const [savingLabel, setSavingLabel] = useState(false);

  useEffect(() => {
    if (!editing) setLabelDraft(column.label);
  }, [column.label, editing]);

  const commitLabel = async () => {
    const next = labelDraft.trim();
    if (!next || next === column.label || !onRename) {
      setEditing(false);
      setLabelDraft(column.label);
      return;
    }
    setSavingLabel(true);
    try {
      await onRename(next);
      setEditing(false);
    } catch {
      // useKanbanColumns already toasts the failure.
    } finally {
      setSavingLabel(false);
    }
  };

  return (
    <section
      className={cn("w-full max-w-[340px] shrink-0 snap-start lg:snap-none", "mx-auto sm:mx-0")}
      aria-labelledby={`column-${column.column_key}`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <div className="group flex min-h-10 items-center gap-1.5">
            <span
              className={cn("size-2 shrink-0 rounded-full", column.color || "bg-slate-400")}
              aria-hidden="true"
            />
            {editing ? (
              <input
                autoFocus
                value={labelDraft}
                disabled={savingLabel}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => void commitLabel()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitLabel();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                    setLabelDraft(column.label);
                  }
                }}
                maxLength={60}
                className="min-h-7 w-full min-w-0 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-2 text-sm font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
                placeholder="Column title..."
              />
            ) : (
              <h2
                id={`column-${column.column_key}`}
                className="truncate text-sm font-semibold text-[var(--admin-ink)]"
              >
                {column.label}
              </h2>
            )}
            {!editing && onRename && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Rename ${column.label}`}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)]",
                  "transition-[opacity,color] duration-150",
                  "hover:text-[var(--admin-ink)]",
                  "focus-visible:opacity-100",
                  "group-hover:opacity-100",
                )}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-full bg-black/[0.045] px-2 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]"
            aria-label={`${items.length} items`}
          >
            {items.length}
          </span>
          {onDelete && (
            <ColumnMenu
              columnLabel={column.label}
              hasCards={items.length > 0}
              otherColumns={otherColumns}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[240px] space-y-2.5 rounded-2xl bg-black/[0.018] p-2.5",
          "shadow-[inset_0_0_0_1px_var(--admin-border)]",
          "transition-[background-color,box-shadow] duration-150",
          "dark:bg-white/[0.018]",
          isOver &&
            !dragDisabled &&
            "bg-amber-500/[0.055] shadow-[inset_0_0_0_1px_rgba(184,134,11,0.38),0_12px_30px_-24px_rgba(90,60,0,0.5)] dark:bg-amber-300/[0.045]",
        )}
        aria-label={`Column: ${column.label}. Drop zone`}
      >
        <SortableContext
          items={items.map((item) => getItemId(item))}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <KanbanCard
              key={getItemId(item)}
              item={item}
              id={getItemId(item)}
              columnKey={column.column_key}
              disabled={dragDisabled}
              renderCard={renderCard}
            />
          ))}
        </SortableContext>

        {!items.length && (
          <div
            className={cn(
              "grid min-h-40 place-items-center rounded-xl",
              "transition-all duration-200",
              isOver && !dragDisabled && "scale-105 bg-amber-500/[0.08]",
            )}
          >
            <div className="text-center">
              <CircleDot
                className={cn(
                  "mx-auto size-4 text-[var(--admin-muted)]/55",
                  isOver && !dragDisabled && "animate-pulse",
                )}
                aria-hidden="true"
              />
              <p className="admin-copy mt-2 text-xs">{emptyHint}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
