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

function bindTenantDatabase(
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
