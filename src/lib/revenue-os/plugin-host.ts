import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { MODULE_MAP, isModuleEnabled } from "./modules";
import { getEntityType } from "./entity-registry";
import { queryCapabilityEntities } from "./capability-data-api";
export async function requireEnabledPlugin(db: SupabaseClient, pluginId: string) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("A tenant-bound plugin host is required");
  const moduleDef = MODULE_MAP.get(pluginId);
  if (!moduleDef || (!moduleDef.report && !moduleDef.workflow))
    throw new Error("Unknown executable plugin");
  const { data, error } = await db
    .from("tenants")
    .select("config,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data || data.status !== "active")
    throw new Error("Active workspace configuration is unavailable");
  if (!isModuleEnabled(pluginId, data.config))
    throw new Error("Plugin is disabled. Enable it in Plugins or Integrations.");
  return { tenantId, moduleDef };
}
export async function loadPluginSources(
  db: SupabaseClient,
  pluginId: string,
  sources: { name: string; type: string; columns: string[]; inputKey?: string }[],
  input: Record<string, unknown> = {},
) {
  const { tenantId } = await requireEnabledPlugin(db, pluginId);
  const snapshots: Record<string, Record<string, unknown>[]> = Object.create(null);
  let inspectedRows = 0,
    truncated = false;
  for (const source of sources) {
    const type = await getEntityType(db, tenantId, source.type);
    const readable = type?.metadata?.readable_columns;
    if (
      !type ||
      type.isDisabled ||
      type.idColumn !== "id" ||
      !Array.isArray(readable) ||
      source.columns.some((column) => column !== "id" && !readable.includes(column))
    )
      throw new Error(
        `Missing readable source ${source.type}. Register the workspace plugin sources first.`,
      );
    const selected = source.inputKey ? input[source.inputKey] : null;
    if (source.inputKey && (typeof selected !== "string" || !selected))
      throw new Error(`Select ${source.name} before preparing this workflow`);
    const result = await queryCapabilityEntities(
      db,
      {
        tenantId,
        capabilityId: pluginId,
        entities: sources.map((item) => item.type),
        recipes: [],
        namespace: false,
      },
      {
        type: source.type,
        limit: source.inputKey ? 1 : 100,
        ...(source.inputKey
          ? { filters: [{ column: "id", op: "eq" as const, value: selected }] }
          : {}),
      },
    );
    if (source.inputKey && result.rows.length !== 1)
      throw new Error(`Selected ${source.name} is unavailable in this workspace`);
    inspectedRows += result.rows.length;
    truncated ||= result.usage.truncated;
    snapshots[source.name] = result.rows.map((row) =>
      Object.fromEntries(source.columns.map((column) => [column, row[column] ?? null])),
    );
  }
  if (Buffer.byteLength(JSON.stringify(snapshots), "utf8") > 65536)
    throw new Error("Plugin source snapshot exceeds 64 KiB");
  return { snapshots, inspectedRows, truncated };
}
