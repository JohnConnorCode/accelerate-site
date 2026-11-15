import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { listTasks } from "./tasks";
import { listCompanies, listContacts, listOpportunities } from "./records";
import { listActions } from "./actions";
import { listConversations } from "./conversations";
import { readCollectionWorkspace } from "./collection-workspace";
import { readEntityLinksForNodes } from "./entity-registry";
import {
  authorizeGraphSource,
  moduleForGraphAdapter,
  type RecordPermissionDecision,
  type RecordPermissionPrincipal,
} from "./record-permissions";
import {
  GRAPH_ADAPTER_NAMES,
  GRAPH_ADAPTER_SOURCE_TYPES,
  GRAPH_DEFAULT_LIMIT,
  GRAPH_MAX_NODES,
  GRAPH_PROJECTIONS,
  assembleWorkspaceGraph,
  graphNodeId,
  keysetPage,
  parseGraphNodeId,
  workspaceGraphInputSchema,
  type GraphActionRow,
  type GraphAdapterName,
  type GraphCollectionCaseRow,
  type GraphCompanyRow,
  type GraphContactRow,
  type GraphNodeRef,
  type GraphOpportunityRow,
  type GraphProjection,
  type GraphSourceReceipt,
  type GraphTaskRow,
  type WorkspaceGraph,
  type WorkspaceGraphEdge,
} from "./graph-adapter-contract";

/**
 * Workspace graph adapter registry (Command Board step 2).
 *
 * One registry maps canonical records to canvas nodes. Each adapter reads
 * through the existing domain service that owns its records, always on the
 * caller's tenant-bound client with an explicit tenant filter, and a pure
 * projection (shared with the fictional demo) turns rows into nodes and
 * edges. Modules claim adapters by name in `graphAdapterNames`, exactly like
 * `aiToolNames`; `authorizeGraphSource` refuses an unclaimed adapter, a
 * disabled module, an unbound or inactive tenant, and any non-admin member.
 * A refused or failed source contributes zero nodes and its own receipt; it
 * never fails the whole graph. Nothing here writes, sweeps or calls a provider.
 */

export interface GraphAdapterReadInput {
  /** Exact source ids of this adapter's entity type. */
  ids?: string[];
  /** Anchor record: rows referencing it through this adapter's foreign keys. */
  relatedTo?: GraphNodeRef;
  limit: number;
  /** Keyset continuation: the last source id of the previous page. */
  cursor?: string;
}

export interface GraphAdapterReadResult<Row> {
  rows: Row[];
  truncated: boolean;
  nextCursor: string | null;
}

export interface GraphAdapter {
  name: GraphAdapterName;
  entityType: string;
  read(db: SupabaseClient, input: GraphAdapterReadInput): Promise<GraphAdapterReadResult<unknown>>;
  project(rows: unknown[]): GraphProjection;
}

function defineAdapter<Row>(adapter: {
  name: GraphAdapterName;
  read(db: SupabaseClient, input: GraphAdapterReadInput): Promise<GraphAdapterReadResult<Row>>;
  project(rows: Row[]): GraphProjection;
}): GraphAdapter {
  return {
    ...adapter,
    entityType: GRAPH_ADAPTER_SOURCE_TYPES[adapter.name],
  } as unknown as GraphAdapter;
}

const EMPTY = { rows: [], truncated: false, nextCursor: null };

/** Reads one row of lookahead so truncation is known without a count. */
function windowFor(input: GraphAdapterReadInput) {
  return input.ids
    ? { ids: input.ids, limit: input.ids.length }
    : { afterId: input.cursor, limit: input.limit + 1 };
}

function page<Row extends { id: string }>(
  rows: Row[],
  input: GraphAdapterReadInput,
): GraphAdapterReadResult<Row> {
  return input.ids ? { rows, truncated: false, nextCursor: null } : keysetPage(rows, input.limit);
}

/** Anchor of the adapter's own type is read by id; other anchors map to a foreign key. */
function anchorIds(input: GraphAdapterReadInput, type: string): string[] | undefined {
  return input.relatedTo?.type === type ? [input.relatedTo.id] : input.ids;
}

