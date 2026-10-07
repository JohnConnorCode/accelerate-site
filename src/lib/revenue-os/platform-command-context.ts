import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfiguredAdmin, normalizeAdminEmail } from "@/lib/admin/access";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";

export const PRIVATE_COMMAND_TABLES = new Set([
  "action_queue",
  "audit_log",
  "agent_runs",
  "agent_run_events",
  "ai_conversations",
  "ai_messages",
]);
interface PlatformCommandScope {
  database: SupabaseClient;
  tenantId: string;
  ownerUserId: string;
}
const commands = new AsyncLocalStorage<PlatformCommandScope>();

/** Only a freshly authenticated founder can enter this server-owned scope.
 * Model arguments, membership snapshots and service actors cannot mint it. */
export async function runWithPlatformCommandContext<T>(
  database: SupabaseClient,
  actorEmail: string,
  work: () => Promise<T>,
  expectedOwner?: string,
): Promise<T> {
  const actor = getTenantRequestContext();
  if (
    actor?.kind !== "actor" ||
    actor.database !== database ||
    !actor.isPlatformAdmin ||
    actor.workspaceMcpProof ||
    !isConfiguredAdmin(actorEmail)
  )
    throw new Error("A current founder session is required for private commands");
  const { data, error } = await database.auth.getUser();
  const user = data?.user;
  if (
    error ||
    !user ||
    user.is_anonymous ||
    user.id !== actor.user.id ||
    !isConfiguredAdmin(user.email) ||
    normalizeAdminEmail(user.email) !== normalizeAdminEmail(actorEmail) ||
    (expectedOwner && expectedOwner !== user.id)
  )
    throw new Error("Private command founder authentication was revoked or does not match");
  const tenantId = await assertCurrentTenantAdmin(database, actorEmail);
  return commands.run({ database, tenantId, ownerUserId: user.id }, work);
}

export function platformCommandScopeForDatabase(database: SupabaseClient) {
  const scope = commands.getStore();
  if (!scope) return undefined;
  if (scope.database !== database || scope.tenantId !== tenantIdForDatabase(database))
    throw new Error("Private commands cannot use another database or workspace");
  return scope;
}

/** Write annotation lives in the existing tenant adapter, never model payloads. */
export function attachPrivateCommandOwner(
  database: SupabaseClient,
  table: string,
  rows: unknown,
): unknown {
  if (!PRIVATE_COMMAND_TABLES.has(table)) return rows;
  const scope = platformCommandScopeForDatabase(database);
  if (Array.isArray(rows))
    return rows.map((row) => attachPrivateCommandOwner(database, table, row));
  if (!rows || typeof rows !== "object") return rows;
  const row = rows as Record<string, unknown>;
  if (
    Object.hasOwn(row, "platform_owner_user_id") &&
    (!scope || row.platform_owner_user_id !== scope.ownerUserId)
  )
    throw new Error("Private command ownership must come from the authenticated server context");
  return scope ? { ...row, platform_owner_user_id: scope.ownerUserId } : row;
}

/** Queue readers use RLS. Legacy shared installations may not yet have the new
 * column; private proposals themselves always fail closed without it. */
export async function withActionCommandContext<T>(
  database: SupabaseClient,
  id: string,
  actorEmail: string,
  work: (privateCommand: boolean) => Promise<T>,
): Promise<T> {
  const { data, error } = await database
    .from("action_queue")
    .select("platform_owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (error && error.code !== "42703" && error.code !== "PGRST204") throw new Error(error.message);
  return data?.platform_owner_user_id
    ? runWithPlatformCommandContext(
        database,
        actorEmail,
        () => work(true),
        String(data.platform_owner_user_id),
      )
    : work(false);
}
