import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PIPELINE_STAGES, LEGACY_STAGE_MAP, REVENUE_STAGE_META } from "./types";

export interface PipelineStageMeta {
  columnKey: string;
  label: string;
  probability: number;
  role: "open" | "won" | "lost";
}

export interface PipelineStageResolver {
  /** Every current column_key for this tenant's pipeline board, in column order. */
  stageKeys: string[];
  defaultColumnKey: string;
  getMeta(key: string): PipelineStageMeta | null;
  /** Resolves a raw stored stage value (current or legacy) to a live
   * column_key, or null if it matches nothing the tenant has configured. */
  canonicalStage(raw: string): string | null;
  /**
   * A general, role-based replacement for the old hand-curated per-stage
   * adjacency graph (which can't be hand-maintained once stages are
   * admin-defined): any move between two recognized stages is structurally
   * allowed. The actual gate — a reason is required to leave a won/lost
   * (terminal) stage — is enforced by transitionOpportunity(), the one
   * authoritative write path, not here.
   */
  canTransition(from: string, to: string): boolean;
  role(key: string): "open" | "won" | "lost" | null;
}

function buildResolver(
  rows: { column_key: string; label: string; is_default?: boolean; metadata?: unknown }[],
): PipelineStageResolver {
  const metaByKey = new Map<string, PipelineStageMeta>();
  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as { role?: string; probability?: number };
    const role: PipelineStageMeta["role"] =
      metadata.role === "won" || metadata.role === "lost" ? metadata.role : "open";
    metaByKey.set(row.column_key, {
      columnKey: row.column_key,
      label: row.label,
      probability: Number.isFinite(metadata.probability) ? Number(metadata.probability) : 0,
      role,
    });
  }

  const stageKeys = rows.map((row) => row.column_key);
  const defaultRow = rows.find((row) => row.is_default) ?? rows[0];
  const defaultColumnKey = defaultRow?.column_key ?? stageKeys[0] ?? "new";

  function canonicalStage(raw: string): string | null {
    if (metaByKey.has(raw)) return raw;
    const legacy = LEGACY_STAGE_MAP[raw];
    return legacy && metaByKey.has(legacy) ? legacy : null;
  }

  function role(key: string): "open" | "won" | "lost" | null {
    return metaByKey.get(key)?.role ?? null;
  }

  function canTransition(from: string, to: string): boolean {
    return canonicalStage(from) !== null && canonicalStage(to) !== null;
  }

  return {
    stageKeys,
    defaultColumnKey,
    getMeta: (key) => metaByKey.get(key) ?? null,
    canonicalStage,
    canTransition,
    role,
  };
}

/**
 * Loads a tenant's admin-defined pipeline columns (kanban_columns,
 * board_key="pipeline") once per request and returns a synchronous resolver
 * over that snapshot — replacing the old static REVENUE_STAGES/
 * REVENUE_STAGE_META constants and TRANSITIONS adjacency graph now that
 * stages are admin add/renamable/deletable rather than a fixed 9-value set.
 * `role`/`probability` live in kanban_columns.metadata (see
 * migrations/20260902-kanban-columns.sql).
 */
export async function loadPipelineStages(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<PipelineStageResolver> {
  const { data, error } = await supabase
    .from("kanban_columns")
    .select("column_key,label,is_default,metadata")
    .eq("board_key", "pipeline")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return buildResolver(data ?? []);
}

/**
 * A synchronous resolver built from the DEFAULT seed stages, no DB round
 * trip — for unit tests and scripts exercising stage-aware pure functions
 * (e.g. summarizeRevenueAnalytics) without a live tenant/database.
 */
export function createDefaultPipelineStageResolver(): PipelineStageResolver {
  return buildResolver(
    DEFAULT_PIPELINE_STAGES.map((key, index) => ({
      column_key: key,
      label: REVENUE_STAGE_META[key].label,
      is_default: key === "new",
      metadata: {
        role: key === "won" ? "won" : key === "lost" ? "lost" : "open",
        probability: REVENUE_STAGE_META[key].probability,
      },
      sort_order: index,
    })),
  );
}
