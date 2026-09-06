import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabase, tenantIdForDatabase } from "@/lib/supabase/server";
import { getEntityType, validateEntityIdentifier } from "./entity-registry";

/** Host-only data boundary. The host supplies authenticated tenant context and
 * approved grants; plugin input must never supply either. Core writes remain
 * actions through the executor. The four exports expose no database handle. */
export interface CapabilityGrant {
  capabilityId: string;
  tenantId: string;
  entities: string[];
  recipes: string[];
  namespace: boolean;
}
export interface CapabilityUsageReceipt {
  capabilityId: string;
  tenantId: string;
  operation: string;
  /** Data rows fetched, including lookahead and duplicate graph endpoints.
   * Registry authorization reads are excluded. */
  rowsRead: number;
  rowsWritten: number;
  truncated: boolean;
  budgetRemaining: number;
}
export interface CapabilityQueryFilter {
  column: string;
  op: "eq" | "neq" | "in" | "ilike" | "gt" | "lt";
  value: unknown;
}
const MAX_ROWS = 100;
const MAX_GRANTS = 32;
const NAMESPACE_VALUE_BYTES = 8192;
const SLUG = /^[a-z][a-z0-9_-]{0,63}$/;
const KEY = /^[a-z0-9_-]{1,64}$/;
const WINDOW_MS = 60_000;
const MAX_CALLS = 120;
const MAX_BUCKETS = 10_000;
type Row = Record<string, unknown>;
type Scope = { db: SupabaseClient; grant: CapabilityGrant; budgetRemaining: number };

