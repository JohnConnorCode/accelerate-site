import { z } from "zod";

/**
 * Browser-safe workspace graph contract shared by the live adapters
 * (graph-adapters.ts, server-only) and the fictional demo runtime.
 *
 * A graph is a read-only projection of canonical records. Each adapter reads
 * through an existing domain service and a pure `project` function maps the
 * returned rows to nodes and edges. Node ids are `sourceType:sourceId`, so
 * two adapters that read the same canonical row produce the same node. A
 * node's `status` is a display copy of what the source read returned; the
 * graph never stores, derives or changes a lifecycle.
 */
export const WORKSPACE_GRAPH_CONTRACT = "revenue-os-workspace-graph.v1";

export const GRAPH_DEFAULT_LIMIT = 50;
export const GRAPH_MAX_LIMIT = 200;
export const GRAPH_MAX_NODES = 500;
export const GRAPH_MAX_EDGES = 1000;
export const GRAPH_MAX_IDS = 200;

export const GRAPH_ADAPTER_NAMES = [
  "contacts",
  "companies",
  "opportunities",
  "tasks",
  "approvals",
  "conversations",
  "collection_cases",
  "invoices",
] as const;
export type GraphAdapterName = (typeof GRAPH_ADAPTER_NAMES)[number];

/** Canonical source entity per adapter. A collection case links to the same
 * invoice node the invoices adapter projects. */
export const GRAPH_ADAPTER_SOURCE_TYPES: Record<GraphAdapterName, string> = {
  contacts: "contact",
  companies: "company",
  opportunities: "opportunity",
  tasks: "task",
  approvals: "action_queue",
  conversations: "conversation",
  collection_cases: "collection_case",
  invoices: "invoice",
};

export type GraphNodeKind =
  | "contact"
  | "company"
  | "opportunity"
  | "task"
  | "approval"
  | "conversation"
  | "collection_case"
  | "invoice";

export interface WorkspaceGraphNode {
  /** `sourceType:sourceId`. */
  id: string;
  sourceType: string;
  sourceId: string;
  kind: GraphNodeKind;
  adapter: GraphAdapterName;
  label: string;
  detail: string | null;
  /** Display copy of the source record's own status, never a graph-owned state. */
  status: string | null;
  /** The record's own due or next-action date, when it has one. */
  dueAt: string | null;
  /** The record itself asks for a person: unread messages, a pending approval
   * or an open balance. Date-based judgements are left to the reader's clock. */
  attention: boolean;
  href: string | null;
}

export interface WorkspaceGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  /** `record`: a foreign key on the source row. `entity_link`: a stored link. */
  origin: "record" | "entity_link";
}

export interface GraphProjection {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
}

export type GraphSourceState = "ready" | "denied" | "module_disabled" | "unavailable";

export interface GraphSourceReceipt {
  adapter: GraphAdapterName;
  state: GraphSourceState;
  reason?: string;
  nodes: number;
  truncated: boolean;
  nextCursor: string | null;
}

export interface WorkspaceGraph {
  contract: typeof WORKSPACE_GRAPH_CONTRACT;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  sources: GraphSourceReceipt[];
  links: { state: "ready" | "unavailable" | "skipped"; truncated: boolean };
  truncated: { nodes: boolean; edges: boolean; sources: boolean };
  limits: { perAdapter: number; maxNodes: number; maxEdges: number };
}

export interface GraphNodeRef {
  type: string;
  id: string;
}

/** Plain identifiers only: no PostgREST operators, separators or quotes. */
const sourceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/, "Use a record id");
export const graphNodeIdSchema = z
  .string()
  .max(200)
  .regex(/^[a-z][a-z0-9_]{0,63}:[A-Za-z0-9_.-]{1,128}$/, "Use a node id such as contact:<id>");

const cursorShape = Object.fromEntries(
  GRAPH_ADAPTER_NAMES.map((name) => [name, sourceIdSchema.optional()]),
) as Record<GraphAdapterName, z.ZodOptional<typeof sourceIdSchema>>;

export const workspaceGraphInputSchema = z
  .object({
    adapters: z
      .array(z.enum(GRAPH_ADAPTER_NAMES))
      .min(1)
      .max(GRAPH_ADAPTER_NAMES.length)
      .optional(),
    ids: z.array(graphNodeIdSchema).min(1).max(GRAPH_MAX_IDS).optional(),
    relatedTo: graphNodeIdSchema.optional(),
    limit: z.number().int().min(1).max(GRAPH_MAX_LIMIT).optional(),
    cursors: z.object(cursorShape).strict().optional(),
    /** Only records still in progress (see GRAPH_OPEN_STATES). */
    open: z.boolean().optional(),
    /** `false` skips stored entity links when only nodes are needed. */
    links: z.boolean().optional(),
  })
  .strict();