export const GRAPH_ADAPTERS: readonly GraphAdapter[] = [
  defineAdapter<GraphContactRow>({
    name: "contacts",
    async read(db, input) {
      const related = input.relatedTo;
      if (related && !["contact", "company"].includes(related.type)) return EMPTY;
      const ids = anchorIds(input, "contact");
      const scoped = { ...input, ids };
      const result = await listContacts(db, {
        companyId: related?.type === "company" ? related.id : undefined,
        window: windowFor(scoped),
      });
      return page(result.contacts as unknown as GraphContactRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.contacts,
  }),
  defineAdapter<GraphCompanyRow>({
    name: "companies",
    async read(db, input) {
      if (input.relatedTo && input.relatedTo.type !== "company") return EMPTY;
      const scoped = { ...input, ids: anchorIds(input, "company") };
      const result = await listCompanies(db, windowFor(scoped));
      return page(result.companies as unknown as GraphCompanyRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.companies,
  }),
  defineAdapter<GraphOpportunityRow>({
    name: "opportunities",
    async read(db, input) {
      const related = input.relatedTo;
      if (related && !["opportunity", "contact", "company"].includes(related.type)) return EMPTY;
      const scoped = { ...input, ids: anchorIds(input, "opportunity") };
      const result = await listOpportunities(db, {
        contactId: related?.type === "contact" ? related.id : undefined,
        companyId: related?.type === "company" ? related.id : undefined,
        window: windowFor(scoped),
      });
      if (!result.schemaReady) throw new Error("Opportunity schema is not installed");
      return page(result.opportunities as unknown as GraphOpportunityRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.opportunities,
  }),
  defineAdapter<GraphTaskRow>({
    name: "tasks",
    async read(db, input) {
      const related = input.relatedTo;
      const scoped = { ...input, ids: anchorIds(input, "task") };
      const window = windowFor(scoped);
      const result = await listTasks(db, {
        sortBy: "id",
        ids: window.ids,
        afterId: window.afterId,
        linkedTo: related && related.type !== "task" ? related : undefined,
        pageSize: window.limit,
      });
      return page(result.tasks as unknown as GraphTaskRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.tasks,
  }),
  defineAdapter<GraphActionRow>({
    name: "approvals",
    async read(db, input) {
      const related = input.relatedTo;
      const scoped = { ...input, ids: anchorIds(input, "action_queue") };
      const result = await listActions(db, {
        openOnly: true,
        entity: related && related.type !== "action_queue" ? related : undefined,
        window: windowFor(scoped),
      });
      if (!result.schemaReady) throw new Error("Approval schema is not installed");
      return page(result.actions as unknown as GraphActionRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.approvals,
  }),
  defineAdapter<{
    id: string;
    subject: string | null;
    channel: string;
    status: string;
    contact_id: string | null;
    company_id: string | null;
    opportunity_id: string | null;
  }>({
    name: "conversations",
    async read(db, input) {
      const related = input.relatedTo;
      if (related && !["conversation", "contact", "company", "opportunity"].includes(related.type))
        return EMPTY;
      const scoped = { ...input, ids: anchorIds(input, "conversation") };
      const result = await listConversations(db, {
        window: {
          ...windowFor(scoped),
          contactId: related?.type === "contact" ? related.id : undefined,
          companyId: related?.type === "company" ? related.id : undefined,
          opportunityId: related?.type === "opportunity" ? related.id : undefined,
        },
      });
      if (!result.schemaReady) throw new Error("Conversation schema is not installed");
      return page(result.conversations, scoped);
    },
    project: GRAPH_PROJECTIONS.conversations,
  }),
  defineAdapter<GraphCollectionCaseRow>({
    name: "collection_cases",
    async read(db, input) {
      const related = input.relatedTo;
      if (related && !["collection_case", "contact"].includes(related.type)) return EMPTY;
      const ids = anchorIds(input, "collection_case");
      // The Collections service bounds one read to 100 cases.
      const limit = Math.min(input.limit, 100);
      const view = await readCollectionWorkspace(
        db,
        related?.type === "contact" ? related.id : undefined,
        {
          order: "id",
          maxCases: ids ? Math.min(ids.length, 100) : limit,
          ...(ids ? { caseIds: ids } : input.cursor ? { afterId: input.cursor } : {}),
          includeInvoiceOptions: false,
          includeActionPreviews: false,
        },
      );
      const rows = view.cases as unknown as GraphCollectionCaseRow[];
      const truncated = !ids && view.casesTruncated === true;
      return {
        rows,
        truncated,
        nextCursor: truncated && rows.length ? rows[rows.length - 1]!.id : null,
      };
    },
    project: GRAPH_PROJECTIONS.collection_cases,
  }),
  defineAdapter<GraphActionRow>({
    name: "invoice_drafts",
    async read(db, input) {
      const related = input.relatedTo;
      if (related && !["action_queue", "contact"].includes(related.type)) return EMPTY;
      const scoped = { ...input, ids: anchorIds(input, "action_queue") };
      // Executed draft receipts already in action_queue; a graph read never calls Stripe.
      const result = await listActions(db, {
        status: "executed",
        actionType: "create_stripe_invoice_draft",
        payloadContactId: related?.type === "contact" ? related.id : undefined,
        window: windowFor(scoped),
      });
      if (!result.schemaReady) throw new Error("Invoice draft schema is not installed");
      return page(result.actions as unknown as GraphActionRow[], scoped);
    },
    project: GRAPH_PROJECTIONS.invoice_drafts,
  }),
];

const ADAPTERS_BY_NAME = new Map(GRAPH_ADAPTERS.map((adapter) => [adapter.name, adapter]));

export class GraphInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function denied(name: GraphAdapterName, decision: RecordPermissionDecision): GraphSourceReceipt {
  const code = decision.allowed ? "denied" : decision.code;
  return {
    adapter: name,
    state: code === "module_disabled" ? "module_disabled" : "denied",
    reason: code,
    nodes: 0,
    truncated: false,
    nextCursor: null,
  };
}

/**
 * Reads the workspace graph for an authenticated actor. `actor` is resolved
 * by the entrypoint (route session or tool request context), never by input.
 * Validation errors throw (ZodError or GraphInputError); source failures and
 * refusals are reported per source.
 */
export async function readWorkspaceGraph(
  db: SupabaseClient,
  actor: RecordPermissionPrincipal,
  rawInput: unknown,
): Promise<WorkspaceGraph> {
  const input = workspaceGraphInputSchema.parse(rawInput ?? {});
  const sourceIds = [
    ...(input.ids ?? []).map((nodeId) => parseGraphNodeId(nodeId).id),
    ...(input.relatedTo ? [parseGraphNodeId(input.relatedTo).id] : []),
    ...Object.values(input.cursors ?? {}).filter((value): value is string => Boolean(value)),
  ];
  if (sourceIds.some((id) => !UUID.test(id)))
    throw new GraphInputError("Graph node ids and cursors must reference workspace record ids");

  const limit = input.limit ?? GRAPH_DEFAULT_LIMIT;
  const requested: readonly GraphAdapterName[] = input.adapters
    ? GRAPH_ADAPTER_NAMES.filter((name) => input.adapters!.includes(name))
    : GRAPH_ADAPTER_NAMES;
  const relatedTo = input.relatedTo ? parseGraphNodeId(input.relatedTo) : undefined;
  const idsByType = new Map<string, string[]>();
  for (const nodeId of input.ids ?? []) {
    const ref = parseGraphNodeId(nodeId);
    idsByType.set(ref.type, [...new Set([...(idsByType.get(ref.type) ?? []), ref.id])]);
  }

  const receipts = new Map<GraphAdapterName, GraphSourceReceipt>();
  const projections = new Map<GraphAdapterName, GraphProjection[]>();
  const allowed: GraphAdapter[] = [];
  const tenantId = tenantIdForDatabase(db);

  // One decision per owning module: adapters of a module share its verdict.
  const decisions = new Map<string, Promise<RecordPermissionDecision>>();
  for (const name of requested) {
    const adapter = ADAPTERS_BY_NAME.get(name)!;
    const key = moduleForGraphAdapter(name) ?? `unclaimed:${name}`;
    if (!decisions.has(key))
      decisions.set(key, authorizeGraphSource(db, { principal: actor, adapter: name }));
    const decision = await decisions.get(key)!;
    if (!decision.allowed) {
      receipts.set(name, denied(name, decision));
      continue;
    }
    allowed.push(adapter);
    const ids = input.ids ? (idsByType.get(adapter.entityType) ?? []) : undefined;
    if (ids && !ids.length) {
      receipts.set(name, {
        adapter: name,
        state: "ready",
        nodes: 0,
        truncated: false,
        nextCursor: null,
      });
      continue;
    }
    try {
      const result = await adapter.read(db, {
        ids,
        relatedTo: ids ? undefined : relatedTo,
        limit,
        cursor: ids ? undefined : input.cursors?.[name],
      });
      const projection = adapter.project(result.rows);
      projections.set(name, [projection]);
      receipts.set(name, {
        adapter: name,
        state: "ready",
        nodes: projection.nodes.length,
        truncated: result.truncated,
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      console.error(
        "[graph-adapters] source read failed",
        name,
        error instanceof Error ? error.message : "unknown error",
      );
      receipts.set(name, unavailable(name));
    }
  }

  // An anchor's own foreign keys and stored links name records that do not
  // reference it back. Read those exact neighbors once, through the same
  // allowed adapters, so the anchor's edges have both endpoints.
  if (relatedTo && tenantId && allowed.length) {
    const anchorId = graphNodeId(relatedTo.type, relatedTo.id);
    const present = new Set(
      [...projections.values()].flat().flatMap((projection) => projection.nodes.map((n) => n.id)),
    );
    const neighbors = new Set<string>();
    for (const edge of [...projections.values()].flat().flatMap((p) => p.edges))
      if (edge.from === anchorId && !present.has(edge.to)) neighbors.add(edge.to);
    const anchorLinks = await readEntityLinksForNodes(db, tenantId, [relatedTo], { maxLinks: 200 });
    for (const link of anchorLinks.links) {
      const source = graphNodeId(link.sourceType, link.sourceId);
      const target = graphNodeId(link.targetType, link.targetId);
      const other = source === anchorId ? target : source;
      if (!present.has(other)) neighbors.add(other);
    }
    for (const adapter of allowed) {
      const receipt = receipts.get(adapter.name)!;
      if (receipt.state !== "ready") continue;
      const ids = [...neighbors]
        .map(parseGraphNodeId)
        .filter((ref) => ref.type === adapter.entityType && UUID.test(ref.id))
        .map((ref) => ref.id)
        .slice(0, limit);
      if (!ids.length) continue;
      try {
        const result = await adapter.read(db, { ids, limit: ids.length });
        const projection = adapter.project(result.rows);
        projections.set(adapter.name, [...(projections.get(adapter.name) ?? []), projection]);
        receipts.set(adapter.name, { ...receipt, nodes: receipt.nodes + projection.nodes.length });
      } catch (error) {
        console.error(
          "[graph-adapters] related read failed",
          adapter.name,
          error instanceof Error ? error.message : "unknown error",
        );
        projections.delete(adapter.name);
        receipts.set(adapter.name, unavailable(adapter.name));
      }
    }
  }

  const ordered = requested.flatMap((name) => projections.get(name) ?? []);
  const refs = [
    ...new Map(
      ordered.flatMap((projection) =>
        projection.nodes.map((n) => [n.id, { type: n.sourceType, id: n.sourceId }] as const),
      ),
    ).values(),
  ].slice(0, GRAPH_MAX_NODES);
  let links: WorkspaceGraph["links"] = { state: "skipped", truncated: false };
  let linkEdges: WorkspaceGraphEdge[] = [];
  if (tenantId && refs.length) {
    const read = await readEntityLinksForNodes(db, tenantId, refs);
    links = { state: read.available ? "ready" : "unavailable", truncated: read.truncated };
    linkEdges = read.links.map((link) => {
      const from = graphNodeId(link.sourceType, link.sourceId);
      const to = graphNodeId(link.targetType, link.targetId);
      return {
        id: `${from}|link:${link.linkType}|${to}`,
        from,
        to,
        relation: link.linkType,
        origin: "entity_link" as const,
      };
    });
  }

  return assembleWorkspaceGraph({
    projections: ordered,
    linkEdges,
    sources: requested.map((name) => receipts.get(name)!),
    links,
    perAdapter: limit,
  });
}

function unavailable(name: GraphAdapterName): GraphSourceReceipt {
  return {
    adapter: name,
    state: "unavailable",
    reason: "source_read_failed",
    nodes: 0,
    truncated: false,
    nextCursor: null,
  };
}
