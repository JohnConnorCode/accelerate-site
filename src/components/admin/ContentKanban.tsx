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
  onReconcile?: () => Promise<ContentCalendarItem[]>;
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
    <div className="group rounded-2xl bg-[var(--admin-surface)] p-3 shadow-[var(--admin-shadow-border)]">
      <div className="flex items-start gap-2">
        {
          <button
            type="button"
            aria-label={opts.disabled ? "Reordering is unavailable" : `Drag ${item.title}`}
            disabled={opts.disabled}
            {...opts.dragHandleProps}
            className="kanban-grip grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:text-[var(--admin-ink)] active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
          >
            <GripVertical className="size-4" />
          </button>
        }
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-[var(--admin-ink)]">{item.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
            {item.category && (
              <span className="capitalize">{item.category.replace(/-/g, " ")}</span>
            )}
            {item.word_count_target && <span>{item.word_count_target} words</span>}
          </div>
        </div>
        {
          <button
            type="button"
            disabled={opts.isOverlay || opts.busy}
            onClick={() => onEdit(item)}
            aria-label={`Edit ${item.title}`}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--admin-muted)] opacity-70 transition-[background-color,color,opacity] hover:text-[var(--admin-ink)] group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      </div>
    </div>
  );
}

export function ContentKanban({
  columns,
  items,
  onReorder,
  onReconcile,
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
      onReconcile={onReconcile}
      onAddColumn={onAddColumn}
      onRenameColumn={onRenameColumn}
      onDeleteColumn={onDeleteColumn}
      emptyColumnHint="Drop content here"
    />
  );
}