export type WorkspaceGraphInput = z.input<typeof workspaceGraphInputSchema>;
export type ParsedWorkspaceGraphInput = z.output<typeof workspaceGraphInputSchema>;

export function graphNodeId(type: string, id: string): string {
  return `${type}:${id}`;
}

export function parseGraphNodeId(nodeId: string): GraphNodeRef {
  const index = nodeId.indexOf(":");
  return { type: nodeId.slice(0, index), id: nodeId.slice(index + 1) };
}

type OpenRule = { field: string; open?: readonly string[]; closed?: readonly string[] };

/**
 * What `open: true` keeps, per source with a lifecycle. Live adapters push the
 * same lists into their queries and the demo filters rows with
 * `isOpenGraphRow`. Approvals are always pending; contacts, companies and
 * invoice drafts have no open state and are returned as read.
 */
export const GRAPH_OPEN_STATES = {
  tasks: { field: "status", open: ["pending", "snoozed"] },
  opportunities: { field: "stage", closed: ["won", "lost"] },
  conversations: { field: "status", open: ["open", "waiting"] },
  collection_cases: { field: "status", open: ["open"] },
  invoices: { field: "status", open: ["draft", "open", "processing"] },
} as const satisfies Partial<Record<GraphAdapterName, OpenRule>>;

export function isOpenGraphRow(adapter: GraphAdapterName, row: object): boolean {
  const rule: OpenRule | undefined = GRAPH_OPEN_STATES[adapter as keyof typeof GRAPH_OPEN_STATES];
  if (!rule) return true;
  const value = String((row as Record<string, unknown>)[rule.field] ?? "");
  return rule.open ? rule.open.includes(value) : !rule.closed?.includes(value);
}

/**
 * Parses the HTTP query form into the same input the tool accepts:
 * `adapters=contacts,tasks&ids=contact:<id>,task:<id>&relatedTo=contact:<id>`
 * `&limit=50&cursor.contacts=<id>&open=true&links=false`. Validation is the
 * shared schema.
 */
export function workspaceGraphInputFromQuery(params: URLSearchParams): ParsedWorkspaceGraphInput {
  const list = (key: string) =>
    params
      .get(key)
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const cursors: Record<string, string> = {};
  for (const [key, value] of params.entries())
    if (key.startsWith("cursor.")) cursors[key.slice("cursor.".length)] = value;
  const limit = params.get("limit");
  const raw: Record<string, unknown> = {};
  const adapters = list("adapters");
  const ids = list("ids");
  if (adapters?.length) raw.adapters = adapters;
  if (ids?.length) raw.ids = ids;
  if (params.get("relatedTo")) raw.relatedTo = params.get("relatedTo");
  if (limit !== null) raw.limit = Number(limit);
  if (Object.keys(cursors).length) raw.cursors = cursors;
  for (const flag of ["open", "links"] as const)
    if (params.has(flag)) raw[flag] = params.get(flag) === "true";
  return workspaceGraphInputSchema.parse(raw);
}

/** Keyset page over rows already ordered by id and read with one row of lookahead. */
export function keysetPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { rows: T[]; truncated: boolean; nextCursor: string | null } {
  const truncated = rows.length > limit;
  const page = truncated ? rows.slice(0, limit) : rows;
  return { rows: page, truncated, nextCursor: truncated ? page[page.length - 1]!.id : null };
}

/** The same keyset window over an in-memory row set (fictional demo data). */
export function windowRows<T extends { id: string }>(
  rows: T[],
  input: { ids?: string[]; cursor?: string; limit: number },
): { rows: T[]; truncated: boolean; nextCursor: string | null } {
  const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (input.ids) {
    const wanted = new Set(input.ids);
    return {
      rows: sorted.filter((row) => wanted.has(row.id)).slice(0, input.limit),
      truncated: false,
      nextCursor: null,
    };
  }
  const after = input.cursor;
  return keysetPage(
    sorted.filter((row) => after === undefined || row.id > after).slice(0, input.limit + 1),
    input.limit,
  );
}

type Text = string | null | undefined;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function node(
  adapter: GraphAdapterName,
  kind: GraphNodeKind,
  sourceId: string,
  label: string,
  detail: Text,
  status: Text,
  href: string | null,
  signals: { dueAt?: Text; attention?: boolean } = {},
): WorkspaceGraphNode {
  const sourceType = GRAPH_ADAPTER_SOURCE_TYPES[adapter];
  return {
    id: graphNodeId(sourceType, sourceId),
    sourceType,
    sourceId,
    kind,
    adapter,
    label: label.slice(0, 160),
    detail: detail ? detail.slice(0, 160) : null,
    status: status ? status.slice(0, 60) : null,
    dueAt: text(signals.dueAt),
    attention: signals.attention ?? false,
    href,
  };
}

