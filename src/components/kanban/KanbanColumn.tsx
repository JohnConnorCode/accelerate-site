"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CircleDot, Gauge, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import { KanbanCannotDeleteLastRoleError, KanbanColumnHasCardsError } from "@/lib/kanban/api";
import { parseWipLimit, type KanbanColumnMetadata, type KanbanColumnRecord } from "@/lib/kanban/types";
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
  onUpdateMetadata?: (metadata: KanbanColumnMetadata) => Promise<unknown>;
  onQuickAdd?: (title: string) => Promise<unknown>;
  quickAddLabel?: string;
}

interface ColumnMenuProps {
  columnLabel: string;
  hasCards: boolean;
  otherColumns: KanbanColumnRecord[];
  wipLimit: number | null;
  onDelete?: (options?: { reassignTo?: string }) => Promise<void>;
  onSetWipLimit?: (limit: number | null) => Promise<unknown>;
}

function ColumnMenu({
  columnLabel,
  hasCards,
  otherColumns,
  wipLimit,
  onDelete,
  onSetWipLimit,
}: ColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [wipOpen, setWipOpen] = useState(false);
  const [wipDraft, setWipDraft] = useState(wipLimit ? String(wipLimit) : "");
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
    if (!onDelete) return;
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
    if (!onDelete) return;
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
          {onSetWipLimit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setWipDraft(wipLimit ? String(wipLimit) : "");
                setWipOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--admin-ink)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              <Gauge className="size-3.5" /> WIP limit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={handleDeleteClick}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300"
            >
              <Trash2 className="size-3.5" /> Delete column
            </button>
          )}
        </div>
      )}
      <AdminDialog
        open={wipOpen}
        onClose={() => setWipOpen(false)}
        title="Column WIP limit"
        labelledBy="kanban-wip-title"
        maxWidth="sm"
      >
        <div className="w-full rounded-[20px] bg-[var(--admin-surface)] p-5 shadow-2xl">
          <h2 id="kanban-wip-title" className="text-base font-semibold text-[var(--admin-ink)]">
            Work-in-progress limit
          </h2>
          <p className="admin-copy mt-1.5 text-xs leading-5">
            Soft cap for this column. Over-limit counts turn red so you can see overload; cards can still move.
          </p>
          <input
            type="number"
            min={1}
            max={99}
            value={wipDraft}
            onChange={(event) => setWipDraft(event.target.value)}
            placeholder="No limit"
            aria-label="WIP limit"
            className="mt-4 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setWipOpen(false)}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !onSetWipLimit}
              onClick={() => {
                if (!onSetWipLimit) return;
                const parsed = Number.parseInt(wipDraft, 10);
                void (async () => {
                  setBusy(true);
                  try {
                    await onSetWipLimit(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                    setWipOpen(false);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Save limit
            </button>
          </div>
        </div>
      </AdminDialog>
      <AdminDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign cards before deleting"
        labelledBy="kanban-reassign-title"
        maxWidth="sm"
      >
        <div className="w-full rounded-[20px] bg-[var(--admin-surface)] p-5 shadow-2xl">
          <h2 id="kanban-reassign-title" className="text-base font-semibold text-[var(--admin-ink)]">
            Move cards to another column
          </h2>
          <p className="admin-copy mt-1.5 text-xs leading-5">
            This column still has cards on it. Choose where they should go before the column is deleted.
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
function ColumnQuickAdd({
  onAdd,
  label = "Add card",
}: {
  onAdd: (title: string) => Promise<unknown>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setTitle("");
  };

  const submit = async () => {
    const next = title.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      await onAdd(next);
      close();
    } catch {
      // Caller toasts.
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:bg-black/[0.04] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.05]"
      >
        <Plus className="size-3.5" /> {label}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        autoFocus
        value={title}
        disabled={saving}
        maxLength={180}
        placeholder={label}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") close();
        }}
        className="min-h-9 w-full min-w-0 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
      />
      <button
        type="button"
        disabled={!title.trim() || saving}
        onClick={() => void submit()}
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--admin-ink)] px-2.5 text-[11px] font-semibold text-[var(--admin-surface)] disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
      </button>
    </div>
  );
}

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
  onUpdateMetadata,
  onQuickAdd,
  quickAddLabel,
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
      className={cn(
        "min-w-0 shrink-0 snap-center",
        "w-[calc(100cqw-1.5rem)]",
        "md:w-80 md:snap-start",
      )}
      aria-labelledby={`column-${column.column_key}`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <div className="group flex min-h-10 items-center gap-1.5">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                column.color || "bg-slate-400",
              )}
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
                className="min-h-7 w-full min-w-0 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-2 text-sm font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
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
          {(() => {
            const wipLimit = parseWipLimit(column.metadata);
            const overLimit = wipLimit != null && items.length > wipLimit;
            return (
              <span
                className={cn(
                  "rounded-full px-2 py-1 font-mono text-[10px] tabular-nums",
                  overLimit
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
                )}
                aria-label={
                  wipLimit
                    ? `${items.length} of ${wipLimit} work-in-progress slots${overLimit ? ", over limit" : ""}`
                    : `${items.length} items`
                }
              >
                {wipLimit ? `${items.length}/${wipLimit}` : items.length}
              </span>
            );
          })()}
          {(onDelete || onUpdateMetadata) && (
            <ColumnMenu
              columnLabel={column.label}
              hasCards={items.length > 0}
              otherColumns={otherColumns}
              wipLimit={parseWipLimit(column.metadata)}
              onDelete={onDelete}
              onSetWipLimit={
                onUpdateMetadata
                  ? (limit) =>
                      onUpdateMetadata({
                        ...column.metadata,
                        wipLimit: limit,
                      })
                  : undefined
              }
            />
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[240px] flex-col rounded-2xl bg-black/[0.018] p-2.5",
          "shadow-[inset_0_0_0_1px_var(--admin-border)]",
          "transition-[background-color,box-shadow] duration-150",
          "dark:bg-white/[0.018]",
          isOver && !dragDisabled &&
            "bg-amber-500/[0.055] shadow-[inset_0_0_0_1px_rgba(184,134,11,0.38),0_12px_30px_-24px_rgba(90,60,0,0.5)] dark:bg-amber-300/[0.045]",
        )}
        aria-label={`Column: ${column.label}. Drop zone`}
      >
        <div
          className={cn(
            "min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain",
            "[scrollbar-width:thin] [scrollbar-color:var(--admin-border)_transparent]",
            "max-h-[min(62dvh,calc(100dvh-18rem))]",
          )}
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
                "grid place-items-center rounded-xl",
                onQuickAdd ? "min-h-24" : "min-h-40",
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
        {onQuickAdd && (
          <div className="shrink-0 border-t border-[var(--admin-border)]/70 pt-1.5">
            <ColumnQuickAdd onAdd={onQuickAdd} label={quickAddLabel} />
          </div>
        )}
      </div>
    </section>
  );
}
