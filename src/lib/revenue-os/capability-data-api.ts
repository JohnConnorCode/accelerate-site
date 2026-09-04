import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabase } from "@/lib/supabase/server";
import { getEntityType } from "./entity-registry";

/**
 * Capability-scoped data API (Plugin Platform phase 1): the only data
 * interface capability code may ever touch. Three shapes and nothing else:
 *
 * 1. queryCapabilityEntities — filtered reads of registered entity types.
 * 2. runCapabilityRecipe — server-computed reads from a code-enumerated list.
 * 3. get/setCapabilityNamespace — the capability's own key/value storage.
 *
 * There is deliberately no write function for core entities here; core
 * writes are actions through the executor. There is no path from a
 * capability to a raw database handle: this module receives its client from
 * the host, never manufactures or returns one, and
 * scripts/verify-capability-isolation.mjs asserts that boundary in CI.
 *
 * Every call is tenant-scoped twice (explicit filter plus the caller's bound
 * client) and returns a usage receipt for rate limiting and cost accounting.
 */

export interface CapabilityGrant {
  /** Stable capability id, e.g. "webinar-pack". */
  capabilityId: string;
  tenantId: string;
  /** Registered entity type keys this capability may read. */
  entities: string[];
  /** Recipe names this capability may run. */
  recipes: string[];
  /** Whether it may use its own namespace storage. */
  namespace: boolean;
}