function edge(
  from: string,
  targetType: string,
  targetId: unknown,
  relation: string,
): WorkspaceGraphEdge[] {
  const id = text(targetId);
  if (!id || !/^[a-z][a-z0-9_]{0,63}$/.test(targetType)) return [];
  const to = graphNodeId(targetType, id);
  if (to === from) return [];
  return [{ id: `${from}|${relation}|${to}`, from, to, relation, origin: "record" }];
}

export interface GraphContactRow {
  id: string;
  full_name?: Text;
  primary_email?: Text;
  title?: Text;
  next_action_at?: Text;
  lifecycle_stage?: Text;
  company_id?: Text;
}
export interface GraphCompanyRow {
  id: string;
  name?: Text;
  domain?: Text;
  industry?: Text;
}
export interface GraphOpportunityRow {
  id: string;
  name?: Text;
  stage?: Text;
  next_action_at?: Text;
  contact_id?: Text;
  company_id?: Text;
}
export interface GraphTaskRow {
  id: string;
  title?: Text;
  status?: Text;
  due_date?: Text;
  related_type?: Text;
  related_id?: Text;
  opportunity_id?: Text;
  contact_id?: Text;
}
export interface GraphActionRow {
  id: string;
  title?: Text;
  action_type?: Text;
  status?: Text;
  entity_type?: Text;
  entity_id?: Text;
  payload?: unknown;
}
export interface GraphConversationRow {
  id: string;
  subject?: Text;
  channel?: Text;
  status?: Text;
  unread_count?: number | null;
  contact_id?: Text;
  company_id?: Text;
  opportunity_id?: Text;
}
export interface GraphCollectionCaseRow {
  id: string;
  contactId?: Text;
  name?: Text;
  currency?: Text;
  status?: Text;
  nextAction?: Text;
  invoices?: Array<{ invoiceId?: Text }>;
}
export interface GraphInvoiceRow {
  id: string;
  number?: Text;
  company_name?: Text;
  status?: Text;
  amount_cents?: number | null;
  contact_id?: Text;
  due_at?: Text;
}

/** Source row shape each adapter's projection accepts. A missing adapter key fails type checking. */
export interface GraphRowMap {
  contacts: GraphContactRow;
  companies: GraphCompanyRow;
  opportunities: GraphOpportunityRow;
  tasks: GraphTaskRow;
  approvals: GraphActionRow;
  conversations: GraphConversationRow;
  collection_cases: GraphCollectionCaseRow;
  invoices: GraphInvoiceRow;
}
export type GraphProjections = {
  [K in GraphAdapterName]: (rows: GraphRowMap[K][]) => GraphProjection;
};

