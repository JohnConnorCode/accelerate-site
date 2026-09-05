"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
  pointerWithin,
  type Announcements,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useKanbanDnd, type KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import type { KanbanColumnMetadata, KanbanColumnRecord } from "@/lib/kanban/types";
import { cn } from "@/lib/utils";
import { AddColumnInline } from "./AddColumnInline";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanColumnPager } from "./KanbanColumnPager";
import type { KanbanCardRenderOpts } from "./KanbanCard";

export type { KanbanCardRenderOpts } from "./KanbanCard";

export interface KanbanBoardProps<T> {
  columns: KanbanColumnRecord[];
  items: T[];
  getItemId: (item: T) => string;
  getItemColumnKey: (item: T) => string;
  getItemSortOrder: (item: T) => number;
  /** Short human label for screen-reader drag announcements ("Q3 rollout").
   * Falls back to "Card" when omitted. */
  getItemLabel?: (item: T) => string;
  /** Produces an updated copy of `item` positioned at `columnKey`/`sortOrder`.
   * Generic `T` means KanbanBoard can't mutate fields itself. */
  setItemPosition: (item: T, columnKey: string, sortOrder: number) => T;
  renderCard: (item: T, opts: KanbanCardRenderOpts) => ReactNode;
  renderCardOverlay?: (item: T) => ReactNode;
  onReorder: (updates: KanbanReorderUpdate[]) => Promise<void>;
  /** Optional veto for cross-column moves (e.g. Pipeline's stage-transition
   * rules). Omit it and cross-column drags behave exactly like same-column
   * ones — straight through to `onReorder`. */
  onCrossColumnMove?: (item: T, fromColumnKey: string, toColumnKey: string) => Promise<boolean>;
  dragDisabled?: boolean;
  dragDisabledReason?: string;
  emptyColumnHint?: string;
  /** Column-management, wired to a `useKanbanColumns(...)` instance's
   * mutations. Any of these can be omitted to disable that affordance
   * (e.g. a read-only board renders columns with no rename/delete/add UI). */
  onAddColumn?: (input: { label: string; metadata?: KanbanColumnMetadata }) => Promise<unknown>;
  addColumnExtraFields?: ReactNode;
  addColumnTileLabel?: string;
  onRenameColumn?: (columnKey: string, label: string) => Promise<unknown>;
  onDeleteColumn?: (columnKey: string, options?: { reassignTo?: string }) => Promise<void>;
  /** Merge-friendly column metadata write (WIP limits, board-specific fields). */
  onUpdateColumnMetadata?: (columnKey: string, metadata: KanbanColumnMetadata) => Promise<unknown>;
  /** Inline composer at the foot of a column. Omit to hide it. */
  onQuickAdd?: (columnKey: string, title: string) => Promise<unknown>;
  quickAddLabel?: string;
  className?: string;
  footer?: ReactNode;
}

/**
 * Generic board shell: owns the `DndContext` (same sensors/collision/
 * measuring/DragOverlay config as the Feature Board) and the optimistic
 * preview-then-commit-then-rollback state machine via `useKanbanDnd`, renders
 * one `KanbanColumn` per column plus a trailing `AddColumnInline` tile, and
 * leaves every card's markup to the caller's `renderCard`.
 */