// This is only a bounded per-process safety guard, not durable or distributed
// accounting. Persisted plugin metering retains its own Feature Board acceptance.
const callBudget = new Map<string, number[]>();
function checkRateLimit(capabilityId: string, tenantId: string): number {
  const now = Date.now();
  for (const [key, times] of callBudget) {
    if ((times.at(-1) ?? 0) <= now - WINDOW_MS) callBudget.delete(key);
  }
  const key = JSON.stringify([tenantId, capabilityId]);
  const window = (callBudget.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (window.length >= MAX_CALLS)
    throw new Error(`Capability rate budget exhausted for ${capabilityId}`);
  if (!callBudget.has(key) && callBudget.size >= MAX_BUCKETS)
    throw new Error("Capability rate guard capacity exhausted; retry later");
  window.push(now);
  callBudget.set(key, window);
  return MAX_CALLS - window.length;
}
function grantKeys(input: unknown, label: string): string[] {
  if (
    !Array.isArray(input) ||
    input.length > MAX_GRANTS ||
    input.some((key) => typeof key !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(key))
  )
    throw new Error(`Invalid ${label} grants`);
  return [...new Set(input)];
}
function scope(database: SupabaseClient, input: CapabilityGrant): Scope {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId || !input || input.tenantId !== tenantId)
    throw new Error("Capability access requires a matching tenant-bound host database");
  if (
    typeof input.capabilityId !== "string" ||
    !SLUG.test(input.capabilityId) ||
    typeof input.namespace !== "boolean"
  )
    throw new Error("Invalid capability grant");
  // Snapshot authority before the first await so caller mutation cannot expand it.
  const grant = {
    tenantId,
    capabilityId: input.capabilityId,
    namespace: input.namespace,
    entities: grantKeys(input.entities, "entity"),
    recipes: grantKeys(input.recipes, "recipe"),
  };
  return {
    db: bindTenantDatabase(database, tenantId, true),
    grant,
    budgetRemaining: checkRateLimit(grant.capabilityId, tenantId),
  };
}
function receipt(
  context: Scope,
  operation: string,
  rowsRead: number,
  rowsWritten = 0,
  truncated = false,
): CapabilityUsageReceipt {
  return {
    capabilityId: context.grant.capabilityId,
    tenantId: context.grant.tenantId,
    operation,
    rowsRead,
    rowsWritten,
    truncated,
    budgetRemaining: context.budgetRemaining,
  };
}
function limitOf(input: unknown, fallback = MAX_ROWS): number {
  if (input === undefined) return fallback;
  if (typeof input !== "number" || !Number.isInteger(input) || input < 1 || input > MAX_ROWS)
    throw new Error(`Capability limit must be an integer between 1 and ${MAX_ROWS}`);
  return input;
}
async function grantedType(context: Scope, key: string) {
  if (typeof key !== "string" || !context.grant.entities.includes(key))
    throw new Error(`Capability is not granted entity type ${JSON.stringify(key)}`);
  const type = await getEntityType(context.db, context.grant.tenantId, key);
  if (!type) throw new Error(`Unknown entity type ${JSON.stringify(key)}`);
  if (type.isDisabled) throw new Error(`Entity type ${JSON.stringify(key)} is disabled`);
  validateEntityIdentifier(type.backingTable);
  validateEntityIdentifier(type.idColumn);
  return type;
}
function readableColumns(metadata: Row, id: string): string[] {
  const extra = metadata.readable_columns ?? [];
  if (!Array.isArray(extra) || extra.length > 64)
    throw new Error("Invalid readable column declaration");
  return [
    ...new Set([id, "tenant_id", ...extra.map((column) => validateEntityIdentifier(column))]),
  ];
}
function project(row: Row, columns: string[]): Row {
  return Object.fromEntries(
    columns.filter((column) => Object.hasOwn(row, column)).map((column) => [column, row[column]]),
  );
}
function scalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && Buffer.byteLength(value, "utf8") <= 1024)
  );
}
function filtersOf(input: unknown): CapabilityQueryFilter[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 20)
    throw new Error("Capability filters must be a bounded array");
  return input.map((filter) => {
    if (!filter || typeof filter !== "object") throw new Error("Invalid capability filter");
    const { column, op, value } = filter;
    validateEntityIdentifier(column);
    if (
      !["eq", "neq", "in", "ilike", "gt", "lt"].includes(op) ||
      (op === "in"
        ? !Array.isArray(value) ||
          value.length < 1 ||
          value.length > MAX_ROWS ||
          !value.every(scalar)
        : !scalar(value) ||
          (op === "ilike" && typeof value !== "string") ||
          (["gt", "lt"].includes(op) && value == null))
    )
      throw new Error(`Unsupported capability filter ${JSON.stringify(op)}`);
    return { column, op, value: Array.isArray(value) ? [...value] : value };
  });
}
export async function queryCapabilityEntities(
  database: SupabaseClient,
  grant: CapabilityGrant,
  input: { type: string; filters?: CapabilityQueryFilter[]; limit?: number },
): Promise<{ rows: Row[]; usage: CapabilityUsageReceipt }> {
  const context = scope(database, grant);
  const limit = limitOf(input.limit);
  const filters = filtersOf(input.filters);
  const type = await grantedType(context, input.type);
  const columns = readableColumns(type.metadata, type.idColumn);
  let query = context.db
    .from(type.backingTable)
    .select(columns.join(","))
    .eq("tenant_id", context.grant.tenantId);
  for (const filter of filters) {
    if (!columns.includes(filter.column))
      throw new Error(`Column ${JSON.stringify(filter.column)} is not readable on ${type.typeKey}`);
    const { column, value } = filter;
    if (filter.op === "eq")
      query = value === null ? query.is(column, null) : query.eq(column, value);
    else if (filter.op === "neq")
      query = value === null ? query.not(column, "is", null) : query.neq(column, value);
    else if (filter.op === "in") query = query.in(column, value as unknown[]);
    else if (filter.op === "ilike") query = query.ilike(column, `%${String(value)}%`);
    else if (filter.op === "gt") query = query.gt(column, value);
    else query = query.lt(column, value);
  }
  const { data, error } = await query.order(type.idColumn).limit(limit + 1);
  if (error) throw new Error(`Capability entity query failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];
  return {
    rows: rows.slice(0, limit).map((row) => project(row, columns)),
    usage: receipt(context, `query:${type.typeKey}`, rows.length, 0, rows.length > limit),
  };
}

const RECIPES = ["entity_count", "link_degree", "recent_links"];
const LINK_COLUMNS = [
  "id",
  "source_type",
  "source_id",
  "target_type",
  "target_id",
  "link_type",
  "created_at",
];
async function enabledGraphTypes(context: Scope): Promise<string[]> {
  if (!context.grant.entities.length) return [];
  const { data, error } = await context.db
    .from("entity_types")
    .select("type_key,is_disabled")
    .eq("tenant_id", context.grant.tenantId)
    .in("type_key", context.grant.entities);
  if (error) throw new Error(`Graph authorization failed: ${error.message}`);
  return (data ?? []).filter((row) => row.is_disabled === false).map((row) => String(row.type_key));
}
function graphQuery(context: Scope, types: string[]) {
  return context.db
    .from("entity_links")
    .select(LINK_COLUMNS.join(","))
    .eq("tenant_id", context.grant.tenantId)
    .in("source_type", types)
    .in("target_type", types);
}
export async function runCapabilityRecipe(
  database: SupabaseClient,
  grant: CapabilityGrant,
  input: { recipe: string; params?: Record<string, unknown> },
): Promise<{ result: Row; usage: CapabilityUsageReceipt }> {
  const context = scope(database, grant);
  const recipe = input.recipe;
  if (!RECIPES.includes(recipe) || !context.grant.recipes.includes(recipe))
    throw new Error(`Capability is not granted recipe ${JSON.stringify(recipe)}`);
  if (
    input.params !== undefined &&
    (!input.params || typeof input.params !== "object" || Array.isArray(input.params))
  )
    throw new Error("Recipe params must be an object");
  const params = { ...input.params };
  if (recipe === "entity_count") {
    const type = await grantedType(context, params.type as string);
    const { data, error } = await context.db
      .from(type.backingTable)
      .select(type.idColumn)
      .eq("tenant_id", context.grant.tenantId)
      .limit(MAX_ROWS + 1);
    if (error) throw new Error(`Recipe entity_count failed: ${error.message}`);
    const length = data?.length ?? 0;
    return {
      result: { type: type.typeKey, count: Math.min(length, MAX_ROWS), capped: length > MAX_ROWS },
      usage: receipt(context, `recipe:${recipe}`, length, 0, length > MAX_ROWS),
    };
  }
  const limit = recipe === "recent_links" ? limitOf(params.limit, 20) : MAX_ROWS;
  // An ID without a type is ambiguous in a polymorphic graph.
  const typeKey = params.type;
  const id = params.id;
  if (recipe === "link_degree") {
    if (typeof id !== "string" || !id.trim() || Buffer.byteLength(id, "utf8") > 256)
      throw new Error("Recipe link_degree requires bounded params.id and params.type");
    await grantedType(context, typeKey as string);
  }
  const types = await enabledGraphTypes(context);
  let rows: Row[] = [];
  let rowsRead = 0;
  if (types.length) {
    if (recipe === "recent_links") {
      const { data, error } = await graphQuery(context, types)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(limit + 1);
      if (error) throw new Error(`Recipe recent_links failed: ${error.message}`);
      rows = (data ?? []) as unknown as Row[];
      rowsRead = rows.length;
    } else {
      const [outgoing, incoming] = await Promise.all([
        graphQuery(context, types)
          .eq("source_type", typeKey)
          .eq("source_id", id)
          .order("id")
          .limit(limit + 1),
        graphQuery(context, types)
          .eq("target_type", typeKey)
          .eq("target_id", id)
          .order("id")
          .limit(limit + 1),
      ]);
      if (outgoing.error || incoming.error)
        throw new Error(
          `Recipe link_degree failed: ${outgoing.error?.message ?? incoming.error?.message}`,
        );
      const fetched = [...(outgoing.data ?? []), ...(incoming.data ?? [])] as unknown as Row[];
      rowsRead = fetched.length;
      rows = [...new Map(fetched.map((row) => [row.id, row])).values()];
    }
  }
  const capped = rows.length > limit;
  const result =
    recipe === "recent_links"
      ? { links: rows.slice(0, limit).map((row) => project(row, LINK_COLUMNS)), capped }
      : { type: typeKey, id, degree: Math.min(rows.length, limit), capped };
  return { result, usage: receipt(context, `recipe:${recipe}`, rowsRead, 0, capped) };
}

function namespaceKey(context: Scope, key: string): string {
  if (typeof key !== "string" || !KEY.test(key)) throw new Error("Invalid namespace key");
  if (!context.grant.namespace) throw new Error("Capability is not granted namespace storage");
  return `capability:${context.grant.capabilityId}:${key}`;
}
function encodeNamespace(value: unknown): string {
  let nodes = 0;
  let bytes = 0;
  const ancestors = new Set<object>();
  function validate(node: unknown, depth: number): void {
    if (++nodes > 2048 || depth > 32)
      throw new Error("Capability namespace JSON exceeds structural bounds");
    if (node === null || typeof node === "boolean") return;
    if (typeof node === "string") {
      bytes += Buffer.byteLength(node, "utf8");
      if (bytes > NAMESPACE_VALUE_BYTES)
        throw new Error("Capability namespace value exceeds byte limit");
      return;
    }
    if (typeof node === "number" && Number.isFinite(node)) return;
    if (typeof node !== "object" || ancestors.has(node))
      throw new Error("Capability namespace value must be JSON-serializable without loss");
    if (!Array.isArray(node) && ![Object.prototype, null].includes(Object.getPrototypeOf(node)))
      throw new Error("Capability namespace value must use plain JSON objects");
    ancestors.add(node);
    if (Array.isArray(node))
      for (let index = 0; index < node.length; index++) validate(node[index], depth + 1);
    else
      for (const key of Reflect.ownKeys(node)) {
        const descriptor = Object.getOwnPropertyDescriptor(node, key)!;
        if (
          typeof key !== "string" ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        )
          throw new Error("Capability namespace value must use plain JSON properties");
        validate(key, depth + 1);
        validate(descriptor.value, depth + 1);
      }
    ancestors.delete(node);
  }
  validate(value ?? null, 0);
  let serialized: string;
  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    throw new Error("Capability namespace value is not JSON-serializable");
  }
  if (typeof serialized !== "string")
    throw new Error("Capability namespace value is not JSON-serializable");
  if (Buffer.byteLength(serialized, "utf8") > NAMESPACE_VALUE_BYTES)
    throw new Error(`Capability namespace value exceeds ${NAMESPACE_VALUE_BYTES} bytes`);
  return serialized;
}
async function namespaceRow(context: Scope, key: string) {
  const { data, error } = await context.db
    .from("admin_settings")
    .select("value,is_secret")
    .eq("tenant_id", context.grant.tenantId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Capability namespace read failed: ${error.message}`);
  if (data && data.is_secret !== false)
    throw new Error("Secret namespace rows are not available to capabilities");
  return data;
}
export async function getCapabilityNamespace(
  database: SupabaseClient,
  grant: CapabilityGrant,
  key: string,
): Promise<{ value: unknown; usage: CapabilityUsageReceipt }> {
  const context = scope(database, grant);
  const row = await namespaceRow(context, namespaceKey(context, key));
  if (!row) return { value: null, usage: receipt(context, "namespace:get", 0) };
  if (typeof row.value !== "string" || Buffer.byteLength(row.value, "utf8") > NAMESPACE_VALUE_BYTES)
    throw new Error("Capability namespace value is corrupt or oversized");
  try {
    return { value: JSON.parse(row.value), usage: receipt(context, "namespace:get", 1) };
  } catch {
    throw new Error(`Capability namespace value for ${JSON.stringify(key)} is corrupt`);
  }
}
export async function setCapabilityNamespace(
  database: SupabaseClient,
  grant: CapabilityGrant,
  key: string,
  value: unknown,
): Promise<{ usage: CapabilityUsageReceipt }> {
  const context = scope(database, grant);
  const name = namespaceKey(context, key);
  const serialized = encodeNamespace(value);
  const before = await namespaceRow(context, name);
  // Conditional update cannot replace a secret row changed after the read.
  // An absent key uses INSERT, so a concurrent creator cannot be overwritten.
  const expectedValue = before?.value;
  const query = before
    ? context.db
        .from("admin_settings")
        .update({ value: serialized })
        .eq("tenant_id", context.grant.tenantId)
        .eq("key", name)
        .eq("is_secret", false)
        .eq("value", expectedValue)
    : context.db.from("admin_settings").insert({
        tenant_id: context.grant.tenantId,
        key: name,
        value: serialized,
        is_secret: false,
        description: "Capability namespace storage",
      });
  const { data, error } = await query.select("key").maybeSingle();
  if (error) throw new Error(`Capability namespace write failed: ${error.message}`);
  if (!data) throw new Error("Capability namespace changed concurrently; reread before retrying");
  return { usage: receipt(context, "namespace:set", before ? 1 : 0, 1) };
}