/** Pure projections. The demo runtime calls the same functions over fictional rows. */
export const GRAPH_PROJECTIONS: GraphProjections = {
  contacts: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "contacts",
        "contact",
        row.id,
        text(row.full_name) ?? text(row.primary_email) ?? "Unnamed contact",
        text(row.title) ?? row.primary_email,
        row.lifecycle_stage,
        `/admin/contacts/${encodeURIComponent(row.id)}`,
        { dueAt: row.next_action_at },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) =>
        edge(nodes[index]!.id, "company", row.company_id, "works_at"),
      ),
    };
  },
  companies: (rows) => ({
    nodes: rows.map((row) =>
      node(
        "companies",
        "company",
        row.id,
        text(row.name) ?? text(row.domain) ?? "Unnamed company",
        row.domain ?? row.industry,
        null,
        null,
      ),
    ),
    edges: [],
  }),
  opportunities: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "opportunities",
        "opportunity",
        row.id,
        text(row.name) ?? "Untitled opportunity",
        null,
        row.stage,
        `/admin/pipeline/${encodeURIComponent(row.id)}`,
        { dueAt: row.next_action_at },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) => [
        ...edge(nodes[index]!.id, "contact", row.contact_id, "contact"),
        ...edge(nodes[index]!.id, "company", row.company_id, "company"),
      ]),
    };
  },
  tasks: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "tasks",
        "task",
        row.id,
        text(row.title) ?? "Untitled task",
        row.due_date ? `Due ${row.due_date}` : null,
        row.status,
        `/admin/work?task=${encodeURIComponent(row.id)}`,
        { dueAt: row.due_date },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) => {
        const from = nodes[index]!.id;
        const relatedType = text(row.related_type);
        return [
          ...edge(from, "opportunity", row.opportunity_id, "opportunity"),
          ...edge(from, "contact", row.contact_id, "contact"),
          ...(relatedType ? edge(from, relatedType, row.related_id, "related") : []),
        ];
      }),
    };
  },
  approvals: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "approvals",
        "approval",
        row.id,
        text(row.title) ?? "Pending approval",
        row.action_type,
        row.status,
        `/admin/work?tab=approvals&action=${encodeURIComponent(row.id)}`,
        { attention: row.status === "pending" },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) => {
        const entityType = text(row.entity_type);
        return entityType ? edge(nodes[index]!.id, entityType, row.entity_id, "about") : [];
      }),
    };
  },
  conversations: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "conversations",
        "conversation",
        row.id,
        text(row.subject) ?? "Conversation without a subject",
        row.channel,
        row.status,
        `/admin/conversations?thread=${encodeURIComponent(row.id)}`,
        { attention: (row.unread_count ?? 0) > 0 },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) => [
        ...edge(nodes[index]!.id, "contact", row.contact_id, "contact"),
        ...edge(nodes[index]!.id, "company", row.company_id, "company"),
        ...edge(nodes[index]!.id, "opportunity", row.opportunity_id, "opportunity"),
      ]),
    };
  },
  collection_cases: (rows) => {
    const nodes = rows.map((row) =>
      node(
        "collection_cases",
        "collection_case",
        row.id,
        `${text(row.name) ?? "Billing contact"}${row.currency ? ` (${row.currency.toUpperCase()})` : ""}`,
        row.nextAction,
        row.status,
        `/admin/collections?case=${encodeURIComponent(row.id)}`,
        { attention: row.status === "open" },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) => [
        ...edge(nodes[index]!.id, "contact", row.contactId, "billing_contact"),
        ...(row.invoices ?? []).flatMap((invoice) =>
          edge(nodes[index]!.id, "invoice", invoice.invoiceId, "invoice"),
        ),
      ]),
    };
  },
  invoices: (rows) => {
    const statusLabels: Record<string, string> = {
      draft: "Draft",
      open: "Awaiting payment",
      processing: "Payment processing",
      paid: "Paid",
      paid_external: "Paid outside Stripe",
      void: "Void",
    };
    const nodes = rows.map((row) =>
      node(
        "invoices",
        "invoice",
        row.id,
        [text(row.number), text(row.company_name)].filter(Boolean).join(" · ") || "Invoice",
        typeof row.amount_cents === "number"
          ? `$${(row.amount_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null,
        statusLabels[String(row.status)] ?? row.status,
        `/admin/invoicing?invoiceId=${encodeURIComponent(row.id)}`,
        { dueAt: row.due_at, attention: row.status === "open" || row.status === "processing" },
      ),
    );
    return {
      nodes,
      edges: rows.flatMap((row, index) =>
        edge(nodes[index]!.id, "contact", row.contact_id, "customer"),
      ),
    };
  },
};

/**
 * Combines adapter projections and stored links under the response caps. An
 * edge survives only when both endpoints are in the final node set, so a link
 * can never introduce a record the caller did not read.
 */
export function assembleWorkspaceGraph(input: {
  projections: GraphProjection[];
  linkEdges?: WorkspaceGraphEdge[];
  sources: GraphSourceReceipt[];
  links: WorkspaceGraph["links"];
  perAdapter: number;
}): WorkspaceGraph {
  const nodes = new Map<string, WorkspaceGraphNode>();
  let nodesTruncated = false;
  for (const projection of input.projections)
    for (const candidate of projection.nodes) {
      if (nodes.has(candidate.id)) continue;
      if (nodes.size >= GRAPH_MAX_NODES) {
        nodesTruncated = true;
        continue;
      }
      nodes.set(candidate.id, candidate);
    }
  const edges = new Map<string, WorkspaceGraphEdge>();
  let edgesTruncated = false;
  for (const candidate of [
    ...input.projections.flatMap((projection) => projection.edges),
    ...(input.linkEdges ?? []),
  ]) {
    if (edges.has(candidate.id) || !nodes.has(candidate.from) || !nodes.has(candidate.to)) continue;
    if (edges.size >= GRAPH_MAX_EDGES) {
      edgesTruncated = true;
      continue;
    }
    edges.set(candidate.id, candidate);
  }
  return {
    contract: WORKSPACE_GRAPH_CONTRACT,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    sources: input.sources,
    links: input.links,
    truncated: {
      nodes: nodesTruncated,
      edges: edgesTruncated,
      sources: input.sources.some((source) => source.truncated),
    },
    limits: { perAdapter: input.perAdapter, maxNodes: GRAPH_MAX_NODES, maxEdges: GRAPH_MAX_EDGES },
  };
}
