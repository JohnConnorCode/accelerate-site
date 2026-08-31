import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCELERATE_TENANT_ID, ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";

export { ACCELERATE_TENANT_ID, ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  status: "provisioning" | "active" | "suspended" | "archived";
  config: Record<string, unknown>;
}

export interface TenantActorContext {
  kind: "actor";
  tenant: TenantSummary;
  user: { id: string; email?: string };
  role: "admin";
  isPlatformAdmin: boolean;
  database: SupabaseClient;
}

export interface TenantSystemContext {
  kind: "system";
  tenantId: string;
  tenantSlug: string;
  source: string;
}

export type TenantRequestContext = TenantActorContext | TenantSystemContext;

const tenantRequestStorage = new AsyncLocalStorage<TenantRequestContext>();

export function enterTenantRequestContext(context: TenantRequestContext) {
  tenantRequestStorage.enterWith(context);
}

export function runWithTenantRequestContext<T>(context: TenantRequestContext, work: () => T): T {
  return tenantRequestStorage.run(context, work);
}

export function getTenantRequestContext() {
  return tenantRequestStorage.getStore();
}

export function accelerateSystemContext(source: string): TenantSystemContext {
  return {
    kind: "system",
    tenantId: ACCELERATE_TENANT_ID,
    tenantSlug: ACCELERATE_TENANT_SLUG,
    source,
  };
}
