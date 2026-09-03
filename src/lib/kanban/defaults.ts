import type { KanbanBoardKey, KanbanColumnMetadata } from "./types";

export interface KanbanColumnDefault {
  column_key: string;
  label: string;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  metadata: KanbanColumnMetadata;
}

/**
 * Exact parity with the seed data written by migrations/20260902-kanban-columns.sql.
 * Used only as a lazy-seed safety net: `features` is always seeded by the
 * migration, and every tenant that existed when the migration ran gets its
 * `content`/`pipeline` columns seeded there too. This constant covers a
 * tenant created after that migration, whose first `GET` finds zero rows.
 */
export const KANBAN_DEFAULT_COLUMNS: Record<KanbanBoardKey, KanbanColumnDefault[]> = {
  features: [
    { column_key: "backlog", label: "Backlog", color: "bg-slate-400", sort_order: 1000, is_default: true, metadata: {} },
    { column_key: "planned", label: "Planned", color: "bg-blue-500", sort_order: 2000, is_default: true, metadata: {} },
    { column_key: "in_progress", label: "In progress", color: "bg-amber-500", sort_order: 3000, is_default: true, metadata: {} },
    { column_key: "blocked", label: "Blocked", color: "bg-rose-500", sort_order: 4000, is_default: true, metadata: {} },
    { column_key: "shipped", label: "Shipped", color: "bg-emerald-500", sort_order: 5000, is_default: true, metadata: {} },
  ],
  content: [
    { column_key: "idea", label: "Ideas", color: null, sort_order: 1000, is_default: true, metadata: {} },
    { column_key: "outline", label: "Outline", color: null, sort_order: 2000, is_default: true, metadata: {} },
    { column_key: "draft", label: "Draft", color: null, sort_order: 3000, is_default: true, metadata: {} },
    { column_key: "review", label: "Review", color: null, sort_order: 4000, is_default: true, metadata: {} },
    { column_key: "published", label: "Published", color: null, sort_order: 5000, is_default: true, metadata: {} },
  ],
  pipeline: [
    { column_key: "new", label: "New", color: null, sort_order: 1000, is_default: true, metadata: { role: "open", probability: 10 } },
    { column_key: "contacted", label: "Contacted", color: null, sort_order: 2000, is_default: true, metadata: { role: "open", probability: 20 } },
    { column_key: "qualified", label: "Qualified", color: null, sort_order: 3000, is_default: true, metadata: { role: "open", probability: 40 } },
    { column_key: "meeting", label: "Meeting", color: null, sort_order: 4000, is_default: true, metadata: { role: "open", probability: 55 } },
    { column_key: "proposal", label: "Proposal", color: null, sort_order: 5000, is_default: true, metadata: { role: "open", probability: 70 } },
    { column_key: "negotiation", label: "Negotiation", color: null, sort_order: 6000, is_default: true, metadata: { role: "open", probability: 85 } },
    { column_key: "won", label: "Won", color: null, sort_order: 7000, is_default: true, metadata: { role: "won", probability: 100 } },
    { column_key: "lost", label: "Lost", color: null, sort_order: 8000, is_default: true, metadata: { role: "lost", probability: 0 } },
    { column_key: "nurture", label: "Nurture", color: null, sort_order: 9000, is_default: true, metadata: { role: "open", probability: 10 } },
  ],
};
