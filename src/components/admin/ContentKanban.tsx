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
            {...opts.dragHandleProps}
            className="mt-0.5 cursor-grab text-white-muted hover:text-white-secondary"
          >
            <GripVertical className="h-3.5 w-3.5" />
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
            className="cursor-pointer text-white-muted opacity-0 transition-[opacity,color] hover:text-white-primary group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
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
