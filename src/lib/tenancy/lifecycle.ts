import "server-only";
import type { User } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL, FROM_EMAIL, getResend } from "@/lib/email/resend";
import { tenantAdminInvitationEmail } from "@/lib/email/templates";

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

async function resolveInvitedUser(email: string, acceptBaseUrl: string, tenantId: string, tenantSlug: string) {
  const database = platformDatabase("resolve-invited-user");
  const normalized = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalized);
  if (existing?.email_confirmed_at) {
    return {
      userId: existing.id,
      status: "active" as const,
      acceptUrl: null,
    };
  }
  const type = existing ? "magiclink" as const : "invite" as const;
  const { data, error } = await database.auth.admin.generateLink({ type, email: normalized });
  const tokenHash = data?.properties?.hashed_token;
  const userId = existing?.id || data?.user?.id;
  if (error || !userId || !tokenHash) {
    throw new TenantLifecycleError(502, "The administrator invitation link could not be prepared", { cause: error || undefined });
  }
  const acceptUrl = new URL("/auth/callback", acceptBaseUrl);
  acceptUrl.searchParams.set("token_hash", tokenHash);
  acceptUrl.searchParams.set("type", type);
  acceptUrl.searchParams.set("tenant_id", tenantId);
  acceptUrl.searchParams.set("workspace", tenantSlug);
  return { userId, status: "invited" as const, acceptUrl: acceptUrl.toString() };
}

export interface TenantInvitationResult {
  membership: TenantMembershipRow;
  deliveryStatus: "sent" | "not_required" | "failed" | "unknown";
  providerReceiptId: string | null;
  operatorMessage: string;
  warning: string | null;
}

async function recordInvitationDelivery(input: {
  tenantId: string;
  membershipId: string;
  actor: PlatformTenantActor;
  requestId: string;
  status: "sent" | "failed";
  providerReceiptId?: string;
}) {
  const database = platformDatabase("record-invitation-delivery");
  const { error } = await database.from("platform_audit_log").insert({
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email,
    action: `tenant.invitation.${input.status}`,
    tenant_id: input.tenantId,
    target_type: "tenant_membership",
    target_id: input.membershipId,
    metadata: {
      request_id: input.requestId,
      provider: "resend",
      provider_receipt_id: input.providerReceiptId || null,
    },
  });
  if (error?.code === "23505") return;
  if (error) throw new TenantLifecycleError(500, "The invitation delivery receipt could not be recorded", { cause: error });
}

