"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import type { KanbanColumnRecord } from "@/lib/kanban/types";
import type { KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";

export interface KanbanListExtraColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  /** Optional sort comparator; omit to leave this column unsortable. */
  sortValue?: (item: T) => string | number;
}

export interface KanbanListViewProps<T> {
  columns: KanbanColumnRecord[];
  items: T[];
  getItemId: (item: T) => string;
  getItemColumnKey: (item: T) => string;
  getItemSortOrder: (item: T) => number;
  setItemPosition: (item: T, columnKey: string, sortOrder: number) => T;
  renderTitle: (item: T) => ReactNode;
  extraColumns?: KanbanListExtraColumn<T>[];
  onReorder: (updates: KanbanReorderUpdate[]) => Promise<void>;
  onCrossColumnMove?: (item: T, fromColumnKey: string, toColumnKey: string) => Promise<boolean>;
  onOpenItem?: (item: T) => void;
  emptyHint?: string;
}

type SortKey = "title" | "status" | string;
type SortDir = "asc" | "desc";

/**
 * Flat, sortable, filterable table view of every item on a board across all
 * columns — the same underlying `column_key`/`sort_order`/`onReorder`/
 * `onCrossColumnMove` contract KanbanBoard uses, so status changes made here
 * go through the identical business-rule veto path a drag would (Pipeline's
 * stage-transition rules included).
 */
export function KanbanListView<T>({
  columns,
  items,
  getItemId,
  getItemColumnKey,
  getItemSortOrder,
  setItemPosition,
  renderTitle,
  extraColumns = [],
  onReorder,
  onCrossColumnMove,
  onOpenItem,
  emptyHint = "Nothing here yet",
}: KanbanListViewProps<T>) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [movingId, setMovingId] = useState<string | null>(null);

  const columnByKey = useMemo(() => new Map(columns.map((c) => [c.column_key, c])), [columns]);
  const columnOrder = useMemo(
    () => new Map(columns.map((c, index) => [c.column_key, index])),
    [columns],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? items
        : items.filter((item) => getItemColumnKey(item) === statusFilter);
    const extra = extraColumns.find((column) => column.key === sortKey);
    const compare = (a: T, b: T): number => {
      if (sortKey === "status") {
        return (
          (columnOrder.get(getItemColumnKey(a)) ?? 0) - (columnOrder.get(getItemColumnKey(b)) ?? 0)
        );
      }
      if (extra?.sortValue) {
        const av = extra.sortValue(a);
        const bv = extra.sortValue(b);
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      }
      return getItemSortOrder(a) - getItemSortOrder(b);
    };
    const result = [...filtered].sort(compare);
    return sortDir === "asc" ? result : result.reverse();
  }, [
    columnOrder,
    extraColumns,
    getItemColumnKey,
    getItemSortOrder,
    items,
    sortDir,
    sortKey,
    statusFilter,
  ]);

  const moveItem = async (item: T, toColumnKey: string) => {
    const fromColumnKey = getItemColumnKey(item);
    if (fromColumnKey === toColumnKey) return;
    const id = getItemId(item);
    setMovingId(id);
    try {
      if (onCrossColumnMove) {
        const allowed = await onCrossColumnMove(item, fromColumnKey, toColumnKey);
        if (!allowed) return;
      }
      const targetCount = items.filter((entry) => getItemColumnKey(entry) === toColumnKey).length;
      const updated = setItemPosition(item, toColumnKey, (targetCount + 1) * 1000);
      await onReorder([
        {
          id,
          column_key: toColumnKey,
          sort_order: getItemSortOrder(updated),
        },
      ]);
      toast.success(`Moved to ${columnByKey.get(toColumnKey)?.label ?? toColumnKey}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move this item.");
    } finally {
      setMovingId(null);
    }
  };

  const SortIcon = ({ active }: { active: boolean }) =>
    active ? (
      sortDir === "asc" ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )
    ) : (
      <ArrowUpDown className="size-3 opacity-35" />
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-medium text-[var(--admin-muted)]"
          htmlFor="kanban-list-status-filter"
        >
          Status
        </label>
        <select
          id="kanban-list-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="min-h-8 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-2 text-xs text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
        >
          <option value="all">All columns</option>
          {columns.map((column) => (
            <option key={column.column_key} value={column.column_key}>
              {column.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_var(--admin-border)]">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-black/[0.018] text-left text-xs font-semibold text-[var(--admin-muted)] dark:bg-white/[0.018]">
              <th scope="col" className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("title")}
                  className="inline-flex items-center gap-1 hover:text-[var(--admin-ink)]"
                >
                  Title <SortIcon active={sortKey === "title"} />
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="inline-flex items-center gap-1 hover:text-[var(--admin-ink)]"
                >
                  Status <SortIcon active={sortKey === "status"} />
                </button>
              </th>
              {extraColumns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2.5">
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--admin-ink)]"
                    >
                      {column.header} <SortIcon active={sortKey === column.key} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const id = getItemId(item);
              const columnKey = getItemColumnKey(item);
              return (
                <tr
                  key={id}
                  className="border-b border-[var(--admin-border)] last:border-b-0 hover:bg-black/[0.014] dark:hover:bg-white/[0.014]"
                >
                  <td className="px-3 py-2.5">
                    {onOpenItem ? (
                      <button
                        type="button"
                        onClick={() => onOpenItem(item)}
                        className="text-left font-medium text-[var(--admin-ink)] hover:underline"
                      >
                        {renderTitle(item)}
                      </button>
                    ) : (
                      <span className="font-medium text-[var(--admin-ink)]">
                        {renderTitle(item)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={columnKey}
                      disabled={movingId === id}
                      onChange={(event) => void moveItem(item, event.target.value)}
                      aria-label="Move to column"
                      className={cn(
                        "min-h-8 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-2 text-xs text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2",
                        movingId === id && "opacity-50",
                      )}
                    >
                      {columns.map((column) => (
                        <option key={column.column_key} value={column.column_key}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {extraColumns.map((column) => (
                    <td key={column.key} className="px-3 py-2.5 text-[var(--admin-ink)]">
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td
                  colSpan={2 + extraColumns.length}
                  className="px-3 py-8 text-center text-xs text-[var(--admin-muted)]"
                >
                  {emptyHint}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
