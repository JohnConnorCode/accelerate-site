import "server-only";
import type { User } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";

export type TenantLifecycleStatus = "active" | "suspended" | "archived";
export interface PlatformTenantActor { userId: string; email: string }
export interface TenantLifecycleRow { id: string; slug: string; name: string; status: string; config_version?: number; created_at?: string; updated_at?: string }
export interface TenantMembershipRow { id: string; tenant_id: string; user_id: string; invited_email: string; role: "admin"; status: "invited" | "active" | "revoked"; invited_at?: string; activated_at?: string | null; revoked_at?: string | null }

export class TenantLifecycleError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500 | 502,
    public readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options);
    this.name = "TenantLifecycleError";
  }
}

function platformDatabase(source: string) {
  return createPlatformServiceRoleClient(`tenant-lifecycle:${source}`);
}

function rpcData<T>(data: unknown, error: { message: string } | null): T {
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new TenantLifecycleError(409, "That workspace slug or membership already exists", { cause: error });
    }
    if (/not found/i.test(error.message)) {
      throw new TenantLifecycleError(404, "The requested tenant resource was not found", { cause: error });
    }
    if (/^(Invitations are disabled while tenant is (?:suspended|archived)|The bootstrap tenant cannot be suspended or archived|Archived tenants cannot be reactivated|The platform owner membership cannot be revoked)$/i.test(error.message)) {
      throw new TenantLifecycleError(409, error.message, { cause: error });
    }
    if (/required|invalid/i.test(error.message)) {
      throw new TenantLifecycleError(400, "The tenant lifecycle request is invalid", { cause: error });
    }
    throw new TenantLifecycleError(500, "The tenant lifecycle operation could not be completed", { cause: error });
  }
  if (!data || typeof data !== "object") {
    throw new TenantLifecycleError(500, "The tenant lifecycle operation returned no receipt");
  }
  return data as T;
}

async function findUserByEmail(email: string): Promise<User | null> {
  const database = platformDatabase("find-user");
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await database.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new TenantLifecycleError(502, "The administrator directory is temporarily unavailable", { cause: error });
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new TenantLifecycleError(502, "The administrator directory is too large to search safely");
}

async function resolveInvitedUser(email: string, redirectTo: string) {
  const database = platformDatabase("resolve-invited-user");
  const normalized = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalized);
  if (existing) {
    return {
      userId: existing.id,
      status: existing.email_confirmed_at ? "active" as const : "invited" as const,
    };
  }
  const { data, error } = await database.auth.admin.inviteUserByEmail(normalized, { redirectTo });
  if (error || !data.user) {
    throw new TenantLifecycleError(502, "The administrator invitation could not be sent", { cause: error || undefined });
  }
  return { userId: data.user.id, status: "invited" as const };
}

export async function inviteTenantAdmin(input: {
  tenantId: string;
  email: string;
  actor: PlatformTenantActor;
  origin: string;
}) {
  const normalized = input.email.trim().toLowerCase();
  const lookupDatabase = platformDatabase("invite-tenant-lookup");
  const { data: tenant, error: tenantError } = await lookupDatabase.from("tenants")
    .select("id,slug,status")
    .eq("id", input.tenantId)
    .single();
  if (tenantError || !tenant) {
    throw new TenantLifecycleError(404, "The requested workspace was not found", { cause: tenantError || undefined });
  }
  if (!["provisioning", "active"].includes(tenant.status)) {
    throw new TenantLifecycleError(409, `Invitations are disabled while tenant is ${tenant.status}`);
  }
  const invitation = await resolveInvitedUser(
    normalized,
    `${input.origin}/auth/callback?next=${encodeURIComponent(`/t/${tenant.slug}/admin/today`)}`,
  );
  const database = platformDatabase("invite-admin");
  const { data, error } = await database.rpc("platform_upsert_tenant_membership", {
    p_tenant_id: input.tenantId,
    p_user_id: invitation.userId,
    p_invited_email: normalized,
    p_membership_status: invitation.status,
    p_actor_user_id: input.actor.userId,
    p_actor_email: input.actor.email,
  });
  return rpcData<TenantMembershipRow>(data, error);
}

export async function createTenantWorkspace(input: {
  slug: string;
  name: string;
  adminEmail?: string;
  actor: PlatformTenantActor;
  origin: string;
}) {
  const database = platformDatabase("create-workspace");
  const { data, error } = await database.rpc("platform_create_tenant", {
    p_slug: input.slug,
    p_name: input.name,
    p_actor_user_id: input.actor.userId,
    p_actor_email: input.actor.email,
  });
  const tenant = rpcData<TenantLifecycleRow>(data, error);
  if (!input.adminEmail || input.adminEmail.trim().toLowerCase() === input.actor.email.toLowerCase()) {
    return { tenant, membership: null, warning: null };
  }
  try {
    const membership = await inviteTenantAdmin({ tenantId: tenant.id, email: input.adminEmail, actor: input.actor, origin: input.origin });
    return { tenant, membership, warning: null };
  } catch {
    return {
      tenant,
      membership: null,
      warning: "Workspace created safely, but the first administrator invitation could not be completed. Retry the invitation from the workspace card.",
    };
  }
}

export async function setTenantLifecycleStatus(input: { tenantId: string; status: TenantLifecycleStatus; actor: PlatformTenantActor }) {
  const database = platformDatabase("set-status");
  const { data, error } = await database.rpc("platform_set_tenant_status", {
    p_tenant_id: input.tenantId,
    p_status: input.status,
    p_actor_user_id: input.actor.userId,
    p_actor_email: input.actor.email,
  });
  return rpcData<TenantLifecycleRow>(data, error);
}

export async function revokeTenantAdmin(input: { membershipId: string; actor: PlatformTenantActor }) {
  const database = platformDatabase("revoke-admin");
  const { data, error } = await database.rpc("platform_revoke_tenant_membership", {
    p_membership_id: input.membershipId,
    p_actor_user_id: input.actor.userId,
    p_actor_email: input.actor.email,
  });
  return rpcData<TenantMembershipRow>(data, error);
}