export async function inviteTenantAdmin(input: {
  tenantId: string;
  email: string;
  actor: PlatformTenantActor;
  origin: string;
  requestId: string;
}): Promise<TenantInvitationResult> {
  const normalized = input.email.trim().toLowerCase();
  const lookupDatabase = platformDatabase("invite-tenant-lookup");
  const { data: tenant, error: tenantError } = await lookupDatabase.from("tenants")
    .select("id,slug,name,status")
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
    input.origin,
    input.tenantId,
    tenant.slug,
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
  const membership = rpcData<TenantMembershipRow>(data, error);
  if (!invitation.acceptUrl) {
    return {
      membership,
      deliveryStatus: "not_required",
      providerReceiptId: null,
      operatorMessage: `Access granted to the existing account for ${normalized}`,
      warning: null,
    };
  }

  let delivery: Awaited<ReturnType<ReturnType<typeof getResend>["emails"]["send"]>>;
  try {
    delivery = await getResend().emails.send({
      from: FROM_EMAIL,
      to: normalized,
      replyTo: ADMIN_EMAIL || undefined,
      subject: `You are invited to ${tenant.name}`,
      text: `You have been invited to administer ${tenant.name}. Accept the invitation: ${invitation.acceptUrl}`,
      html: tenantAdminInvitationEmail({ workspaceName: tenant.name, acceptUrl: invitation.acceptUrl }),
      tags: [
        { name: "platform_action", value: "tenant-invitation" },
        { name: "tenant_id", value: input.tenantId },
      ],
    }, { idempotencyKey: `tenant-invite:${input.tenantId}:${invitation.userId}:${input.requestId}` });
    if (delivery.error || !delivery.data?.id) {
      await recordInvitationDelivery({ tenantId: input.tenantId, membershipId: membership.id, actor: input.actor, requestId: input.requestId, status: "failed" });
      return {
        membership,
        deliveryStatus: "failed",
        providerReceiptId: null,
        operatorMessage: `Invitation pending for ${normalized}`,
        warning: "Access is recorded, but the invitation email was not delivered. Use Resend invitation to try again safely.",
      };
    }
  } catch {
    return {
      membership,
      deliveryStatus: "unknown",
      providerReceiptId: null,
      operatorMessage: `Invitation pending for ${normalized}`,
      warning: "Access is recorded, but the email provider outcome is unknown. Check Resend before sending another invitation.",
    };
  }

  const providerReceiptId = delivery.data!.id;
  try {
    await recordInvitationDelivery({ tenantId: input.tenantId, membershipId: membership.id, actor: input.actor, requestId: input.requestId, status: "sent", providerReceiptId });
  } catch {
    return {
      membership,
      deliveryStatus: "sent",
      providerReceiptId,
      operatorMessage: `Invitation accepted by the email provider for ${normalized}`,
      warning: "The provider accepted the invitation, but its local audit receipt could not be recorded. Do not resend until the receipt is reconciled.",
    };
  }
  return {
    membership,
    deliveryStatus: "sent",
    providerReceiptId,
    operatorMessage: `Invitation sent to ${normalized}`,
    warning: null,
  };
}

export async function activateInvitedTenantMembership(input: { tenantId: string; tenantSlug: string; userId: string; email: string }) {
  const normalized = input.email.trim().toLowerCase();
  const database = platformDatabase("activate-invited-membership");
  const { data: tenant, error: tenantError } = await database.from("tenants")
    .select("id,slug,status")
    .eq("id", input.tenantId)
    .eq("slug", input.tenantSlug)
    .maybeSingle();
  if (tenantError) throw new TenantLifecycleError(500, "The invitation workspace could not be verified", { cause: tenantError });
  if (!tenant || !["provisioning", "active"].includes(tenant.status)) {
    throw new TenantLifecycleError(404, "The invitation workspace is no longer available");
  }
  const { data: membership, error: membershipError } = await database.from("tenant_memberships")
    .select("id,tenant_id,user_id,invited_email,status")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("invited_email", normalized)
    .eq("status", "invited")
    .maybeSingle();
  if (membershipError) throw new TenantLifecycleError(500, "The invitation could not be activated", { cause: membershipError });
  if (!membership) {
    const { data: active } = await database.from("tenant_memberships")
      .select("id,tenant_id,user_id,invited_email,status")
      .eq("tenant_id", input.tenantId)
      .eq("user_id", input.userId)
      .eq("invited_email", normalized)
      .eq("status", "active")
      .maybeSingle();
    if (active) return active as TenantMembershipRow;
    throw new TenantLifecycleError(404, "The invitation is no longer available");
  }
  const { data, error } = await database.rpc("platform_upsert_tenant_membership", {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_invited_email: normalized,
    p_membership_status: "active",
    p_actor_user_id: input.userId,
    p_actor_email: normalized,
  });
  return rpcData<TenantMembershipRow>(data, error);
}

export async function createTenantWorkspace(input: {
  slug: string;
  name: string;
  adminEmail?: string;
  actor: PlatformTenantActor;
  origin: string;
  requestId: string;
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
    const invitation = await inviteTenantAdmin({ tenantId: tenant.id, email: input.adminEmail, actor: input.actor, origin: input.origin, requestId: input.requestId });
    return { tenant, membership: invitation.membership, warning: invitation.warning, operatorMessage: invitation.operatorMessage, deliveryStatus: invitation.deliveryStatus };
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
