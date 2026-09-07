import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { getEntityType } from "./entity-registry";
import { isModuleEnabled } from "./modules";

export const RECORD_PERMISSION_VERSION = "revenue-os-record-permissions.v1";

/** Operations the shared evaluator governs. Reads and exports never mutate;
 * writes and actions must additionally pass autonomy and approval upstream. */
export type RecordPermissionOperation = "read" | "relate" | "export" | "write" | "action";

export type RecordPermissionPrincipalKind =
  | "platform_admin"
  | "workspace_member"
  | "integration";

export interface RecordPermissionPrincipal {
  kind: RecordPermissionPrincipalKind;
  /** Actor email, or the stable system identity (e.g. "cron", "mcp:bearer"). */
  email: string;
}

export type RecordDenyCode =
  | "tenant_unknown_or_suspended"
  | "membership_revoked"
  | "role_insufficient"
  | "module_disabled"
  | "entity_unknown"
  | "entity_not_granted"
  | "field_not_readable"
  | "autonomy_denied";

export const RECORD_DENY_CODES: readonly RecordDenyCode[] = [
  "tenant_unknown_or_suspended",
  "membership_revoked",
  "role_insufficient",
  "module_disabled",
  "entity_unknown",
  "entity_not_granted",
  "field_not_readable",
  "autonomy_denied",
] as const;

export interface RecordPermissionPolicyRef {
  tenantId: string;
  moduleId: string | null;
  entityType: string;
  grant: string | null;
  autonomyLevel: string | null;
}

export type RecordPermissionDecision =
  | { allowed: true; policy: RecordPermissionPolicyRef }
  | { allowed: false; code: RecordDenyCode; reason: string; policy: RecordPermissionPolicyRef };

export interface AuthorizeRecordAccessInput {
  principal: RecordPermissionPrincipal;
  operation: RecordPermissionOperation;
  /** Entity key, e.g. "webinar" for a registered custom type. */
  entityType: string;
  /** Owning module, e.g. "campaigns". Unknown ids fail closed. */
  moduleId: string;
  /** Single field being read or written, when the check is field-scoped. */
  field?: string;
  /** Grant the caller acts under for registered custom types. */
  grant?: string;
  /** Precomputed autonomy verdict from checkAutonomy (no duplicate RPC here). */
  autonomy?: { allowed: boolean; hardFloor?: boolean; level?: string | null; reason?: string | null };
}

function deny(
  code: RecordDenyCode,
  reason: string,
  policy: RecordPermissionPolicyRef,
): RecordPermissionDecision {
  return { allowed: false, code, reason, policy };
}

/**
 * One shared record-permission evaluator for UI, API, AI, MCP, and plugins.
 *
 * Order is deliberate and default-deny: tenant active → membership/role →
 * module enabled → entity grant/columns → autonomy. It reuses the existing
 * authoritative primitives (tenants config, memberships, module map,
 * entity-registry readable columns) instead of redefining them, so every
 * surface that delegates here decides identically.
 *
 * What it does NOT do: authenticate anyone (callers resolve identity first),
 * replace row-level tenant scoping (the tenant-bound client still owns that),
 * or duplicate the autonomy RPC (callers pass the verdict they already hold).
 * The tenant comes from the client binding, never from caller input — an
 * unbound client fails closed, exactly like capability-data-api scope().
 */
