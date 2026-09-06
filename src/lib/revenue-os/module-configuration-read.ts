import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import {
  MODULE_MAP,
  REVENUE_OS_MODULES,
  getModuleSettings,
  isModuleEnabled,
  validateModuleSettingsInput,
  type ModuleSettingsConfig,
} from "./modules";
import { moduleReadSchema } from "./module-actions-contract";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const configurationDigest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
export function projectModuleConfiguration(moduleId: string, config: Record<string, unknown>) {
  const definition = MODULE_MAP.get(moduleId);
  if (!definition) throw new Error("Unknown module");
  const settings = getModuleSettings(moduleId, config.moduleSettings as ModuleSettingsConfig);
  const valid = validateModuleSettingsInput(moduleId, settings);
  if (!valid.valid)
    throw new Error("Stored module settings require repair before AI configuration");
  const enabled = isModuleEnabled(moduleId, config as { modules?: Record<string, boolean> });
  const facts = { moduleId, enabled, settings: valid.value, definition };
  return {
    moduleId,
    name: definition.name,
    isCore: definition.isCore,
    enabled,
    settings: valid.value,
    fields: definition.settings ?? [],
    revision: configurationDigest(facts),
    installation: definition.workflow?.sources ?? definition.report?.sources ?? [],
  };
}
export async function readModuleConfiguration(db: SupabaseClient, raw: unknown) {
  const input = moduleReadSchema.parse(raw);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant-bound module configuration required");
  const { data, error } = await db
    .from("tenants")
    .select("config,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || data?.status !== "active")
    throw new Error("Active workspace configuration is unavailable");
  const modules = (input.moduleId ? [input.moduleId] : REVENUE_OS_MODULES.map((m) => m.id)).map(
    (id) => projectModuleConfiguration(id, data.config ?? {}),
  );
  const result = { modules, requiresHumanApproval: true };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 48_000)
    throw new Error("Module context exceeds 48 KB. Filter by moduleId.");
  return result;
}
