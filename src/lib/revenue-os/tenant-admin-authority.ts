import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { tenantIdForDatabase } from "@/lib/supabase/server";

/** Fresh human authority for host-owned workspace configuration writes. */
export async function assertCurrentTenantAdmin(db: SupabaseClient, actorEmail: string) {
  const context = getTenantRequestContext();
  const tenantId = tenantIdForDatabase(db);
  if (
    !tenantId ||
    context?.kind !== "actor" ||
    context.database !== db ||
    context.tenant.id !== tenantId ||
    context.role !== "admin" ||
    !context.user.email ||
    context.user.email.toLowerCase() !== actorEmail.toLowerCase()
  )
    throw new Error("A current authenticated workspace administrator is required");
  const [tenant, member] = await Promise.all([
    db.from("tenants").select("status").eq("id", tenantId).maybeSingle(),
    db
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
    throw new Error("Workspace administrator access was revoked or the workspace is inactive");
  return tenantId;
}
