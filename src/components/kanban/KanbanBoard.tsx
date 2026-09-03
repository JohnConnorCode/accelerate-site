"use client";

import { type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
} from "@dnd-kit/core";
import { useKanbanDnd, type KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import type { KanbanColumnMetadata, KanbanColumnRecord } from "@/lib/kanban/types";
import { cn } from "@/lib/utils";
import { AddColumnInline } from "./AddColumnInline";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanCardRenderOpts } from "./KanbanCard";

export type { KanbanCardRenderOpts } from "./KanbanCard";

export interface KanbanBoardProps<T> {
  columns: KanbanColumnRecord[];
  items: T[];
  getItemId: (item: T) => string;
  getItemColumnKey: (item: T) => string;
  getItemSortOrder: (item: T) => number;
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
  className,
  footer,
}: KanbanBoardProps<T>) {
  const { getColumnItems, sensors, activeId, activeItem, handleDragStart, handleDragOver, handleDragEnd, cancelDrag } =
    useKanbanDnd<T>({
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

  return (
    <div className={cn("space-y-3", className)}>
      {dragDisabled && dragDisabledReason && (
        <p className="rounded-lg bg-[var(--admin-warning-soft)] px-3 py-2 text-xs font-medium text-[var(--admin-ink)]">
          {dragDisabledReason}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        autoScroll
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={cancelDrag}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <div
          className={cn(
            "-mx-4 flex gap-3 overflow-x-auto px-4 pb-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10",
            activeId ? "snap-none" : "snap-x snap-mandatory",
          )}
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
              onRename={onRenameColumn ? (label) => onRenameColumn(column.column_key, label) : undefined}
              onDelete={
                onDeleteColumn ? (options) => onDeleteColumn(column.column_key, options) : undefined
              }
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
        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeItem
            ? (renderCardOverlay
                ? renderCardOverlay(activeItem)
                : renderCard(activeItem, {
                    isDragging: true,
                    isOverlay: true,
                    disabled: true,
                    dragHandleProps: {},
                  }))
            : null}
        </DragOverlay>
      </DndContext>
      {footer}
    </div>
  );
}
