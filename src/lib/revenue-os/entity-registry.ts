import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

/**
 * Open entity registry and polymorphic link graph (Plugin Platform phase 1,
 * primitive 1: Records).
 *
 * Entity types are rows, not an enum, so links, traversal, merge, and audit
 * work on a newly registered type the day it appears with zero code changes.
 * A meeting capability links a transcript to a contact to an opportunity to
 * a follow-up task through one table instead of four bespoke join tables.
 *
 * OWNERSHIP: every access goes through this module. A polymorphic table is
 * the one place a missing tenant filter leaks across every entity at once,
 * so each query below carries an explicit tenant scope and there are no
 * ad-hoc readers. No cascade deletes anywhere: history is not the plugin's
 * property.
 */

export interface ForeignKeyReference {
  table: string;
  column: string;
  idColumn?: string;
}

export interface EntityTypeRegistration {
  tenantId: string;
  /** Lowercase slug, e.g. "contact", "webinar". Validated, never guessed. */
  typeKey: string;
  label: string;
  backingTable: string;
  idColumn?: string;
  /** Concrete [{table, column}] pairs holding this type's ids; drives merge. */
  fkCatalog?: ForeignKeyReference[];
  /** Fields driving record resolution for this type. */
  identityFields?: string[];
  /**
   * Concrete column the merge path writes when retiring a duplicate:
   * "archived_at:now" stamps now(), a bare name sets boolean true.
   * NULL refuses merge loudly rather than guessing the convention.
   */
  softDeleteColumn?: string | null;
}

export interface EntityTypeRecord extends Required<Omit<EntityTypeRegistration, "softDeleteColumn">> {
  id: string;
  softDeleteColumn: string | null;
  isDisabled: boolean;
  metadata: Record<string, unknown>;
}

