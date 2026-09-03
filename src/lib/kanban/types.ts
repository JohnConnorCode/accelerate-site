export const KANBAN_BOARD_KEYS = ["features", "content", "pipeline"] as const;
export type KanbanBoardKey = (typeof KANBAN_BOARD_KEYS)[number];

export function isKanbanBoardKey(value: unknown): value is KanbanBoardKey {
  return (
    typeof value === "string" && (KANBAN_BOARD_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Per-board extension point. Pipeline is the only board that populates this
 * today (`role` replaces the hardcoded won/lost literal-name checks,
 * `probability` replaces the hardcoded DEFAULT_STAGE_META table); features
 * and content leave it `{}`.
 */
export interface KanbanColumnMetadata {
  role?: "open" | "won" | "lost";
  probability?: number;
  [key: string]: unknown;
}

export interface KanbanColumnRecord {
  id: string;
  board_key: KanbanBoardKey;
  tenant_id: string | null;
  column_key: string;
  label: string;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  metadata: KanbanColumnMetadata;
  created_at: string;
  updated_at: string;
}
