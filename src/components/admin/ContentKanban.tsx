"use client";

import { GripVertical, Pencil } from "lucide-react";
import { KanbanBoard, type KanbanCardRenderOpts } from "@/components/kanban/KanbanBoard";
import type { KanbanColumnMetadata, KanbanColumnRecord } from "@/lib/kanban/types";
import type { KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import type { ContentCalendarItem } from "@/lib/types";

interface ContentKanbanProps {
  columns: KanbanColumnRecord[];
  items: ContentCalendarItem[];
  onReorder: (updates: KanbanReorderUpdate[]) => Promise<void>;
  onEdit: (item: ContentCalendarItem) => void;
  onAddColumn: (input: { label: string; metadata?: KanbanColumnMetadata }) => Promise<unknown>;
  onRenameColumn: (columnKey: string, label: string) => Promise<unknown>;
  onDeleteColumn: (columnKey: string, options?: { reassignTo?: string }) => Promise<void>;
}

function ContentCard({
  item,
  opts,
  onEdit,
}: {
  item: ContentCalendarItem;
  opts: KanbanCardRenderOpts;
  onEdit: (item: ContentCalendarItem) => void;
}) {
  return (
    <div className="glass group rounded-lg p-3 transition-[border-color,box-shadow,transform] hover:border-border-gold">
      <div className="flex items-start gap-2">
        {!opts.isOverlay && (
          <button
            type="button"
            aria-label={opts.disabled ? "Reordering is unavailable" : `Drag ${item.title}`}
            disabled={opts.disabled}
            {...opts.dragHandleProps}
            className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-white-muted transition-[background-color,color,transform] duration-150 hover:text-white-primary active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white-primary">{item.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white-muted">
            {item.category && (
              <span className="capitalize">{item.category.replace(/-/g, " ")}</span>
            )}
            {item.word_count_target && <span>{item.word_count_target} words</span>}
          </div>
        </div>
        {!opts.isOverlay && (
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Edit ${item.title}`}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-white-muted opacity-0 transition-[background-color,color,opacity] hover:text-white-primary group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ContentKanban({
  columns,
  items,
  onReorder,
  onEdit,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
}: ContentKanbanProps) {
  return (
    <KanbanBoard<ContentCalendarItem>
      columns={columns}
      items={items}
      getItemId={(item) => item.id}
      getItemColumnKey={(item) => item.status}
      getItemSortOrder={(item) => Number(item.sort_order)}
      getItemLabel={(item) => item.title}
      setItemPosition={(item, columnKey, sortOrder) => ({
        ...item,
        status: columnKey,
        sort_order: sortOrder,
      })}
      renderCard={(item, opts) => <ContentCard item={item} opts={opts} onEdit={onEdit} />}
      onReorder={onReorder}
      onAddColumn={onAddColumn}
      onRenameColumn={onRenameColumn}
      onDeleteColumn={onDeleteColumn}
      emptyColumnHint="Drop content here"
    />
  );
}
