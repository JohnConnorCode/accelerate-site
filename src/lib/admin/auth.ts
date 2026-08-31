import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { isConfiguredAdmin } from "./access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ACCELERATE_TENANT_SLUG,
  enterTenantRequestContext,
  type TenantActorContext,
  type TenantSummary,
} from "@/lib/tenancy/context";

export type AdminAuthorization = TenantActorContext;

function authorizationError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function requireAdmin(): Promise<
  AdminAuthorization | NextResponse
> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return authorizationError("Unauthorized", 401);
  }

  if (!process.env.ADMIN_EMAIL) {
    console.error("ADMIN_EMAIL environment variable is not configured");
    return authorizationError("Admin access not configured", 503);
  }

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestedSlug = (
    requestHeaders.get("x-tenant-slug") || cookieStore.get("accelerate-tenant-slug")?.value
  )?.trim().toLowerCase();
  const isPlatformAdmin = isConfiguredAdmin(user.email);

  // Compatibility URLs resolve only to the bootstrap workspace. Client admins must always carry a
  // canonical workspace slug, so an omitted header can never select a tenant.
  const tenantSlug = requestedSlug || (isPlatformAdmin ? ACCELERATE_TENANT_SLUG : null);
  if (!tenantSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) {
    return authorizationError("Explicit tenant context required", 403);
  }

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .select("id,slug,name,status,config")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (tenantError || !tenantRow || tenantRow.status !== "active") {
    return authorizationError("Tenant access forbidden", 403);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("role,status")
    .eq("tenant_id", tenantRow.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || membership?.status !== "active" || membership.role !== "admin") {
    return authorizationError("Tenant access forbidden", 403);
  }

  const database = await createServerSupabaseClient(tenantRow.id, tenantRow.slug);
  const authorization: AdminAuthorization = {
    kind: "actor",
    tenant: tenantRow as TenantSummary,
    user: { id: user.id, email: user.email },
    role: "admin",
    isPlatformAdmin,
    database,
  };
  enterTenantRequestContext(authorization);
  return authorization;
}

export async function requirePlatformAdmin(): Promise<AdminAuthorization | NextResponse> {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  if (!authorization.isPlatformAdmin) return authorizationError("Platform access forbidden", 403);
  return authorization;
}