export async function authorizeRecordAccess(
  db: SupabaseClient,
  input: AuthorizeRecordAccessInput,
): Promise<RecordPermissionDecision> {
  const { principal, operation, entityType, moduleId } = input;
  const tenantId = tenantIdForDatabase(db);
  const policy: RecordPermissionPolicyRef = {
    tenantId: tenantId ?? "unbound",
    moduleId,
    entityType,
    grant: input.grant ?? null,
    autonomyLevel: input.autonomy?.level ?? null,
  };
  if (!tenantId)
    return deny(
      "tenant_unknown_or_suspended",
      "Record access requires a matching tenant-bound host database",
      policy,
    );

  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("id,status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw new Error(tenantError.message);
  if (!tenant || tenant.status !== "active")
    return deny(
      "tenant_unknown_or_suspended",
      `Workspace ${tenantId} is not active; access is denied by default`,
      policy,
    );

  if (principal.kind === "workspace_member") {
    const { data: membership, error: membershipError } = await db
      .from("tenant_memberships")
      .select("status,role")
      .eq("tenant_id", tenantId)
      .eq("invited_email", principal.email)
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership || membership.status !== "active")
      return deny(
        "membership_revoked",
        `${principal.email} has no active membership in workspace ${tenantId}`,
        policy,
      );
    // The schema carries a single admin role today; writes, exports, and
    // actions additionally require it so a future lesser role fails closed.
    if (
      (operation === "write" || operation === "export" || operation === "action") &&
      membership.role !== "admin"
    )
      return deny(
        "role_insufficient",
        `${operation} on ${entityType} requires a workspace admin`,
        policy,
      );
  }
  // platform_admin and integration kinds skip membership: the founder is
  // authorized by ADMIN_EMAIL upstream, and system contexts carry an explicit
  // tenant identity. Both remain bound to the tenant, module, and grant
  // checks below — there is no ambient cross-tenant access.

  if (!isModuleEnabled(moduleId, (tenant.config ?? {}) as { modules?: Record<string, boolean> }))
    return deny(
      "module_disabled",
      `Module ${moduleId} is not enabled for workspace ${tenantId}`,
      policy,
    );

  // The registry only answers slug-shaped keys; anything else stays on the
  // host-canonical path rather than throwing through the evaluator.
  const slugShaped = /^[a-z][a-z0-9_]{0,63}$/.test(entityType);
  const registered = slugShaped ? await getEntityType(db, tenantId, entityType) : null;
  if (registered) {
    if (registered.isDisabled)
      return deny(
        "entity_unknown",
        `Entity type ${entityType} is disabled in workspace ${tenantId}`,
        policy,
      );
    // Registered custom types inherit the host access policy above AND
    // require an explicit grant: a manifest can never widen its own
    // authority beyond the grant the host approved.
    if (!input.grant)
      return deny(
        "entity_not_granted",
        `Entity type ${entityType} requires an explicit capability grant`,
        policy,
      );
    const readable = (registered.metadata as Record<string, unknown> | null)?.readable_columns;
    if (input.field && input.field !== "id" && (!Array.isArray(readable) || !readable.includes(input.field)))
      return deny(
        "field_not_readable",
        `Field ${input.field} is not readable on ${entityType}`,
        { ...policy, grant: input.grant },
      );
    policy.grant = input.grant;
  } else if (input.field && operation !== "read" && operation !== "relate") {
    // Host-canonical tables have no field ACLs; the tenant-bound client and
    // membership checks above govern them. Field scoping for writes on
    // unregistered types fails closed rather than guessing.
    return deny(
      "entity_unknown",
      `Entity type ${entityType} is not registered in workspace ${tenantId}`,
      policy,
    );
  }

  if (
    (operation === "write" || operation === "action") &&
    input.autonomy &&
    (!input.autonomy.allowed || input.autonomy.hardFloor)
  )
    return deny(
      "autonomy_denied",
      input.autonomy.reason || `Autonomy policy denies ${operation} on ${entityType}`,
      policy,
    );

  return { allowed: true, policy };
}

/**
 * Owning module per MCP resource URI. Core modules are always enabled, so
 * this changes no default behavior today; it makes the ownership explicit
 * and lets a disabled optional module (or a suspended workspace) deny with
 * the same decision object every other surface shares.
 */
export const MCP_RESOURCE_MODULES: Record<string, string> = {
  "revenue-os://today/snapshot": "core-command",
  "revenue-os://system/modules": "core-system",
  "revenue-os://knowledge/registry": "core-intelligence",
  "revenue-os://plugins/registry": "core-system",
  "revenue-os://work-engine/queue": "core-command",
  "revenue-os://capabilities/graph": "core-system",
  "revenue-os://memory/overview": "core-intelligence",
};

export function moduleForMcpResource(uri: string): string | null {
  return MCP_RESOURCE_MODULES[uri] ?? null;
}

export async function authorizeMcpResource(
  db: SupabaseClient,
  input: { principal: RecordPermissionPrincipal; uri: string },
): Promise<RecordPermissionDecision> {
  const moduleId = moduleForMcpResource(input.uri);
  if (!moduleId)
    return deny(
      "entity_unknown",
      `Unknown MCP resource ${input.uri}`,
      {
        tenantId: "unbound",
        moduleId: null,
        entityType: input.uri,
        grant: null,
        autonomyLevel: null,
      },
    );
  return authorizeRecordAccess(db, {
    principal: input.principal,
    operation: "read",
    // MCP resources are host-governed reads; the URI travels in the caller's
    // denial context, not as an entity key.
    entityType: "mcp_resource",
    moduleId,
  });
}
