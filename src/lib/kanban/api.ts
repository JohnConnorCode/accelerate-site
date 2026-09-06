"use client";

import { fetchJson } from "@/lib/admin/fetchJson";
import type { KanbanBoardKey, KanbanColumnMetadata, KanbanColumnRecord } from "./types";

interface ColumnsResponse {
  columns: KanbanColumnRecord[];
}

export function listColumns(boardKey: KanbanBoardKey) {
  return fetchJson<ColumnsResponse>(
    `/api/admin/kanban/columns?board_key=${encodeURIComponent(boardKey)}`,
  );
}

export function createColumn(
  boardKey: KanbanBoardKey,
  input: { label: string; metadata?: KanbanColumnMetadata },
) {
  return fetchJson<KanbanColumnRecord>("/api/admin/kanban/columns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board_key: boardKey, ...input }),
  });
}

export function renameColumn(
  boardKey: KanbanBoardKey,
  columnKey: string,
  input: { label?: string; color?: string | null; metadata?: KanbanColumnMetadata },
) {
  return fetchJson<KanbanColumnRecord>(
    `/api/admin/kanban/columns/${encodeURIComponent(columnKey)}?board_key=${encodeURIComponent(boardKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/** Surfaced distinctly so callers can offer a reassignment prompt instead of a generic error toast. */
export class KanbanColumnHasCardsError extends Error {
  cardCount: number;
  constructor(cardCount: number) {
    super(
      `This column has ${cardCount} card${cardCount === 1 ? "" : "s"}. Reassign them before deleting.`,
    );
    this.name = "KanbanColumnHasCardsError";
    this.cardCount = cardCount;
  }
}

/** Pipeline-only: refusing to delete the last won/lost-role column. */
export class KanbanCannotDeleteLastRoleError extends Error {
  role: string;
  constructor(role: string) {
    super(`At least one "${role}" column is required.`);
    this.name = "KanbanCannotDeleteLastRoleError";
    this.role = role;
  }
}

export async function deleteColumn(
  boardKey: KanbanBoardKey,
  columnKey: string,
  options: { reassignTo?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({ board_key: boardKey });
  if (options.reassignTo) params.set("reassign_to", options.reassignTo);
  const res = await fetch(
    `/api/admin/kanban/columns/${encodeURIComponent(columnKey)}?${params.toString()}`,
    { method: "DELETE" },
  );
  if (res.ok) return;

  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body; fall through to the status-based message below.
  }
  if (res.status === 409 && body?.error === "column_has_cards") {
    throw new KanbanColumnHasCardsError(Number(body.cardCount) || 0);
  }
  if (res.status === 409 && body?.error === "cannot_delete_last_role") {
    throw new KanbanCannotDeleteLastRoleError(String(body.role ?? ""));
  }
  const message =
    typeof body?.error === "string" && body.error ? body.error : `Request failed (${res.status})`;
  throw new Error(message);
}

export function reorderColumns(boardKey: KanbanBoardKey, order: string[]) {
  return fetchJson<{ success: true }>("/api/admin/kanban/columns/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board_key: boardKey, order }),
  });
}
