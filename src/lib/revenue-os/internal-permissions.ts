import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { proposeAction } from "./actions";
import { checkAutonomy } from "./autonomy-policy";
import {
  internalPermissionSchema,
  internalPermissionProposalSchema,
  INTERNAL_ACTION_FIELDS,
} from "./internal-permission-contract";

function actor(database: SupabaseClient, actorEmail: string) {
  const context = getTenantRequestContext();
  if (
    context?.kind !== "actor" ||
    context.database !== database ||
    context.user.email !== actorEmail ||
    context.tenant.id !== tenantIdForDatabase(database)
  )
    throw new Error("Permission changes require an authenticated workspace administrator");
  return context;
}
export async function previewInternalPermission(
  database: SupabaseClient,
  input: unknown,
  actorEmail: string,
) {
  const context = actor(database, actorEmail);
  const permission = internalPermissionSchema.parse(input);
  const expires = Date.parse(permission.expiresAt);
  if (expires <= Date.now() || expires > Date.now() + 30 * 86400000)
    throw new Error("Choose a permission expiry within the next 30 days");
  const table =
    permission.actionKey === "update_task"
      ? "tasks"
      : permission.actionKey === "bulk_tag_contacts"
        ? "contacts"
        : "opportunities";
  // Notes can be attached to any canonical record; never infer identity from a name.
  const tables =
    permission.actionKey === "create_founder_note"
      ? ["contacts", "companies", "opportunities"]
      : [table];
  const found = new Set<string>();
  for (const target of tables) {
    const result = await database.from(target).select("id").in("id", permission.recordIds);
    if (result.error) throw new Error("Could not verify permission record scope");
    for (const row of result.data ?? []) found.add(row.id);
  }
  if (permission.recordIds.some((id) => !found.has(id)))
    throw new Error("Every permission record must belong to this workspace");
  const constraints = { ...permission, actorId: context.user.id };
  const digest = createHash("sha256")
    .update(JSON.stringify([context.tenant.id, constraints]))
    .digest("hex");
  return {
    permission,
    constraints,
    digest,
    requiresHumanApproval: true,
    consequence: `Allow ${permission.actionKey.replaceAll("_", " ")} on ${permission.recordIds.length} named records, at most ${permission.maxDailyActions} times per UTC day, until ${permission.expiresAt}. Only these fields: ${permission.allowedFields.join(", ")}. Messages, publishing, billing, deletion and permission changes still require approval.`,
  };
}
export async function proposeInternalPermission(
  database: SupabaseClient,
  input: unknown,
  actorEmail: string,
) {
  const parsed = internalPermissionProposalSchema.parse(input);
  const preview = await previewInternalPermission(database, parsed.permission, actorEmail);
  if (preview.digest !== parsed.digest)
    throw new Error("Permission preview changed; review it again");
  return proposeAction(database, {
    actionType: "internal_permission_change",
    title: `Allow bounded ${parsed.permission.actionKey.replaceAll("_", " ")}`,
    description: preview.consequence,
    payload: preview,
    proposedBy: actorEmail,
    sourceContext: "admin_ai",
    dedupeKey: `internal-permission:${preview.digest}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}
export async function executeInternalPermission(
  database: SupabaseClient,
  actionId: string,
  payload: Record<string, unknown>,
  actorEmail: string,
) {
  const context = actor(database, actorEmail);
  const preview = await previewInternalPermission(database, payload.permission, actorEmail);
  if (preview.digest !== payload.digest)
    throw new Error("Permission changed; prepare a fresh preview");
  const result = await database.rpc("execute_internal_permission", {
    p_action_id: actionId,
    p_actor_id: context.user.id,
    p_constraints: preview.constraints,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function reserveInternalAction(
  database: SupabaseClient,
  actionId: string,
  requesterId: string,
  reserve: boolean,
) {
  const context = getTenantRequestContext();
  const proof =
    context?.kind === "actor" && context.database === database && context.user.id === requesterId
      ? context.workspaceMcpProof
      : undefined;
  const result = await database.rpc("reserve_internal_action", {
    p_action_id: actionId,
    p_actor_id: requesterId,
    p_reserve: reserve,
    p_mcp: proof ?? null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as { allowed: boolean; reason: string; policyIds?: string[] };
}
export async function tryExecuteInternalProposal(
  database: SupabaseClient,
  output: unknown,
  requesterId?: string,
) {
  const row = output as {
    id?: string;
    action_type?: string;
    status?: string;
    proposed_by?: string;
  } | null;
  if (
    !row?.id ||
    !row.action_type ||
    !(row.action_type in INTERNAL_ACTION_FIELDS) ||
    row.status !== "pending" ||
    !requesterId
  )
    return output;
  const policy = await checkAutonomy(database, row.action_type);
  if (!policy.allowed || policy.requiresApproval) return output;
  const admission = await reserveInternalAction(database, row.id, requesterId, false);
  if (!admission.allowed) return { ...row, approvalReason: admission.reason };
  const { approveAndExecuteAction } = await import("./action-executor");
  const result = await approveAndExecuteAction(database, row.id, row.proposed_by || "agent", {
    mode: "autonomous",
    requesterId,
  });
  const receipt = result as { complete?: boolean; status?: string } | null;
  const status =
    receipt?.complete === false ||
    ["partial", "failed", "pending", "denied"].includes(receipt?.status ?? "")
      ? "partial"
      : "executed";
  return {
    ...row,
    status: "executed",
    execution: { status, actionId: row.id, result, policyIds: admission.policyIds },
  };
}
