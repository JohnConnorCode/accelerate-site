"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { ContentKanban } from "@/components/admin/ContentKanban";
import { ContentItemForm } from "@/components/admin/ContentItemForm";
import { useKanbanColumns } from "@/lib/kanban/useKanbanColumns";
import type { KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import type { ContentCalendarItem } from "@/lib/types";

export default function AdminContentPage() {
  const [items, setItems] = useState<ContentCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ContentCalendarItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const { columns, createColumn, renameColumn, deleteColumn } = useKanbanColumns("content");
  const statusOptions = useMemo(
    () => columns.map((column) => ({ value: column.column_key, label: column.label })),
    [columns],
  );

  const commitReorder = useCallback(
    async (updates: KanbanReorderUpdate[]) => {
      try {
        await fetch("/api/admin/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorder: updates }),
        });
      } finally {
        // The board already reflects the new order optimistically; refetch
        // to reconcile local state with the truthful server state.
        await fetchItems();
      }
    },
    [fetchItems],
  );

  const handleSave = async (data: Partial<ContentCalendarItem>) => {
    const method = data.id ? "PATCH" : "POST";
    try {
      await fetch("/api/admin/content", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await fetchItems();
    } catch {
      // Handle error silently
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admin/content?id=${id}`, { method: "DELETE" });
      await fetchItems();
    } catch {
      // Handle error silently
    }
  };

  const handleEdit = (item: ContentCalendarItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Content Calendar" />
        <LoadingSkeleton variant="cards" count={5} />
      </div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Content Calendar"
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

      <ContentKanban
        columns={columns}
        items={items}
        onReorder={commitReorder}
        onEdit={handleEdit}
        onAddColumn={createColumn}
        onRenameColumn={(columnKey, label) => renameColumn(columnKey, { label })}
        onDeleteColumn={(columnKey, options) => deleteColumn(columnKey, options)}
      />

      <ContentItemForm
        key={editingItem?.id ?? "new"}
        open={showForm}
        item={editingItem}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setShowForm(false)}
        statusOptions={statusOptions}
      />
    </motion.div>
  );
}
