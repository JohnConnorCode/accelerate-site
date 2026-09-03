"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "@/lib/admin/useToast";
import type { KanbanColumnRecord } from "./types";

export interface KanbanReorderUpdate {
  id: string;
  column_key: string;
  sort_order: number;
}

export interface UseKanbanDndOptions<T> {
  items: T[];
  columns: KanbanColumnRecord[];
  getItemId: (item: T) => string;
  getItemColumnKey: (item: T) => string;
  getItemSortOrder: (item: T) => number;
  setItemPosition: (item: T, columnKey: string, sortOrder: number) => T;
  onReorder: (updates: KanbanReorderUpdate[]) => Promise<void>;
  /**
   * Optional veto for a cross-column move (Pipeline's stage-transition
   * rules). Same-column drags always go straight to `onReorder`. A
   * cross-column drag calls this first; a `false`/thrown result rolls the
   * optimistic move back and never calls `onReorder`.
   */
  onCrossColumnMove?: (item: T, fromColumnKey: string, toColumnKey: string) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * Generalizes the Feature Board's proven `previewMove`/sensors/rollback DnD
 * state machine (src/app/admin/features/page.tsx) so any board can plug in
 * getter/setter callbacks instead of hardcoded `.status`/`.sort_order`
 * fields. Keeps its own local mirror of `items`, kept in sync with the
 * caller's `items` prop whenever a drag isn't in flight, so optimistic
 * preview during a drag never fights a parent re-render.
 */
export function useKanbanDnd<T>({
  items,
  columns,
  getItemId,
  getItemColumnKey,
  getItemSortOrder,
  setItemPosition,
  onReorder,
  onCrossColumnMove,
  disabled = false,
}: UseKanbanDndOptions<T>) {
  const [localItems, setLocalItems] = useState<T[]>(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const snapshotRef = useRef<T[] | null>(null);
  const lastOverRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draggingRef.current) setLocalItems(items);
  }, [items]);

  const columnKeys = columns.map((column) => column.column_key);
  const columnLabel = useCallback(
    (columnKey: string) => columns.find((column) => column.column_key === columnKey)?.label ?? columnKey,
    [columns],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortByColumn = useCallback(
    (columnKey: string, list: T[]) =>
      [...list.filter((item) => getItemColumnKey(item) === columnKey)].sort(
        (a, b) => getItemSortOrder(a) - getItemSortOrder(b),
      ),
    [getItemColumnKey, getItemSortOrder],
  );

  const previewMove = useCallback(
    (current: T[], activeItemId: string, overId: string): T[] => {
      const active = current.find((item) => getItemId(item) === activeItemId);
      if (!active) return current;
      const overItem = current.find((item) => getItemId(item) === overId);
      const targetColumn = overId.startsWith("column:")
        ? overId.slice("column:".length)
        : overItem
          ? getItemColumnKey(overItem)
          : undefined;
      if (!targetColumn) return current;
      const sourceColumn = getItemColumnKey(active);
      const source = sortByColumn(sourceColumn, current);
      const target = sourceColumn === targetColumn ? source : sortByColumn(targetColumn, current);
      let moved: T[];
      if (sourceColumn === targetColumn) {
        const from = source.findIndex((item) => getItemId(item) === activeItemId);
        const to = overItem
          ? source.findIndex((item) => getItemId(item) === getItemId(overItem))
          : source.length - 1;
        if (from < 0 || to < 0 || from === to) return current;
        moved = arrayMove(source, from, to);
      } else {
        const insertion = overItem
          ? target.findIndex((item) => getItemId(item) === getItemId(overItem))
          : target.length;
        const cleanSource = source.filter((item) => getItemId(item) !== activeItemId);
        const cleanTarget = [...target];
        cleanTarget.splice(Math.max(0, insertion), 0, setItemPosition(active, targetColumn, 0));
        moved = [...cleanSource, ...cleanTarget];
      }
      const affected = new Set([sourceColumn, targetColumn]);
      const normalized = columnKeys.flatMap((key) =>
        affected.has(key)
          ? moved
              .filter((item) => getItemColumnKey(item) === key)
              .map((item, index) => setItemPosition(item, key, (index + 1) * 1000))
          : [],
      );
      const map = new Map(normalized.map((item) => [getItemId(item), item]));
      return current.map((item) => map.get(getItemId(item)) ?? item);
    },
    [columnKeys, getItemColumnKey, getItemId, setItemPosition, sortByColumn],
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      if (disabled) return;
      draggingRef.current = true;
      snapshotRef.current = localItems;
      lastOverRef.current = null;
      setActiveId(String(active.id));
    },
    [disabled, localItems],
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over || disabled) return;
      const overId = String(over.id);
      if (lastOverRef.current === overId) return;
      lastOverRef.current = overId;
      setLocalItems((current) => previewMove(current, String(active.id), overId));
    },
    [disabled, previewMove],
  );

  const cancelDrag = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (snapshot) setLocalItems(snapshot);
    snapshotRef.current = null;
    lastOverRef.current = null;
    draggingRef.current = false;
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      lastOverRef.current = null;
      draggingRef.current = false;

      if (!over || disabled || !snapshot) {
        if (snapshot) setLocalItems(snapshot);
        return;
      }

      const activeItemId = String(active.id);
      const beforeItem = snapshot.find((item) => getItemId(item) === activeItemId);
      const afterItem = localItems.find((item) => getItemId(item) === activeItemId);
      if (!beforeItem || !afterItem) return;

      const beforeColumn = getItemColumnKey(beforeItem);
      const afterColumn = getItemColumnKey(afterItem);
      const affected = new Set([beforeColumn, afterColumn]);
      const normalized = columnKeys.flatMap((key) =>
        affected.has(key)
          ? sortByColumn(key, localItems).map((item, index) =>
              setItemPosition(item, key, (index + 1) * 1000),
            )
          : [],
      );
      const unchanged = normalized.every((item) => {
        const original = snapshot.find((entry) => getItemId(entry) === getItemId(item));
        return (
          original &&
          getItemColumnKey(original) === getItemColumnKey(item) &&
          getItemSortOrder(original) === getItemSortOrder(item)
        );
      });
      if (unchanged) return;

      const map = new Map(normalized.map((item) => [getItemId(item), item]));
      setLocalItems((current) => current.map((item) => map.get(getItemId(item)) ?? item));

      const crossColumn = beforeColumn !== afterColumn;
      try {
        if (crossColumn && onCrossColumnMove) {
          const allowed = await onCrossColumnMove(afterItem, beforeColumn, afterColumn);
          if (!allowed) throw new Error("Move was not allowed");
        }
        await onReorder(
          normalized.map((item) => ({
            id: getItemId(item),
            column_key: getItemColumnKey(item),
            sort_order: getItemSortOrder(item),
          })),
        );
        toast.success(crossColumn ? `Moved to ${columnLabel(afterColumn)}` : "Order saved");
      } catch (error) {
        setLocalItems(snapshot);
        toast.error(error instanceof Error ? error.message : "Could not save the new position.");
      }
    },
    [
      columnKeys,
      columnLabel,
      disabled,
      getItemColumnKey,
      getItemId,
      getItemSortOrder,
      localItems,
      onCrossColumnMove,
      onReorder,
      setItemPosition,
      sortByColumn,
    ],
  );

  const activeItem = activeId ? (localItems.find((item) => getItemId(item) === activeId) ?? null) : null;

  const getColumnItems = useCallback(
    (columnKey: string) => sortByColumn(columnKey, localItems),
    [localItems, sortByColumn],
  );

  return {
    items: localItems,
    sensors,
    activeId,
    activeItem,
    getColumnItems,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    cancelDrag,
  };
}
