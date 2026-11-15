import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommandBoardSource } from "./command-board-contract";
import type { BoardSourceReads } from "./command-board-summary";

/**
 * Reads the record sources board stations summarize. PENDING: wire to the graph
 * adapter registry (card command-board-graph-adapters) before handoff; until
 * then every source reports unavailable so no station shows a false zero.
 */
export async function readBoardSources(
  _db: SupabaseClient,
  sources: readonly CommandBoardSource[],
): Promise<BoardSourceReads> {
  return Object.fromEntries(sources.map((source) => [source, "unavailable" as const]));
}
