"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import type { KanbanBoardKey, KanbanColumnMetadata, KanbanColumnRecord } from "./types";
import {
  KanbanCannotDeleteLastRoleError,
  KanbanColumnHasCardsError,
  createColumn,
  deleteColumn,
  renameColumn,
  reorderColumns,
} from "./api";

interface ColumnsResponse {
  columns: KanbanColumnRecord[];
}

export function kanbanColumnsQueryKey(boardKey: KanbanBoardKey) {
  return ["admin", "kanban", "columns", boardKey] as const;
}

/**
 * Same shape as src/lib/admin/useAdminQuery.ts: a cached read plus
 * hand-rolled optimistic mutations that patch the query cache directly
 * (mirroring src/app/admin/features/page.tsx) rather than react-query's
 * useMutation, so every admin board keeps one consistent update pattern.
 */
export function useKanbanColumns(boardKey: KanbanBoardKey) {
  const queryClient = useQueryClient();
  const queryKey = kanbanColumnsQueryKey(boardKey);
  const query = useAdminQuery<ColumnsResponse>(
    queryKey,
    `/api/admin/kanban/columns?board_key=${encodeURIComponent(boardKey)}`,
  );
  const columns = query.data?.columns ?? [];

  const setColumns = useCallback(
    (updater: KanbanColumnRecord[] | ((current: KanbanColumnRecord[]) => KanbanColumnRecord[])) => {
      queryClient.setQueryData(queryKey, (current: ColumnsResponse | undefined) => ({
        columns: typeof updater === "function" ? updater(current?.columns ?? []) : updater,
      }));
    },
    [queryClient, queryKey],
  );

  const create = useCallback(
    async (input: { label: string; metadata?: KanbanColumnMetadata }) => {
      try {
        const created = await createColumn(boardKey, input);
        setColumns((current) => [...current, created]);
        toast.success(`Added column "${created.label}"`);
        return created;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add the column.");
        throw error;
      }
    },
    [boardKey, setColumns],
  );

  const rename = useCallback(
    async (
      columnKey: string,
      input: { label?: string; color?: string | null; metadata?: KanbanColumnMetadata },
    ) => {
      const previous = query.data?.columns ?? [];
      setColumns((current) =>
        current.map((column) =>
          column.column_key === columnKey ? ({ ...column, ...input } as KanbanColumnRecord) : column,
        ),
      );
      try {
        const updated = await renameColumn(boardKey, columnKey, input);
        setColumns((current) =>
          current.map((column) => (column.column_key === columnKey ? updated : column)),
        );
        toast.success("Column updated");
        return updated;
      } catch (error) {
        setColumns(previous);
        toast.error(error instanceof Error ? error.message : "Could not update the column.");
        throw error;
      }
    },
    [boardKey, query.data?.columns, setColumns],
  );

  const reorder = useCallback(
    async (orderedColumnKeys: string[]) => {
      const previous = query.data?.columns ?? [];
      const order = new Map(orderedColumnKeys.map((key, index) => [key, index]));
      setColumns((current) =>
        [...current].sort(
          (a, b) => (order.get(a.column_key) ?? 0) - (order.get(b.column_key) ?? 0),
        ),
      );
      try {
        await reorderColumns(boardKey, orderedColumnKeys);
      } catch (error) {
        setColumns(previous);
        toast.error(
          error instanceof Error ? error.message : "Could not save the new column order.",
        );
        throw error;
      }
    },
    [boardKey, query.data?.columns, setColumns],
  );

  const remove = useCallback(
    async (columnKey: string, options: { reassignTo?: string } = {}) => {
      const previous = query.data?.columns ?? [];
      setColumns((current) => current.filter((column) => column.column_key !== columnKey));
      try {
        await deleteColumn(boardKey, columnKey, options);
        toast.success("Column deleted");
      } catch (error) {
        setColumns(previous);
        // Let the caller handle these two: they drive a reassignment prompt,
        // not a generic failure toast.
        if (
          error instanceof KanbanColumnHasCardsError ||
          error instanceof KanbanCannotDeleteLastRoleError
        ) {
          throw error;
        }
        toast.error(error instanceof Error ? error.message : "Could not delete the column.");
        throw error;
      }
    },
    [boardKey, query.data?.columns, setColumns],
  );

  return {
    columns,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createColumn: create,
    renameColumn: rename,
    reorderColumns: reorder,
    deleteColumn: remove,
  };
}
