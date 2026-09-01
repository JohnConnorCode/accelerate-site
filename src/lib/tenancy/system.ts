import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient, tenantScopeForDatabase } from "@/lib/supabase/server";
import {
  ACCELERATE_TENANT_ID,
  ACCELERATE_TENANT_SLUG,
  getTenantRequestContext,
  type TenantSystemContext,
} from "@/lib/tenancy/context";

export class InactiveTenantExecutionError extends Error {
  constructor() {
    super("Tenant execution is unavailable because the workspace is not active");
    this.name = "InactiveTenantExecutionError";
  }
}

/** Rechecks lifecycle state immediately before an external provider effect.
 * A system context proves identity, but it may have been resolved before the
 * founder suspended the workspace. Never treat that earlier lookup as a lease. */
export async function assertActiveTenantExecution(database: SupabaseClient, source: string) {
  const scope = tenantScopeForDatabase(database);
  const requestContext = getTenantRequestContext();
  const tenantId =
    scope?.id ||
    (requestContext?.kind === "actor" ? requestContext.tenant.id : requestContext?.tenantId);
  if (!tenantId) throw new Error("Explicit tenant context is required before provider execution");
  // Recheck through the caller's already-authorized database. An actor client
  // can read only an actively joined tenant, while a tenant-bound system client
  // retains its explicit scope. Creating a fresh platform service client here
  // widened authority at the last possible moment and made the guard impossible
  // to exercise with the deterministic domain-service harness.
  void source;
  const { data, error } = await database
    .from("tenants")
    .select("status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error("Tenant lifecycle state could not be verified", { cause: error });
  if (!data || data.status !== "active") throw new InactiveTenantExecutionError();
}

export async function listTenantSystemContexts(input: {
  source: string;
  provider?: string;
  includeBootstrapFallback?: boolean;
}): Promise<TenantSystemContext[]> {
  const platform = createPlatformServiceRoleClient(`tenant-system-directory:${input.source}`);
  let tenantIds: string[] | null = null;
  if (input.provider) {
    const { data, error } = await platform
      .from("integration_connections")
      .select("tenant_id")
      .eq("provider", input.provider)
      .eq("status", "connected");
    if (error) throw new Error(error.message);
    tenantIds = [...new Set((data || []).map((connection) => connection.tenant_id))];
    if (input.includeBootstrapFallback && !tenantIds.includes(ACCELERATE_TENANT_ID))
      tenantIds.push(ACCELERATE_TENANT_ID);
  }
  let query = platform.from("tenants").select("id,slug").eq("status", "active").order("slug");
  if (tenantIds) query = query.in("id", tenantIds.length ? tenantIds : [ACCELERATE_TENANT_ID]);
  const { data: tenants, error } = await query;
  if (error) throw new Error(error.message);
  return (tenants || []).map((tenant) => ({
    kind: "system",
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    source: input.source,
  }));
}

export function bootstrapFallbackContext(source: string): TenantSystemContext {
  return {
    kind: "system",
    tenantId: ACCELERATE_TENANT_ID,
    tenantSlug: ACCELERATE_TENANT_SLUG,
    source,
  };
}

export async function resolveActiveTenantSystemContext(
  tenantSlug: string,
  source: string,
): Promise<TenantSystemContext | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) return null;
  const platform = createPlatformServiceRoleClient(`tenant-system-resolver:${source}`);
  const { data, error } = await platform
    .from("tenants")
    .select("id,slug,status")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "active") return null;
  return { kind: "system", tenantId: data.id, tenantSlug: data.slug, source };
}
