"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface KanbanCardRenderOpts {
  isDragging: boolean;
  isOverlay: boolean;
  disabled: boolean;
  /** Spread onto whatever element should act as the drag handle (a grip
   * button, or the whole card). Empty while disabled/overlay. */
  dragHandleProps: Record<string, unknown>;
}

interface KanbanCardProps<T> {
  item: T;
  id: string;
  columnKey: string;
  disabled?: boolean;
  renderCard: (item: T, opts: KanbanCardRenderOpts) => ReactNode;
}

/**
 * Thin `useSortable` wrapper around whatever `renderCard` returns — lifted
 * from ContentKanban.tsx's `SortableCard`, generalized so the caller's card
 * markup (FeatureCard, a future ContentCard/PipelineCard, ...) owns 100% of
 * its own visual styling. This wrapper imposes no layout/visual styles of
 * its own beyond the dnd-kit transform/transition, so a board's existing
 * card component can be dropped in unchanged in spirit.
 */
export function KanbanCard<T>({ item, id, columnKey, disabled = false, renderCard }: KanbanCardProps<T>) {
  const sortable = useSortable({
    id,
    disabled,
    data: { type: "card", columnKey },
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      {renderCard(item, {
        isDragging: sortable.isDragging,
        isOverlay: false,
        disabled,
        dragHandleProps: disabled ? {} : { ...sortable.attributes, ...sortable.listeners },
      })}
    </div>
  );
}
