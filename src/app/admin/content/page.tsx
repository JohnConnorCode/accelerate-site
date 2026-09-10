"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useState, useCallback, useMemo } from "react";
import { useAdminDialogState } from "@/components/admin/AdminDialog";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { ContentKanban } from "@/components/admin/ContentKanban";
import { ContentItemForm } from "@/components/admin/ContentItemForm";
import { KanbanListView } from "@/components/kanban/KanbanListView";
import { KanbanViewSwitcher, useKanbanView } from "@/components/kanban/KanbanViewSwitcher";
import { useKanbanColumns } from "@/lib/kanban/useKanbanColumns";
import type { KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import type { ContentCalendarItem } from "@/lib/types";

export default function AdminContentPage() {
  const query = useAdminQuery<{ items: ContentCalendarItem[] }>(
    ["admin", "content"],
    "/api/admin/content",
  );
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const [editingItem, setEditingItem] = useState<ContentCalendarItem | null>(null);
  const { open: showForm, setOpen: setShowForm, session: formSession } = useAdminDialogState();
  const refetch = query.refetch;
  const fetchItems = useCallback(async () => {
    const result = await refetch();
    if (result.error || !result.data) throw result.error ?? new Error("Content unavailable");
    return result.data.items;
  }, [refetch]);

  const { columns, createColumn, renameColumn, deleteColumn } = useKanbanColumns("content");
  const [view, setView] = useKanbanView("content");
  const statusOptions = useMemo(
    () => columns.map((column) => ({ value: column.column_key, label: column.label })),
    [columns],
  );

  const commitReorder = useCallback(
    async (updates: KanbanReorderUpdate[]) => {
      await fetchJson("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: updates }),
      });
      await fetchItems();
    },
    [fetchItems],
  );
  const handleSave = async (data: Partial<ContentCalendarItem>) => {
    await fetchJson("/api/admin/content", {
      method: data.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await refetch();
  };
  const handleDelete = async (id: string) => {
    await fetchJson(`/api/admin/content?id=${id}`, { method: "DELETE" });
    await refetch();
  };

  const handleEdit = (item: ContentCalendarItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={adminPageName("content")}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Content
          </Button>
        }
      />

      <AdminReadBody
        loading={query.isPending}
        hasData={!!query.data}
        error={query.error?.message}
        onRetry={() => void refetch()}
        loadingFallback={<LoadingSkeleton variant="board" />}
      >
        <div className="mb-3 flex justify-end">
          <KanbanViewSwitcher value={view} onChange={setView} />
        </div>

        {view === "board" ? (
          <ContentKanban
            columns={columns}
            items={items}
            onReorder={commitReorder}
            onEdit={handleEdit}
            onReconcile={fetchItems}
            onAddColumn={createColumn}
            onRenameColumn={(columnKey, label) => renameColumn(columnKey, { label })}
            onDeleteColumn={(columnKey, options) => deleteColumn(columnKey, options)}
          />
        ) : (
          <KanbanListView<ContentCalendarItem>
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
            renderTitle={(item) => item.title}
            onOpenItem={handleEdit}
            onReorder={commitReorder}
            extraColumns={[
              {
                key: "category",
                header: "Category",
                sortValue: (item) => item.category ?? "",
                render: (item) => (item.category ? item.category.replace(/-/g, " ") : "—"),
              },
              {
                key: "word_count_target",
                header: "Words",
                sortValue: (item) => item.word_count_target ?? 0,
                render: (item) => item.word_count_target ?? "—",
              },
            ]}
          />
        )}
      </AdminReadBody>
      <ContentItemForm
        key={`${editingItem?.id ?? "new"}:${formSession}`}
        open={showForm}
        item={editingItem}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setShowForm(false)}
        statusOptions={statusOptions}
      />
    </div>
  );
}
