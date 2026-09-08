"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
/** Keyboard movement targets cards or empty columns, never a populated column's frame. */
const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableContainers, droppableRects } = context;
  if (!collisionRect || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code))
    return;
  event.preventDefault();
  const horizontal = event.code === "ArrowLeft" || event.code === "ArrowRight";
  const forward = event.code === "ArrowRight" || event.code === "ArrowDown";
  const candidates = droppableContainers
    .getEnabled()
    .flatMap((container) => {
      const rect = droppableRects.get(container.id);
      if (
        !rect ||
        (container.data.current?.type !== "card" &&
          container.node.current?.querySelector("[data-kanban-card]"))
      )
        return [];
      const delta = horizontal ? rect.left - collisionRect.left : rect.top - collisionRect.top;
      if (forward ? delta < 2 : delta > -2) return [];
      if (!horizontal && Math.abs(rect.left - collisionRect.left) > collisionRect.width / 2)
        return [];
      return [
        {
          rect,
          distance:
            Math.abs(delta) + (horizontal ? Math.abs(rect.top - collisionRect.top) * 0.1 : 0),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
  const target = candidates[0]?.rect;
  return target
    ? { x: target.left, y: target.top + (target.height - collisionRect.height) / 2 }
    : undefined;
};
import { toast } from "@/lib/admin/useToast";
import type { KanbanColumnRecord } from "./types";
import { moveKanbanItem } from "./position";

export interface KanbanReorderUpdate {
  id: string;
  column_key: string;
  sort_order: number;
}
export type KanbanStageMoveResult = boolean | { status: "committed" | "rejected" };
export interface UseKanbanDndOptions<T> {
  items: T[];
  columns: KanbanColumnRecord[];
  getItemId: (item: T) => string;
  getItemColumnKey: (item: T) => string;
  getItemSortOrder: (item: T) => number;
  setItemPosition: (item: T, columnKey: string, sortOrder: number) => T;
  onReorder: (updates: KanbanReorderUpdate[]) => Promise<void>;
  /** Boolean results validate only. `committed` means a separate stage write succeeded. */
  onCrossColumnMove?: (
    item: T,
    fromColumnKey: string,
    toColumnKey: string,
  ) => Promise<KanbanStageMoveResult>;
  onReconcile?: () => Promise<T[]>;
  disabled?: boolean;
}
export function useKanbanDnd<T>({
  items,
  columns,
  getItemId,
  getItemColumnKey,
  getItemSortOrder,
  setItemPosition,
  onReorder,
  onCrossColumnMove,
  onReconcile,
  disabled = false,
}: UseKanbanDndOptions<T>) {
  const reducedMotion = useReducedMotion();
  const [localItems, setLocalItems] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const working = useRef(items),
    incoming = useRef(items),
    snapshot = useRef<T[] | null>(null),
    locked = useRef(false);
  const keyboardDrag = useRef(false);
  const placement = useRef<{ column: string; anchor: string | null; after: boolean } | null>(null);
  const [insertion, setInsertion] = useState<{ id: string; after: boolean } | null>(null);
  useEffect(() => {
    incoming.current = items;
    if (!locked.current) {
      working.current = items;
      setLocalItems(items);
      setSaveError("");
    }
  }, [items]);
  const update = (next: T[]) => {
    working.current = next;
    setLocalItems(next);
  };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: kanbanKeyboardCoordinates,
      scrollBehavior: reducedMotion ? "auto" : "smooth",
    }),
  );
  const sort = (column: string, list: T[]) =>
    list
      .filter((item) => getItemColumnKey(item) === column)
      .sort((a, b) => getItemSortOrder(a) - getItemSortOrder(b));
  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    if (disabled || locked.current || saveError) return;
    locked.current = true;
    keyboardDrag.current = activatorEvent instanceof KeyboardEvent;
    snapshot.current = working.current;
    setActiveId(String(active.id));
    setInsertion(null);
    placement.current = null;
  };
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      placement.current = null;
      setInsertion(null);
      return;
    }
    if (!snapshot.current || disabled) return;
    const id = String(over.id);
    if (id === String(active.id)) {
      placement.current = null;
      setInsertion(null);
      return;
    }
    const target = working.current.find((item) => getItemId(item) === id);
    const column = id.startsWith("column:")
      ? id.slice(7)
      : target
        ? getItemColumnKey(target)
        : null;
    if (!column || !columns.some((c) => c.column_key === column)) return;
    const rect = active.rect.current.translated;
    const center = rect ? rect.top + rect.height / 2 : 0,
      midpoint = over.rect.top + over.rect.height / 2;
    const source = working.current.find((item) => getItemId(item) === String(active.id));
    const keyboardAfter =
      !!target &&
      !!source &&
      getItemColumnKey(source) === column &&
      sort(column, working.current).findIndex((item) => getItemId(item) === id) >
        sort(column, working.current).findIndex((item) => getItemId(item) === String(active.id));
    const after = keyboardDrag.current
      ? keyboardAfter
      : !!target &&
        !!rect &&
        (center > midpoint + 1 ||
          (Math.abs(center - midpoint) <= 1 &&
            over.rect.top > (active.rect.current.initial?.top ?? over.rect.top)));
    setInsertion((previous) =>
      previous?.id === id && previous.after === after ? previous : { id, after },
    );
    placement.current = { column, anchor: target ? id : null, after };
  };
  const cancelDrag = () => {
    if (snapshot.current) update(incoming.current);
    snapshot.current = null;
    placement.current = null;
    locked.current = false;
    setActiveId(null);
    setInsertion(null);
  };
  const reconcile = useCallback(async () => {
    if (!onReconcile) return;
    setSaving(true);
    locked.current = true;
    try {
      const latest = await onReconcile();
      working.current = latest;
      setLocalItems(latest);
      setSaveError("");
    } catch {
      setSaveError(
        "The saved position could not be checked. Refresh the board before moving another card.",
      );
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }, [onReconcile]);
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const before = snapshot.current;
    setActiveId(null);
    setInsertion(null);
    snapshot.current = null;
    if (!before || !over || disabled) {
      if (before) update(before);
      locked.current = false;
      return;
    }
    const fresh = incoming.current;
    if (
      fresh.length !== before.length ||
      fresh.some((item) => {
        const prior = before.find((previous) => getItemId(previous) === getItemId(item));
        return (
          !prior ||
          getItemColumnKey(prior) !== getItemColumnKey(item) ||
          !Object.is(getItemSortOrder(prior), getItemSortOrder(item))
        );
      })
    ) {
      update(fresh);
      locked.current = false;
      placement.current = null;
      toast.error(
        "The board changed while you were dragging. Review its current position and try again.",
      );
      return;
    }
    const target = placement.current;
    placement.current = null;
    if (target)
      update(
        moveKanbanItem(before, String(active.id), target.column, target.anchor, target.after, {
          id: getItemId,
          column: getItemColumnKey,
          order: getItemSortOrder,
          position: setItemPosition,
        }),
      );
    const id = String(active.id),
      original = before.find((item) => getItemId(item) === id),
      moved = working.current.find((item) => getItemId(item) === id);
    if (!original || !moved) {
      locked.current = false;
      return;
    }
    const from = getItemColumnKey(original),
      to = getItemColumnKey(moved);
    const changed = working.current.filter((item) => {
      const prior = before.find((p) => getItemId(p) === getItemId(item));
      return (
        prior &&
        (getItemColumnKey(prior) !== getItemColumnKey(item) ||
          !Object.is(getItemSortOrder(prior), getItemSortOrder(item)))
      );
    });
    if (!changed.length) {
      locked.current = false;
      return;
    }
    const affected = new Set([from, to]);
    const updates = columns
      .filter((c) => affected.has(c.column_key))
      .flatMap((c) => sort(c.column_key, working.current))
      .map((item) => ({
        id: getItemId(item),
        column_key: getItemColumnKey(item),
        sort_order: getItemSortOrder(item),
      }));
    let stageCommitted = false;
    setSaving(true);
    setSaveError("");
    try {
      if (from !== to && onCrossColumnMove) {
        const result = await onCrossColumnMove(moved, from, to);
        if (result === false || (typeof result === "object" && result.status === "rejected")) {
          update(incoming.current);
          return;
        }
        stageCommitted = typeof result === "object" && result.status === "committed";
      }
      await onReorder(updates);
      if (onReconcile) update(await onReconcile());
      toast.success(
        from === to
          ? "Order saved"
          : `Moved to ${columns.find((c) => c.column_key === to)?.label ?? to}`,
      );
    } catch (cause) {
      if (onReconcile) {
        try {
          update(await onReconcile());
        } catch {
          setSaveError(
            "The saved position could not be checked. Refresh the board before moving another card.",
          );
        }
      } else if (!stageCommitted) update(before);
      else
        setSaveError(
          "The stage changed, but the order could not be saved. Refresh before moving another card.",
        );
      toast.error(
        stageCommitted
          ? "Stage changed; order could not be saved. The board is checking the saved position."
          : cause instanceof Error
            ? cause.message
            : "Could not save the new position.",
      );
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };
  return {
    items: localItems,
    sensors,
    activeId,
    activeItem: activeId ? (localItems.find((item) => getItemId(item) === activeId) ?? null) : null,
    getColumnItems: (key: string) => sort(key, localItems),
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    cancelDrag,
    saving,
    saveError,
    reconcile,
    insertion,
  };
}
