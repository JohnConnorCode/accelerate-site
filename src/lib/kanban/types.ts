export const KANBAN_BOARD_KEYS = ["features", "content", "pipeline"] as const;
export type KanbanBoardKey = (typeof KANBAN_BOARD_KEYS)[number];

export function isKanbanBoardKey(value: unknown): value is KanbanBoardKey {
  return (
    typeof value === "string" && (KANBAN_BOARD_KEYS as readonly string[]).includes(value)
  );
}

/**
 * One entry per board: the key plus the authorization shape its routes
 * require. Adding a fourth board is a data change here (+ its seed columns
 * in defaults/migrations and its UI page), not a new auth branch:
 * - "platform" boards (features) are platform-global, no tenant.
 * - "tenant" boards (pipeline, content) resolve through the tenant-bound
 *   admin client; `module` adds the module-guard check when the board's
 *   existing route requires one (content).
 */
export interface KanbanBoardDefinition {
  key: KanbanBoardKey;
  scope: "platform" | "tenant";
  module?: string;
}

export const KANBAN_BOARD_DEFINITIONS: Record<KanbanBoardKey, KanbanBoardDefinition> = {
  features: { key: "features", scope: "platform" },
  content: { key: "content", scope: "tenant", module: "content" },
  pipeline: { key: "pipeline", scope: "tenant" },
};

/**
 * Per-board extension point. Pipeline populates `role`/`probability`;
 * every board may set `wipLimit` (soft cap shown on the column). Unknown
 * keys are preserved so a board can extend metadata without a schema change.
 */
export interface KanbanColumnMetadata {
  role?: "open" | "won" | "lost";
  probability?: number;
  wipLimit?: number | null;
  [key: string]: unknown;
}

export function parseWipLimit(metadata: KanbanColumnMetadata | undefined): number | null {
  const value = metadata?.wipLimit;
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(99, Math.floor(parsed));
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
