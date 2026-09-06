import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  accelerateSystemContext,
  getTenantRequestContext,
  type TenantSystemContext,
} from "@/lib/tenancy/context";
import { TENANT_SCOPED_TABLES } from "@/lib/revenue-os/schema-contract";

const tenantScopedTableSet = new Set<string>(TENANT_SCOPED_TABLES);
const tenantDatabaseScopes = new WeakMap<object, { id: string; slug?: string }>();

function attachTenant(values: unknown, tenantId: string): unknown {
  if (Array.isArray(values)) return values.map((value) => attachTenant(value, tenantId));
  if (!values || typeof values !== "object") return values;
  return { ...(values as Record<string, unknown>), tenant_id: tenantId };
}

export function bindTenantDatabase(
  client: SupabaseClient,
  tenantId: string,
  enforceFilters = false,
  tenantSlug?: string,
): SupabaseClient {
  const database = new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "from") return Reflect.get(target, property, receiver);
      return (table: string) => {
        const builder = target.from(table);
        if (!tenantScopedTableSet.has(table)) return builder;
        return new Proxy(builder, {
          get(builderTarget, builderProperty, builderReceiver) {
            const value = Reflect.get(builderTarget, builderProperty, builderReceiver);
            if (typeof value !== "function") {
              return value;
            }
            if (builderProperty === "insert" || builderProperty === "upsert") {
              return (rows: unknown, options?: unknown) => {
                const optionRecord =
                  options && typeof options === "object"
                    ? (options as Record<string, unknown>)
                    : null;
                const onConflict = optionRecord?.onConflict;
                const tenantOptions =
                  builderProperty === "upsert" &&
                  typeof onConflict === "string" &&
                  !onConflict.split(",").includes("tenant_id")
                    ? { ...optionRecord, onConflict: `tenant_id,${onConflict}` }
                    : options;
                return value.call(builderTarget, attachTenant(rows, tenantId), tenantOptions);
              };
            }
            if (
              enforceFilters &&
              ["select", "update", "delete"].includes(String(builderProperty))
            ) {
              return (...args: unknown[]) => {
                const result = value.apply(builderTarget, args) as {
                  eq: (column: string, value: string) => unknown;
                };
                return result.eq("tenant_id", tenantId);
              };
            }
            return value.bind(builderTarget);
          },
        });
      };
    },
  });
  tenantDatabaseScopes.set(database, { id: tenantId, slug: tenantSlug });
  return database;
}

/** Test doubles need the same non-ambient scope marker as runtime clients. This
 * seam is unavailable in production so application code cannot manufacture a
 * tenant context instead of going through authentication/system resolution. */
export function bindTenantDatabaseForTest(
  client: SupabaseClient,
  tenantId: string,
): SupabaseClient {
  if (process.env.NODE_ENV === "production")
    throw new Error("Test tenant binding is unavailable in production");
  return bindTenantDatabase(client, tenantId);
}

export function tenantIdForDatabase(database: SupabaseClient) {
  return tenantDatabaseScopes.get(database)?.id;
}

export function tenantScopeForDatabase(database: SupabaseClient) {
  return tenantDatabaseScopes.get(database);
}

export async function createServerSupabaseClient(tenantId?: string, tenantSlug?: string) {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: tenantId ? { headers: { "x-tenant-id": tenantId } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    },
  );
  return tenantId ? bindTenantDatabase(client, tenantId, false, tenantSlug) : client;
}

export function createBootstrapServiceRoleClient(source: string) {
  return createServiceRoleClient(accelerateSystemContext(source));
}

export function createPlatformServiceRoleClient(source: string) {
  void source;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function createServiceRoleClient(systemContext?: TenantSystemContext) {
  const requestContext = getTenantRequestContext();
  if (requestContext?.kind === "actor") return requestContext.database;
  if (!systemContext) {
    throw new Error(
      "Service database access requires an explicit TenantSystemContext outside an authorized tenant request.",
    );
  }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers: { "x-tenant-id": systemContext.tenantId } } },
  );
  return bindTenantDatabase(client, systemContext.tenantId, true, systemContext.tenantSlug);
}

const COLLECTION_HOST_RPCS = [
  "sync_collection_observations",
  "update_collection_case",
  "reserve_collection_reminder",
  "reconcile_collection_reminder",
] as const;
/** Narrow server bridge for verified Collections writes. Actor reads remain on
 * their RLS client. Only these host-owned RPCs may cross the boundary, after a
 * current membership/lifecycle check; no privileged database handle escapes. */
export async function callCollectionHostRpc(
  database: SupabaseClient,
  operation: (typeof COLLECTION_HOST_RPCS)[number],
  args: Record<string, unknown>,
) {
  if (!(COLLECTION_HOST_RPCS as readonly string[]).includes(operation))
    throw new Error("Collection host operation is not allowed");
  return callVerifiedHostRpc(database, operation, args);
}

const MODEL_BUDGET_RPCS = ["reserve_model_call", "complete_model_call"] as const;
export async function callModelBudgetRpc(
  database: SupabaseClient,
  operation: (typeof MODEL_BUDGET_RPCS)[number],
  args: Record<string, unknown>,
) {
  if (!(MODEL_BUDGET_RPCS as readonly string[]).includes(operation))
    throw new Error("Model budget operation is not allowed");
  return callVerifiedHostRpc(database, operation, args);
}

/** Exact approved Radar store command; never exposes the host database to callers. */
export async function callRadarStoreRpc(database: SupabaseClient, args: Record<string, unknown>) {
  return callVerifiedHostRpc(database, "execute_radar_store_command", args);
}

export async function callRadarAssessmentRpc(
  database: SupabaseClient,
  args: Record<string, unknown>,
) {
  return callVerifiedHostRpc(database, "review_radar_assessment", args);
}

/** Exact approved source-backed relationship command. */
export async function callRadarRelationshipRpc(
  database: SupabaseClient,
  args: Record<string, unknown>,
) {
  return callVerifiedHostRpc(database, "review_radar_relationship", args);
}

async function callVerifiedHostRpc(
  database: SupabaseClient,
  operation: string,
  args: Record<string, unknown>,
) {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new Error("Collection host requires a tenant-bound database");
  const context = getTenantRequestContext();
  // Background hosts already carry their explicit service context. Never
  // elevate an arbitrary database simply because no actor context exists.
  if (context?.kind !== "actor") return database.rpc(operation, args);
  if (context.database !== database || context.tenant.id !== tenantId || context.role !== "admin")
    throw new Error("Collection host actor/database context mismatch");
  const [tenant, member] = await Promise.all([
    database.from("tenants").select("status").eq("id", tenantId).maybeSingle(),
    database
      .from("tenant_memberships")
      .select("role,status")
      .eq("tenant_id", tenantId)
      .eq("user_id", context.user.id)
      .maybeSingle(),
  ]);
  if (
    tenant.error ||
    tenant.data?.status !== "active" ||
    member.error ||
    member.data?.status !== "active" ||
    member.data?.role !== "admin"
  )
    throw new Error("Collection host requires current active admin membership");
  const host = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { headers: { "x-tenant-id": tenantId } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return host.rpc(operation, args);
}