export interface EntityLinkInput {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityLink extends Required<Omit<EntityLinkInput, "metadata">> {
  id: string;
  metadata: Record<string, unknown>;
}

const TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_TRAVERSAL_DEPTH = 6;

function requireTenant(tenantId: string): string {
  const id = tenantId?.trim();
  if (!id) throw new Error("A tenant id is required for entity registry access");
  return id;
}

function requireId(value: string, what: string): string {
  const id = value?.trim();
  if (!id) throw new Error(`${what} is required`);
  return id;
}

function normalizeTypeKey(typeKey: string): string {
  const key = typeKey?.trim().toLowerCase();
  if (!key || !TYPE_KEY_PATTERN.test(key))
    throw new Error(`Invalid entity type key ${JSON.stringify(typeKey)}: use lowercase letters, digits, underscores`);
  return key;
}

/** Resolve the retire marker for a soft_delete_column spec. See the field docs. */
export function softDeleteValue(spec: string): { column: string; value: boolean | string } {
  const [column, mode] = spec.split(":");
  if (!column) throw new Error(`Invalid soft_delete_column spec ${JSON.stringify(spec)}`);
  if (mode === undefined) return { column, value: true };
  if (mode === "now") return { column, value: new Date().toISOString() };
  throw new Error(
    `Unsupported soft_delete_column mode ${JSON.stringify(mode)}: use "column" or "column:now"`,
  );
}

type Row = Record<string, unknown>;

function toTypeRecord(row: Row): EntityTypeRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    typeKey: String(row.type_key),
    label: String(row.label ?? ""),
    backingTable: String(row.backing_table ?? ""),
    idColumn: String(row.id_column ?? "id"),
    fkCatalog: (row.fk_catalog as ForeignKeyReference[]) ?? [],
    identityFields: (row.identity_fields as string[]) ?? [],
    softDeleteColumn: (row.soft_delete_column as string | null) ?? null,
    isDisabled: Boolean(row.is_disabled),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function toLink(row: Row): EntityLink {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    linkType: String(row.link_type ?? "relates_to"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Register (or re-register) an entity type. Idempotent: repeated registration
 * refreshes the declaration without duplicating it, and never clears an
 * admin-set is_disabled flag.
 */
export async function registerEntityType(
  supabase: SupabaseClient,
  input: EntityTypeRegistration,
): Promise<EntityTypeRecord> {
  const tenantId = requireTenant(input.tenantId);
  const typeKey = normalizeTypeKey(input.typeKey);
  const label = input.label?.trim();
  if (!label) throw new Error("An entity type label is required");
  const backingTable = input.backingTable?.trim();
  if (!backingTable) throw new Error("An entity backing table is required");
  const payload = {
    tenant_id: tenantId,
    type_key: typeKey,
    label,
    backing_table: backingTable,
    id_column: input.idColumn?.trim() || "id",
    fk_catalog: input.fkCatalog ?? [],
    identity_fields: input.identityFields ?? [],
    soft_delete_column: input.softDeleteColumn ?? null,
    metadata: {},
  };
  const { data: existing } = await supabase
    .from("entity_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type_key", typeKey)
    .maybeSingle();
  if (existing) {
    const { data, error } = await supabase
      .from("entity_types")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("type_key", typeKey)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not update entity type ${typeKey}: ${error.message}`);
    if (!data) throw new Error(`Entity type ${typeKey} vanished during registration`);
    return toTypeRecord(data as Row);
  }
  const { data, error } = await supabase
    .from("entity_types")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error) {
    // Lost a registration race: the winner now owns the row, re-read it.
    if ((error as { code?: string }).code === "23505") {
      const { data: raced, error: rereadError } = await supabase
        .from("entity_types")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("type_key", typeKey)
        .maybeSingle();
      if (rereadError || !raced) throw new Error(`Could not register entity type ${typeKey}`);
      return toTypeRecord(raced as Row);
    }
    throw new Error(`Could not register entity type ${typeKey}: ${error.message}`);
  }
  if (!data) throw new Error(`Could not register entity type ${typeKey}`);
  return toTypeRecord(data as Row);
}

export async function getEntityType(
  supabase: SupabaseClient,
  tenantId: string,
  typeKey: string,
): Promise<EntityTypeRecord | null> {
  const { data, error } = await supabase
    .from("entity_types")
    .select("*")
    .eq("tenant_id", requireTenant(tenantId))
    .eq("type_key", normalizeTypeKey(typeKey))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTypeRecord(data as Row) : null;
}

async function requireUsableType(
  supabase: SupabaseClient,
  tenantId: string,
  typeKey: string,
): Promise<EntityTypeRecord> {
  const type = await getEntityType(supabase, tenantId, typeKey);
  if (!type) throw new Error(`Unknown entity type ${JSON.stringify(typeKey)}`);
  if (type.isDisabled) throw new Error(`Entity type ${JSON.stringify(typeKey)} is disabled`);
  return type;
}

/**
 * Link two records. The (tenant, source, target, link type) tuple is the
 * idempotency key: a repeated write returns the existing edge instead of a
 * duplicate, through an upsert that is safe under concurrent writers.
 */
export async function linkEntities(
  supabase: SupabaseClient,
  input: EntityLinkInput,
): Promise<{ link: EntityLink; duplicate: boolean }> {
  const tenantId = requireTenant(input.tenantId);
  const sourceId = requireId(input.sourceId, "A link source id");
  const targetId = requireId(input.targetId, "A link target id");
  const [sourceType, targetType] = await Promise.all([
    requireUsableType(supabase, tenantId, input.sourceType).then((t) => t.typeKey),
    requireUsableType(supabase, tenantId, input.targetType).then((t) => t.typeKey),
  ]);
  const linkType = input.linkType?.trim() || "relates_to";
  const { error } = await supabase.from("entity_links").upsert(
    {
      tenant_id: tenantId,
      source_type: sourceType,
      source_id: sourceId,
      target_type: targetType,
      target_id: targetId,
      link_type: linkType,
      metadata: input.metadata ?? {},
    },
    {
      onConflict: "tenant_id,source_type,source_id,target_type,target_id,link_type",
      ignoreDuplicates: true,
    },
  );
  if (error) throw new Error(`Could not link ${sourceType}:${sourceId}: ${error.message}`);
  const { data, error: readError } = await supabase
    .from("entity_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("link_type", linkType)
    .maybeSingle();
  if (readError || !data) throw new Error(`Link receipt could not be recorded for ${sourceType}:${sourceId}`);
  return { link: toLink(data as Row), duplicate: false };
}

export interface TraversalNode {
  type: string;
  id: string;
}

export interface TraversalEdge {
  from: TraversalNode;
  to: TraversalNode;
  linkType: string;
}

/**
 * Bounded graph walk from one record. Depth is clamped to [1, 6] and visited
 * nodes are never re-expanded, so cycles terminate and the walk cannot become
 * an unbounded join. Follows edges in both directions; each edge records its
 * stored direction.
 */
export async function traverseGraph(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    startType: string;
    startId: string;
    maxDepth?: number;
    linkTypes?: string[];
  },
): Promise<{ nodes: TraversalNode[]; edges: TraversalEdge[] }> {
  const tenantId = requireTenant(input.tenantId);
  const startType = normalizeTypeKey(input.startType);
  const startId = requireId(input.startId, "A traversal start id");
  await requireUsableType(supabase, tenantId, startType);
  const maxDepth = Math.max(1, Math.min(MAX_TRAVERSAL_DEPTH, Math.floor(input.maxDepth ?? 3)));
  const linkFilter = (input.linkTypes ?? []).map((t) => t.trim()).filter(Boolean);

  const keyOf = (type: string, id: string) => `${type}:${id}`;
  const visited = new Set<string>([keyOf(startType, startId)]);
  const nodes: TraversalNode[] = [{ type: startType, id: startId }];
  const edges: TraversalEdge[] = [];
  let frontier: TraversalNode[] = [{ type: startType, id: startId }];

  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const types = [...new Set(frontier.map((n) => n.type))];
    const ids = [...new Set(frontier.map((n) => n.id))];
    // Two exact-sided reads rather than one nested-or: per-column IN filters
    // cross-match (type from one row, id from another), so every candidate is
    // re-checked against exact frontier pairs below. Exact pairs only.
    const columns = "source_type,source_id,target_type,target_id,link_type";
    const [outgoing, incoming] = await Promise.all([
      supabase
        .from("entity_links")
        .select(columns)
        .eq("tenant_id", tenantId)
        .in("source_type", types)
        .in("source_id", ids)
        .limit(200),
      supabase
        .from("entity_links")
        .select(columns)
        .eq("tenant_id", tenantId)
        .in("target_type", types)
        .in("target_id", ids)
        .limit(200),
    ]);
    if (outgoing.error) throw new Error(`Graph traversal failed: ${outgoing.error.message}`);
    if (incoming.error) throw new Error(`Graph traversal failed: ${incoming.error.message}`);
    const seenEdge = new Set<string>();
    const candidates: Row[] = [];
    for (const row of [...((outgoing.data ?? []) as Row[]), ...((incoming.data ?? []) as Row[])]) {
      const fingerprint = `${row.source_type}:${row.source_id}:${row.target_type}:${row.target_id}:${row.link_type}`;
      if (seenEdge.has(fingerprint)) continue;
      seenEdge.add(fingerprint);
      candidates.push(row);
    }
    if (linkFilter.length) {
      for (let i = candidates.length - 1; i >= 0; i -= 1) {
        if (!linkFilter.includes(String(candidates[i]!.link_type))) candidates.splice(i, 1);
      }
    }
    const next: TraversalNode[] = [];
    for (const row of candidates) {
      const from = { type: String(row.source_type), id: String(row.source_id) };
      const to = { type: String(row.target_type), id: String(row.target_id) };
      const touches = (n: TraversalNode) =>
        frontier.some((f) => f.type === n.type && f.id === n.id);
      if (!touches(from) && !touches(to)) continue;
      edges.push({ from, to, linkType: String(row.link_type ?? "relates_to") });
      for (const node of [from, to]) {
        if (!visited.has(keyOf(node.type, node.id))) {
          visited.add(keyOf(node.type, node.id));
          nodes.push(node);
          next.push(node);
        }
      }
    }
    frontier = next;
  }
  return { nodes, edges };
}

export interface MergeInput {
  tenantId: string;
  typeKey: string;
  winnerId: string;
  loserId: string;
  actorEmail: string;
  reason?: string | null;
}

/**
 * Generic duplicate merge: rewire every link touching the loser onto the
 * winner, reassign foreign references through the type's fk_catalog, then
 * soft-retire the loser and record an audit receipt. Refuses loudly when
 * the type has no soft_delete_column convention, when either record is
 * missing, or when the loser is already retired (retry-safe: a second run
 * reports, never corrupts).
 */
export async function mergeEntities(
  supabase: SupabaseClient,
  input: MergeInput,
): Promise<{ winnerId: string; movedLinks: number; movedReferences: number; alreadyMerged: boolean }> {
  const tenantId = requireTenant(input.tenantId);
  const type = await requireUsableType(supabase, tenantId, input.typeKey);
  const winnerId = requireId(input.winnerId, "A merge winner id");
  const loserId = requireId(input.loserId, "A merge loser id");
  if (winnerId === loserId) throw new Error("Cannot merge a record into itself");
  if (!type.softDeleteColumn)
    throw new Error(
      `Entity type ${JSON.stringify(type.typeKey)} declares no soft_delete_column, so merge refuses rather than guessing how to retire a duplicate`,
    );

  const idColumn = type.idColumn;
  const readRecord = async (id: string) => {
    const { data, error } = await supabase
      .from(type.backingTable)
      .select(`${idColumn}`)
      .eq("tenant_id", tenantId)
      .eq(idColumn, id)
      .maybeSingle();
    if (error) throw new Error(`Could not read ${type.typeKey}:${id}: ${error.message}`);
    return (data ?? null) as Row | null;
  };
  const [winner, loser] = await Promise.all([readRecord(winnerId), readRecord(loserId)]);
  if (!winner) throw new Error(`Merge winner ${type.typeKey}:${winnerId} does not exist`);
  if (!loser) throw new Error(`Merge loser ${type.typeKey}:${loserId} does not exist`);

  // Retry-safe: a loser retired by an earlier run means the merge already
  // converged. Report it instead of re-running (which would mint a duplicate
  // audit receipt for one business action). A crash between rewire and retire
  // leaves the loser unretired, so a retry resumes the remaining work.
  const marker = softDeleteValue(type.softDeleteColumn);
  const retiredMarker = loser[marker.column];
  if (retiredMarker !== null && retiredMarker !== undefined && retiredMarker !== false) {
    return { winnerId, movedLinks: 0, movedReferences: 0, alreadyMerged: true };
  }

  // Rewire links. A rewritten edge can collide with an identical winner edge
  // (same tuple): that row is the same fact twice, so drop the loser copy.
  let movedLinks = 0;
  const edgeColumns = "id,source_type,source_id,target_type,target_id,link_type";
  const [loserOutgoing, loserIncoming] = await Promise.all([
    supabase
      .from("entity_links")
      .select(edgeColumns)
      .eq("tenant_id", tenantId)
      .eq("source_type", type.typeKey)
      .eq("source_id", loserId),
    supabase
      .from("entity_links")
      .select(edgeColumns)
      .eq("tenant_id", tenantId)
      .eq("target_type", type.typeKey)
      .eq("target_id", loserId),
  ]);
  const loserEdges = [...((loserOutgoing.data ?? []) as Row[]), ...((loserIncoming.data ?? []) as Row[])];
  if (loserOutgoing.error) throw new Error(`Could not read links during merge: ${loserOutgoing.error.message}`);
  if (loserIncoming.error) throw new Error(`Could not read links during merge: ${loserIncoming.error.message}`);
  for (const edge of (loserEdges ?? []) as Row[]) {
    const rewrote = {
      source_type: edge.source_type,
      source_id: edge.source_type === type.typeKey && edge.source_id === loserId ? winnerId : edge.source_id,
      target_type: edge.target_type,
      target_id: edge.target_type === type.typeKey && edge.target_id === loserId ? winnerId : edge.target_id,
    };
    const { error } = await supabase
      .from("entity_links")
      .update({ ...rewrote })
      .eq("tenant_id", tenantId)
      .eq("id", edge.id);
    if (error && (error as { code?: string }).code === "23505") {
      await supabase.from("entity_links").delete().eq("tenant_id", tenantId).eq("id", edge.id);
      continue;
    }
    if (error) throw new Error(`Could not rewire a link during merge: ${error.message}`);
    movedLinks += 1;
  }

  // Reassign foreign references through the catalog.
  let movedReferences = 0;
  for (const ref of type.fkCatalog) {
    if (!ref.table || !ref.column) throw new Error(`Invalid fk_catalog entry for ${type.typeKey}`);
    const { data: reassigned, error } = await supabase
      .from(ref.table)
      .update({ [ref.column]: winnerId })
      .eq("tenant_id", tenantId)
      .eq(ref.column, loserId)
      .select("id");
    if (error) throw new Error(`Could not reassign ${ref.table}.${ref.column} during merge: ${error.message}`);
    movedReferences += ((reassigned ?? []) as Row[]).length;
  }

  // Retire the loser through the declared convention, then receipt it.
  const { error: retireError } = await supabase
    .from(type.backingTable)
    .update({ [marker.column]: marker.value })
    .eq("tenant_id", tenantId)
    .eq(idColumn, loserId);
  if (retireError) throw new Error(`Could not retire ${type.typeKey}:${loserId}: ${retireError.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "entity.merged",
    entityType: "entity",
    entityId: winnerId,
    source: "admin",
    metadata: {
      type_key: type.typeKey,
      winner_id: winnerId,
      loser_id: loserId,
      moved_links: movedLinks,
      moved_references: movedReferences,
      reason: input.reason ?? null,
    },
  });
  return { winnerId, movedLinks, movedReferences, alreadyMerged: false };
}
