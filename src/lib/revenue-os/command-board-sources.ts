import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommandBoardSource } from "./command-board-contract";
import {
  BOARD_SOURCE_ADAPTERS,
  boardReadsFromGraph,
  type BoardSourceReads,
} from "./command-board-summary";
import { GRAPH_MAX_LIMIT, type WorkspaceGraph } from "./graph-adapter-contract";
import { readWorkspaceGraph } from "./graph-adapters";
import type { RecordPermissionPrincipal } from "./record-permissions";

/** Pages read per source before its station counts show a "+": 1,000 open records. */
const MAX_PAGES = 5;

/**
 * Reads the open records board stations summarize through the workspace graph
 * adapters, so every source keeps its owning service, module claim and admin
 * check. Each source is its own read, so one large source cannot crowd the
 * others out of the graph's node cap.
 */
export async function readBoardSources(
  db: SupabaseClient,
  actor: RecordPermissionPrincipal,
  sources: readonly CommandBoardSource[],
): Promise<BoardSourceReads> {
  const pages = await Promise.all(
    sources.map(async (source) => {
      const adapter = BOARD_SOURCE_ADAPTERS[source];
      const graphs: WorkspaceGraph[] = [];
      let cursor: string | null = null;
      do {
        const graph = await readWorkspaceGraph(db, actor, {
          adapters: [adapter],
          open: true,
          links: false,
          limit: GRAPH_MAX_LIMIT,
          ...(cursor ? { cursors: { [adapter]: cursor } } : {}),
        });
        graphs.push(graph);
        const receipt = graph.sources[0];
        cursor = receipt?.state === "ready" ? receipt.nextCursor : null;
      } while (cursor && graphs.length < MAX_PAGES);
      return graphs;
    }),
  );
  return boardReadsFromGraph(pages.flat());
}