export function KanbanBoard<T>({
  columns,
  items,
  getItemId,
  getItemColumnKey,
  getItemSortOrder,
  getItemLabel,
  setItemPosition,
  renderCard,
  renderCardOverlay,
  onReorder,
  onCrossColumnMove,
  dragDisabled = false,
  dragDisabledReason,
  emptyColumnHint,
  onAddColumn,
  addColumnExtraFields,
  addColumnTileLabel,
  onRenameColumn,
  onDeleteColumn,
  onUpdateColumnMetadata,
  onQuickAdd,
  quickAddLabel,
  className,
  footer,
}: KanbanBoardProps<T>) {
  const {
    getColumnItems,
    sensors,
    activeId,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    cancelDrag,
  } = useKanbanDnd<T>({
    items,
    columns,
    getItemId,
    getItemColumnKey,
    getItemSortOrder,
    setItemPosition,
    onReorder,
    onCrossColumnMove,
    disabled: dragDisabled,
  });

  // closestCorners alone misresolves a drag into an EMPTY column that sits
  // next to a populated one: it compares corner-to-corner distance against
  // the neighboring column's actual CARD rectangles, which can score closer
  // than the empty column's own (larger, sparser) droppable rect, silently
  // dropping the card one column over from wherever the pointer actually is.
  // pointerWithin checks whether the pointer is literally inside a
  // droppable's rect, which is unambiguous for this case; fall back to
  // closestCorners only when the pointer isn't within any droppable (e.g.
  // a gap/padding sliver mid-drag).
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
  }, []);

  // Same stability rule as `accessibility` below: never hand DndContext a
  // fresh object identity on every render.
  const measuring = useMemo(
    () => ({ droppable: { strategy: MeasuringStrategy.Always } as const }),
    [],
  );

  // Screen-reader narration for every drag phase. dnd-kit renders these
  // into its own aria-live region; sighted users see the DragOverlay and
  // the highlighted column instead. Labels come from `getItemLabel` so
  // each board announces its own domain language. Column announcements
  // only name column droppables (`column:*`), which are stable for the
  // whole drag — naming a card target's column could be stale mid-drag
  // while the optimistic preview is in flight, so those stay silent and
  // the drop summary names the column only when it is unambiguous.
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(getItemId(item), getItemLabel?.(item) ?? "Card");
    return map;
  }, [items, getItemId, getItemLabel]);
  const columnLabelByKey = useMemo(() => {
    const map = new Map(columns.map((column) => [column.column_key, column.label]));
    return map;
  }, [columns]);
  const labelOf = useCallback(
    (id: string | number) => labelById.get(String(id)) ?? "Card",
    [labelById],
  );
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart({ active }) {
        return `Picked up ${labelOf(active.id)}. Use the arrow keys to move it, space to drop it, escape to cancel.`;
      },
      onDragOver({ active, over }) {
        if (!over) return undefined;
        const overId = String(over.id);
        if (!overId.startsWith("column:")) return undefined;
        const label = columnLabelByKey.get(overId.slice("column:".length)) ?? "a column";
        return `${labelOf(active.id)} is over ${label}.`;
      },
      onDragEnd({ active, over }) {
        if (!over)
          return `${labelOf(active.id)} was dropped outside the board. No changes were made.`;
        const overId = String(over.id);
        if (overId.startsWith("column:")) {
          const label = columnLabelByKey.get(overId.slice("column:".length)) ?? "the column";
          return `${labelOf(active.id)} was dropped into ${label}.`;
        }
        return `${labelOf(active.id)} was dropped. The board now shows the new order.`;
      },
      onDragCancel({ active }) {
        return `${labelOf(active.id)} was not moved. No changes were made.`;
      },
    }),
    [columnLabelByKey, labelOf],
  );
  // Memoized as a whole: DndContext reacts to accessibility identity, so an
  // inline object literal here re-fires its internal announcement machinery
  // on every parent render — under drag load that snowballs into a
  // maximum-update-depth crash inside SortableContext. This exact crash was
  // caught by the kanban browser QA (error boundary screenshot) and fixed
  // by stabilizing this reference.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeColumnKey, setActiveColumnKey] = useState(columns[0]?.column_key ?? null);
  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const column of columns) counts[column.column_key] = getColumnItems(column.column_key).length;
    return counts;
  }, [columns, getColumnItems]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>("section[aria-labelledby]")];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const labelledBy = visible?.target.getAttribute("aria-labelledby") ?? "";
        const key = labelledBy.startsWith("column-") ? labelledBy.slice("column-".length) : null;
        if (key) setActiveColumnKey(key);
      },
      { root, threshold: [0.45, 0.7] },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [columns]);

  const scrollToColumn = useCallback((columnKey: string) => {
    const root = scrollerRef.current;
    const section = root?.querySelector<HTMLElement>(`[aria-labelledby="column-${columnKey}"]`);
    if (root && section) {
      const delta = section.getBoundingClientRect().left - root.getBoundingClientRect().left;
      root.scrollTo({ left: Math.max(0, root.scrollLeft + delta - 8), behavior: "smooth" });
    }
    setActiveColumnKey(columnKey);
  }, []);

  const accessibility = useMemo(
    () => ({
      announcements,
      screenReaderInstructions: {
        draggable:
          "Press space to lift this card. Use the arrow keys to move it between columns, space to drop it, escape to cancel.",
      },
    }),
    [announcements],
  );

  return (
    <div className={cn("space-y-3", className)}>
      {dragDisabled && dragDisabledReason && (
        <p className="rounded-lg bg-[var(--admin-warning-soft)] px-3 py-2 text-xs font-medium text-[var(--admin-ink)]">
          {dragDisabledReason}
        </p>
      )}
      <KanbanColumnPager
        columns={columns}
        counts={columnCounts}
        activeKey={activeColumnKey}
        onSelect={scrollToColumn}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={measuring}
        autoScroll
        accessibility={accessibility}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={cancelDrag}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <div className="@container/kanban min-w-0">
        <div
          ref={scrollerRef}
          className={cn(
            "-mx-4 flex gap-3 overflow-x-auto px-4 pb-5",
            "sm:-mx-6 sm:px-6",
            "lg:-mx-8 lg:px-8",
            "xl:-mx-10 xl:px-10",
            "scroll-smooth snap-x snap-mandatory md:snap-none overscroll-x-contain",
            "[scrollbar-width:thin] [scrollbar-color:var(--admin-border)_transparent]",
            "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:bg-transparent",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--admin-border)]",
            activeId ? "snap-none" : "",
          )}
          role="region"
          aria-label="Kanban board"
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.column_key}
              column={column}
              otherColumns={columns.filter((other) => other.column_key !== column.column_key)}
              items={getColumnItems(column.column_key)}
              getItemId={getItemId}
              renderCard={renderCard}
              dragDisabled={dragDisabled}
              emptyHint={emptyColumnHint}
              onRename={
                onRenameColumn ? (label) => onRenameColumn(column.column_key, label) : undefined
              }
              onDelete={
                onDeleteColumn ? (options) => onDeleteColumn(column.column_key, options) : undefined
              }
              onUpdateMetadata={
                onUpdateColumnMetadata
                  ? (metadata) => onUpdateColumnMetadata(column.column_key, metadata)
                  : undefined
              }
              onQuickAdd={onQuickAdd ? (title) => onQuickAdd(column.column_key, title) : undefined}
              quickAddLabel={quickAddLabel}
            />
          ))}
          {onAddColumn && (
            <AddColumnInline
              onAdd={(label) => onAddColumn({ label })}
              extraFields={addColumnExtraFields}
              tileLabel={addColumnTileLabel}
            />
          )}
        </div>
        </div>
        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeItem
            ? renderCardOverlay
              ? renderCardOverlay(activeItem)
              : renderCard(activeItem, {
                  isDragging: true,
                  isOverlay: true,
                  disabled: true,
                  dragHandleProps: {},
                })
            : null}
        </DragOverlay>
      </DndContext>
      {footer}
    </div>
  );
}
