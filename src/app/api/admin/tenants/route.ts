import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requirePlatformAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { createTenantWorkspace, inviteTenantAdmin, revokeTenantAdmin, setTenantLifecycleStatus, TenantLifecycleError, type PlatformTenantActor } from "@/lib/tenancy/lifecycle";

const createTenantSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  adminEmail: z.string().trim().toLowerCase().email().optional(),
});

const tenantActionSchema = z.discriminatedUnion("action", [
  createTenantSchema,
  z.object({ action: z.enum(["activate", "suspend", "archive"]), tenantId: z.string().uuid() }),
  z.object({ action: z.literal("invite"), tenantId: z.string().uuid(), adminEmail: z.string().trim().toLowerCase().email() }),
  z.object({ action: z.literal("revoke"), membershipId: z.string().uuid() }),
]);

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const platformDatabase = authorization.isPlatformAdmin ? createPlatformServiceRoleClient("tenant-directory") : null;
  const database = platformDatabase || authorization.database;
  const tenantQuery = database.from("tenants").select("id,slug,name,status,config_version,created_at,updated_at").order("name", { ascending: true });
  const membershipQuery = database.from("tenant_memberships").select("id,tenant_id,user_id,invited_email,role,status,invited_at,activated_at,revoked_at").order("invited_at", { ascending: true });
  if (!authorization.isPlatformAdmin) membershipQuery.eq("user_id", authorization.user.id);
  const [{ data: tenants, error: tenantError }, { data: memberships, error: membershipError }] = await Promise.all([tenantQuery, membershipQuery]);
  if (tenantError || membershipError) return NextResponse.json({ error: tenantError?.message || membershipError?.message || "Could not load workspaces" }, { status: 500 });
  return NextResponse.json({ currentTenantId: authorization.tenant.id, isPlatformAdmin: authorization.isPlatformAdmin, platformOwnerUserId: authorization.isPlatformAdmin ? authorization.user.id : null, tenants: tenants || [], memberships: memberships || [] });
}

export async function POST(request: NextRequest) {
  const authorization = await requirePlatformAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const parsed = tenantActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tenant action" }, { status: 400 });
  const input = parsed.data;
  const actor: PlatformTenantActor = { userId: authorization.user.id, email: authorization.user.email?.trim().toLowerCase() || "" };
  if (!actor.email) return NextResponse.json({ error: "Platform actor email is required" }, { status: 400 });

  try {
    if (input.action === "create") {
      const result = await createTenantWorkspace({ name: input.name, slug: input.slug, adminEmail: input.adminEmail, actor, origin: new URL(request.url).origin });
      return NextResponse.json(result, { status: 201 });
    }
    if (input.action === "invite") {
      const membership = await inviteTenantAdmin({ tenantId: input.tenantId, email: input.adminEmail, actor, origin: new URL(request.url).origin });
      return NextResponse.json({ membership });
    }
    if (input.action === "revoke") {
      const membership = await revokeTenantAdmin({ membershipId: input.membershipId, actor });
      return NextResponse.json({ membership });
    }
    const status = input.action === "activate" ? "active" : input.action === "suspend" ? "suspended" : "archived";
    const tenant = await setTenantLifecycleStatus({ tenantId: input.tenantId, status, actor });
    return NextResponse.json({ tenant });
  } catch (error) {
    if (error instanceof TenantLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    console.error("Unexpected tenant lifecycle failure", error);
    return NextResponse.json({ error: "Tenant action failed safely. Retry, or check server logs if the problem continues." }, { status: 500 });
  }
}
