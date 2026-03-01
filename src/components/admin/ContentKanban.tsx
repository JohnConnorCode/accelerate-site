"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "./StatusBadge";
import type { ContentCalendarItem, ContentStatus } from "@/lib/types";

const columns: { status: ContentStatus; label: string }[] = [
  { status: "idea", label: "Ideas" },
  { status: "outline", label: "Outline" },
  { status: "draft", label: "Draft" },
  { status: "review", label: "Review" },
  { status: "published", label: "Published" },
];

interface ContentKanbanProps {
  items: ContentCalendarItem[];
  onStatusChange: (id: string, newStatus: ContentStatus) => void;
  onEdit: (item: ContentCalendarItem) => void;
}

function SortableCard({
  item,
  onEdit,
}: {
  item: ContentCalendarItem;
  onEdit: (item: ContentCalendarItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass rounded-lg p-3 group hover:border-border-gold transition-all"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-white-muted hover:text-white-secondary"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white-primary truncate">
            {item.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white-muted">
            {item.category && (
              <span className="capitalize">
                {item.category.replace(/-/g, " ")}
              </span>
            )}
            {item.word_count_target && (
              <span>{item.word_count_target} words</span>
            )}
          </div>
        </div>
        <button
          onClick={() => onEdit(item)}
          className="opacity-0 group-hover:opacity-100 text-white-muted hover:text-white-primary transition-all cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ContentCard({ item }: { item: ContentCalendarItem }) {
  return (
    <div className="glass rounded-lg p-3 opacity-80">
      <p className="text-sm font-medium text-white-primary truncate">
        {item.title}
      </p>
    </div>
  );
}

export function ContentKanban({
  items,
  onStatusChange,
  onEdit,
}: ContentKanbanProps) {
  const [activeItem, setActiveItem] = useState<ContentCalendarItem | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column
    const targetColumn = columns.find((c) => c.status === overId);
    if (targetColumn) {
      const draggedItem = items.find((i) => i.id === activeId);
      if (draggedItem && draggedItem.status !== targetColumn.status) {
        onStatusChange(activeId, targetColumn.status);
      }
      return;
    }

    // Check if dropped over another card
    const overItem = items.find((i) => i.id === overId);
    if (overItem) {
      const draggedItem = items.find((i) => i.id === activeId);
      if (draggedItem && draggedItem.status !== overItem.status) {
        onStatusChange(activeId, overItem.status);
      }
    }
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const columnItems = items.filter((i) => i.status === col.status);
          return (
            <div
              key={col.status}
              className="w-64 shrink-0"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white-primary">
                    {col.label}
                  </h3>
                  <StatusBadge status={col.status} />
                </div>
                <span className="text-xs text-white-muted">
                  {columnItems.length}
                </span>
              </div>
              <SortableContext
                id={col.status}
                items={columnItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className={cn(
                    "min-h-[200px] space-y-2 rounded-lg border border-border-glass p-2",
                    columnItems.length === 0 && "border-dashed"
                  )}
                >
                  {columnItems.map((item) => (
                    <SortableCard
                      key={item.id}
                      item={item}
                      onEdit={onEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? <ContentCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
