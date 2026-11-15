import { ZodError } from "zod";
import {
  GRAPH_ADAPTER_NAMES,
  GRAPH_ADAPTER_SOURCE_TYPES,
  GRAPH_DEFAULT_LIMIT,
  GRAPH_PROJECTIONS,
  assembleWorkspaceGraph,
  graphNodeId,
  parseGraphNodeId,
  windowRows,
  workspaceGraphInputFromQuery,
  type GraphActionRow,
  type GraphAdapterName,
  type GraphCollectionCaseRow,
  type GraphCompanyRow,
  type GraphContactRow,
  type GraphConversationRow,
  type GraphOpportunityRow,
  type GraphProjection,
  type GraphSourceReceipt,
  type GraphTaskRow,
} from "@/lib/revenue-os/graph-adapter-contract";
import { isGraphAdapterModuleEnabled } from "@/lib/revenue-os/modules";

/** Fictional rows shaped like each live adapter's service read. */
export interface DemoGraphRows {
  contacts: GraphContactRow[];
  companies: GraphCompanyRow[];
  opportunities: GraphOpportunityRow[];
  tasks: GraphTaskRow[];
  approvals: GraphActionRow[];
  conversations: GraphConversationRow[];
  collection_cases: GraphCollectionCaseRow[];
  invoice_drafts: GraphActionRow[];
}

type Rows = Array<{ id: string }>;
const project = (name: GraphAdapterName, rows: Rows): GraphProjection =>
  (GRAPH_PROJECTIONS[name] as (rows: Rows) => GraphProjection)(rows);

/**
 * Simulates GET /api/admin/revenue-os/graph over scenario data with the same
 * input schema, module claims, keyset windows, pure projections and caps as
 * the live route. The demo has no stored entity links, so `links` is skipped.
 */
export function demoWorkspaceGraph(
  rows: DemoGraphRows,
  params: URLSearchParams,
  tenantConfig: { modules?: Partial<Record<string, boolean>> },
): { status: number; body: unknown } {
  let input;
  try {
    input = workspaceGraphInputFromQuery(params);
  } catch (error) {
    if (error instanceof ZodError)
      return {
        status: 400,
        body: {
          error: "Check the graph filters: adapters, ids, relatedTo, limit (1-200) and cursors.",
          code: "invalid_input",
        },
      };
    throw error;
  }
  const limit = input.limit ?? GRAPH_DEFAULT_LIMIT;
  const requested = input.adapters
    ? GRAPH_ADAPTER_NAMES.filter((name) => input.adapters!.includes(name))
    : GRAPH_ADAPTER_NAMES;
  const anchor = input.relatedTo ? parseGraphNodeId(input.relatedTo) : undefined;
  const anchorId = anchor ? graphNodeId(anchor.type, anchor.id) : undefined;
  const receipts: GraphSourceReceipt[] = [];
  const projections: GraphProjection[] = [];
  const enabled: GraphAdapterName[] = [];

  for (const name of requested) {
    const all: Rows = rows[name];
    if (!isGraphAdapterModuleEnabled(name, tenantConfig).enabled) {
      receipts.push({
        adapter: name,
        state: "module_disabled",
        reason: "module_disabled",
        nodes: 0,
        truncated: false,
        nextCursor: null,
      });
      continue;
    }
    enabled.push(name);
    const sourceType = GRAPH_ADAPTER_SOURCE_TYPES[name];
    const ids = input.ids
      ? input.ids
          .map(parseGraphNodeId)
          .filter((ref) => ref.type === sourceType)
          .map((ref) => ref.id)
      : undefined;
    let candidates = all;
    if (!ids && anchorId) {
      const full = project(name, all);
      const keep = new Set(
        full.nodes
          .filter(
            (node) =>
              node.id === anchorId ||
              full.edges.some((edge) => edge.from === node.id && edge.to === anchorId),
          )
          .map((node) => node.sourceId),
      );
      candidates = all.filter((row) => keep.has(row.id));
    }
    const page = windowRows(candidates, {
      ids,
      cursor: ids ? undefined : input.cursors?.[name],
      limit,
    });
    const projection = project(name, page.rows);
    projections.push(projection);
    receipts.push({
      adapter: name,
      state: "ready",
      nodes: projection.nodes.length,
      truncated: page.truncated,
      nextCursor: page.nextCursor,
    });
  }

  if (anchorId) {
    const present = new Set(projections.flatMap((p) => p.nodes.map((node) => node.id)));
    const missing = new Set(
      projections
        .flatMap((p) => p.edges)
        .filter((edge) => edge.from === anchorId && !present.has(edge.to))
        .map((edge) => edge.to),
    );
    for (const name of enabled) {
      const sourceType = GRAPH_ADAPTER_SOURCE_TYPES[name];
      const wanted = new Set(
        [...missing]
          .map(parseGraphNodeId)
          .filter((ref) => ref.type === sourceType)
          .map((ref) => ref.id),
      );
      if (!wanted.size) continue;
      const projection = project(
        name,
        (rows[name] as Rows).filter((row) => wanted.has(row.id)),
      );
      projections.push(projection);
      const receipt = receipts.find((item) => item.adapter === name)!;
      receipt.nodes += projection.nodes.length;
    }
  }

  return {
    status: 200,
    body: {
      ...assembleWorkspaceGraph({
        projections,
        sources: receipts,
        links: { state: "skipped", truncated: false },
        perAdapter: limit,
      }),
      simulated: true,
    },
  };
}
