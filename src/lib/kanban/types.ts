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