export interface CapabilityUsageReceipt {
  capabilityId: string;
  tenantId: string;
  operation: string;
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
const NAMESPACE_KEY_PATTERN = /^[a-z0-9_-]{1,64}$/;
const NAMESPACE_VALUE_BYTES = 8192;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 120;

type Row = Record<string, unknown>;

/** In-process call budget per capability+tenant. Single-instance accounting;
 * a multi-instance deployment needs the persisted usage table (follow-up),
 * but the fail-closed refusal shape is already the contract. */
const callBudget = new Map<string, number[]>();

function checkRateLimit(capabilityId: string, tenantId: string): number {
  const now = Date.now();
  const key = `${tenantId}:${capabilityId}`;
  const window = (callBudget.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (window.length >= RATE_LIMIT_MAX_CALLS)
    throw new Error(
      `Capability rate budget exhausted for ${capabilityId}: retry after ${Math.ceil((window[0]! + RATE_LIMIT_WINDOW_MS - now) / 1000)}s`,
    );
  window.push(now);
  callBudget.set(key, window);
  return RATE_LIMIT_MAX_CALLS - window.length;
}

function requireGrant(value: string, what: string): string {
  const id = value?.trim();
  if (!id) throw new Error(`${what} is required`);
  return id;
}

/** Columns a capability may read: the id column plus whatever the type
 * declaration exposes via metadata.readable_columns. Never arbitrary. */
function readableColumns(
  metadata: Record<string, unknown> | undefined,
  idColumn: string,
): string[] {
  const declared = (metadata as { readable_columns?: unknown } | undefined)?.readable_columns;
  const extra = Array.isArray(declared)
    ? declared.filter((c): c is string => typeof c === "string")
    : [];
  return [...new Set([idColumn, "tenant_id", ...extra])];
}

export async function queryCapabilityEntities(
  supabase: SupabaseClient,
  grant: CapabilityGrant,
  input: { type: string; filters?: CapabilityQueryFilter[]; limit?: number },
): Promise<{ rows: Row[]; usage: CapabilityUsageReceipt }> {
  const capabilityId = requireGrant(grant.capabilityId, "A capability id");
  const tenantId = requireGrant(grant.tenantId, "A tenant id");
  const budgetRemaining = checkRateLimit(capabilityId, tenantId);
  const typeKey = input.type?.trim().toLowerCase();
  if (!typeKey || !grant.entities.includes(typeKey))
    throw new Error(
      `Capability ${capabilityId} is not granted entity type ${JSON.stringify(input.type)}`,
    );
  // Double scoping: explicit tenant filters below plus the proven proxy, so
  // a missing eq() anywhere still cannot leak across workspaces.
  const db = bindTenantDatabase(supabase, tenantId, true);
  const type = await getEntityType(db, tenantId, typeKey);
  if (!type) throw new Error(`Unknown entity type ${JSON.stringify(typeKey)}`);
  if (type.isDisabled) throw new Error(`Entity type ${JSON.stringify(typeKey)} is disabled`);

  const allowed = new Set(readableColumns(type.metadata, type.idColumn));

  let query = db
    .from(type.backingTable)
    .select([...allowed].join(","))
    .eq("tenant_id", tenantId);
  for (const filter of input.filters ?? []) {
    if (!allowed.has(filter.column))
      throw new Error(`Column ${JSON.stringify(filter.column)} is not readable on ${typeKey}`);
    if (filter.op === "eq") query = query.eq(filter.column, filter.value);
    else if (filter.op === "neq") query = query.neq(filter.column, filter.value);
    else if (filter.op === "ilike" && typeof filter.value === "string")
      query = query.ilike(filter.column, `%${filter.value}%`);
    else if (filter.op === "in" && Array.isArray(filter.value))
      query = query.in(filter.column, filter.value);
    else if ((filter.op === "gt" || filter.op === "lt") && filter.value != null)
      query =
        filter.op === "gt"
          ? query.gt(filter.column, String(filter.value))
          : query.lt(filter.column, String(filter.value));
    else
      throw new Error(
        `Unsupported capability filter ${JSON.stringify(filter.op)} on ${JSON.stringify(filter.column)}`,
      );
  }
  const limit = Math.max(1, Math.min(MAX_ROWS, Math.floor(input.limit ?? MAX_ROWS)));
  const { data, error } = await query.limit(limit + 1);
  if (error) throw new Error(`Capability entity query failed: ${error.message}`);
  const rows = ((data ?? []) as unknown as Row[]).slice(0, limit);
  return {
    rows,
    usage: {
      capabilityId,
      tenantId,
      operation: `query:${typeKey}`,
      rowsRead: rows.length,
      rowsWritten: 0,
      truncated: ((data ?? []) as unknown as Row[]).length > limit,
      budgetRemaining,
    },
  };
}

type RecipeName = "entity_count" | "link_degree" | "recent_links";

const RECIPES: readonly RecipeName[] = ["entity_count", "link_degree", "recent_links"];

/**
 * Server-computed reads from a code-enumerated list. Recipes are the only
 * aggregation a capability gets; there is no ad-hoc query shape, no raw SQL,
 * and unknown names refuse. Counts are exact up to a disclosed cap.
 */
export async function runCapabilityRecipe(
  supabase: SupabaseClient,
  grant: CapabilityGrant,
  input: { recipe: string; params?: Record<string, unknown> },
): Promise<{ result: Row; usage: CapabilityUsageReceipt }> {
  const capabilityId = requireGrant(grant.capabilityId, "A capability id");
  const tenantId = requireGrant(grant.tenantId, "A tenant id");
  const budgetRemaining = checkRateLimit(capabilityId, tenantId);
  const recipe = input.recipe?.trim();
  if (!(RECIPES as readonly string[]).includes(recipe) || !grant.recipes.includes(recipe))
    throw new Error(
      `Capability ${capabilityId} is not granted recipe ${JSON.stringify(input.recipe)}`,
    );
  const params = input.params ?? {};
  const db = bindTenantDatabase(supabase, tenantId, true);
  let result: Row;
  if (recipe === "entity_count") {
    const typeKey = String(params.type ?? "");
    const type = await getEntityType(supabase, tenantId, typeKey);
    if (!type) throw new Error(`Unknown entity type ${JSON.stringify(params.type)}`);
    const { data, error } = await db
      .from(type.backingTable)
      .select(type.idColumn)
      .eq("tenant_id", tenantId)
      .limit(MAX_ROWS + 1);
    if (error) throw new Error(`Recipe entity_count failed: ${error.message}`);
    const ids = (data ?? []) as unknown as Row[];
    result = {
      type: typeKey,
      count: Math.min(ids.length, MAX_ROWS),
      capped: ids.length > MAX_ROWS,
    };
  } else if (recipe === "link_degree") {
    const id = params.id != null ? String(params.id) : "";
    if (!id) throw new Error("Recipe link_degree requires params.id");
    const columns = "source_type,source_id,target_type,target_id";
    const [outgoing, incoming] = await Promise.all([
      db
        .from("entity_links")
        .select(columns)
        .eq("tenant_id", tenantId)
        .eq("source_id", id)
        .limit(MAX_ROWS + 1),
      db
        .from("entity_links")
        .select(columns)
        .eq("tenant_id", tenantId)
        .eq("target_id", id)
        .limit(MAX_ROWS + 1),
    ]);
    if (outgoing.error) throw new Error(`Recipe link_degree failed: ${outgoing.error.message}`);
    if (incoming.error) throw new Error(`Recipe link_degree failed: ${incoming.error.message}`);
    const edges = [
      ...((outgoing.data ?? []) as unknown as Row[]),
      ...((incoming.data ?? []) as unknown as Row[]),
    ].slice(0, MAX_ROWS);
    result = {
      id,
      degree: edges.length,
      capped: (outgoing.data ?? []).length + (incoming.data ?? []).length > MAX_ROWS,
    };
  } else {
    const limit = Math.max(1, Math.min(MAX_ROWS, Math.floor(Number(params.limit) || 20)));
    const { data, error } = await db
      .from("entity_links")
      .select("source_type,source_id,target_type,target_id,link_type,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Recipe recent_links failed: ${error.message}`);
    result = { links: (data ?? []) as unknown as Row[] };
  }
  return {
    result,
    usage: {
      capabilityId,
      tenantId,
      operation: `recipe:${recipe}`,
      rowsRead: Array.isArray(result.links) ? result.links.length : 1,
      rowsWritten: 0,
      truncated: result.capped === true,
      budgetRemaining,
    },
  };
}

function namespaceKey(capabilityId: string, name: string): string {
  if (!NAMESPACE_KEY_PATTERN.test(name))
    throw new Error(
      `Invalid namespace key ${JSON.stringify(name)}: lowercase letters, digits, dash, underscore, max 64`,
    );
  return `capability:${capabilityId}:${name}`;
}

export async function getCapabilityNamespace(
  supabase: SupabaseClient,
  grant: CapabilityGrant,
  key: string,
): Promise<{ value: unknown; usage: CapabilityUsageReceipt }> {
  const capabilityId = requireGrant(grant.capabilityId, "A capability id");
  const tenantId = requireGrant(grant.tenantId, "A tenant id");
  if (!grant.namespace)
    throw new Error(`Capability ${capabilityId} is not granted namespace storage`);
  const budgetRemaining = checkRateLimit(capabilityId, tenantId);
  const db = bindTenantDatabase(supabase, tenantId, true);
  const { data, error } = await db
    .from("admin_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", namespaceKey(capabilityId, key))
    .maybeSingle();
  if (error) throw new Error(`Capability namespace read failed: ${error.message}`);
  const raw = (data as { value?: unknown } | null)?.value ?? null;
  if (raw === null) {
    return {
      value: null,
      usage: {
        capabilityId,
        tenantId,
        operation: "namespace:get",
        rowsRead: 0,
        rowsWritten: 0,
        truncated: false,
        budgetRemaining,
      },
    };
  }
  try {
    return {
      value: JSON.parse(String(raw)),
      usage: {
        capabilityId,
        tenantId,
        operation: "namespace:get",
        rowsRead: 1,
        rowsWritten: 0,
        truncated: false,
        budgetRemaining,
      },
    };
  } catch {
    throw new Error(
      `Capability namespace value for ${JSON.stringify(key)} is corrupt and will not be guessed`,
    );
  }
}

export async function setCapabilityNamespace(
  supabase: SupabaseClient,
  grant: CapabilityGrant,
  key: string,
  value: unknown,
): Promise<{ usage: CapabilityUsageReceipt }> {
  const capabilityId = requireGrant(grant.capabilityId, "A capability id");
  const tenantId = requireGrant(grant.tenantId, "A tenant id");
  if (!grant.namespace)
    throw new Error(`Capability ${capabilityId} is not granted namespace storage`);
  const budgetRemaining = checkRateLimit(capabilityId, tenantId);
  let serialized: string;
  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    throw new Error(
      `Capability namespace value for ${JSON.stringify(key)} is not JSON-serializable`,
    );
  }
  if (serialized.length > NAMESPACE_VALUE_BYTES)
    throw new Error(`Capability namespace value exceeds ${NAMESPACE_VALUE_BYTES} bytes`);
  const db = bindTenantDatabase(supabase, tenantId, true);
  const { error } = await db.from("admin_settings").upsert(
    {
      tenant_id: tenantId,
      key: namespaceKey(capabilityId, key),
      value: serialized,
      is_secret: false,
      description: "Capability namespace storage",
    },
    { onConflict: "tenant_id,key" },
  );
  if (error) throw new Error(`Capability namespace write failed: ${error.message}`);
  return {
    usage: {
      capabilityId,
      tenantId,
      operation: "namespace:set",
      rowsRead: 0,
      rowsWritten: 1,
      truncated: false,
      budgetRemaining,
    },
  };
}
