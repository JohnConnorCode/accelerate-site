import "server-only";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { projectModuleConfiguration } from "./module-configuration-read";
import { moduleChangeSchema } from "./module-actions-contract";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bindTenantDatabase,
  createPlatformServiceRoleClient,
  tenantIdForDatabase,
} from "@/lib/supabase/server";
import {
  MODULE_MAP,
  getActiveModules,
  validateModuleSettingsInput,
  type ModuleSettingsConfig,
} from "./modules";
import { ensureBundledPluginSources } from "./bundled-plugin-sources";
import { recordAudit } from "./audit";
export type ModuleConfigurationChange =
  { moduleId: string; enabled: boolean } | { moduleId: string; settings: Record<string, unknown> };
/** Caller supplies an authenticated, tenant-bound administrative writer. The
 * config snapshot is a compare-and-swap token, preserving concurrent changes. */
export async function updateModuleConfiguration(
  db: SupabaseClient,
  change: ModuleConfigurationChange,
  actorEmail: string,
  expectedRevision?: string,
) {
  change = moduleChangeSchema.parse(change);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant-bound module administration required");
  const moduleDef = MODULE_MAP.get(change.moduleId);
  if (!moduleDef) throw new Error("Unknown module");
  if ("enabled" in change && (moduleDef.isCore || typeof change.enabled !== "boolean"))
    throw new Error("Only optional modules can be toggled");
  const validated =
    "settings" in change ? validateModuleSettingsInput(change.moduleId, change.settings) : null;
  if (validated && !validated.valid) throw new Error(validated.error);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("tenants")
      .select("config,status")
      .eq("id", tenantId)
      .maybeSingle();
    if (error || !data || data.status !== "active")
      throw new Error("Active workspace could not be read");
    const expected = data.config === null ? null : JSON.stringify(data.config);
    const current = (expected ? JSON.parse(expected) : {}) as Record<string, unknown>;
    if (
      expectedRevision &&
      projectModuleConfiguration(change.moduleId, current).revision !== expectedRevision
    )
      throw new Error("Module configuration changed. Preview and approve again.");
    if ("enabled" in change && change.enabled)
      await ensureBundledPluginSources(db, change.moduleId);
    const modules = (current.modules ?? {}) as Record<string, boolean>;
    const settings = (current.moduleSettings ?? {}) as ModuleSettingsConfig;
    const before =
      "enabled" in change
        ? { enabled: modules[change.moduleId] ?? moduleDef.defaultEnabled }
        : (settings[change.moduleId] ?? {});
    const after =
      "enabled" in change
        ? { enabled: change.enabled }
        : { ...settings[change.moduleId], ...(validated?.valid ? validated.value : {}) };
    const next =
      "enabled" in change
        ? { ...current, modules: { ...modules, [change.moduleId]: change.enabled } }
        : { ...current, moduleSettings: { ...settings, [change.moduleId]: after } };
    let query = db
      .from("tenants")
      .update({ config: next, updated_at: new Date().toISOString() })
      .eq("id", tenantId)
      .eq("status", "active");
    query = expected === null ? query.is("config", null) : query.eq("config", expected);
    const result = await query.select("id").maybeSingle();
    if (result.error) throw new Error("Module configuration could not be saved");
    if (!result.data) continue;
    await recordAudit(db, {
      actorEmail,
      action:
        "enabled" in change
          ? change.enabled
            ? "module.enabled"
            : "module.disabled"
          : "module.settings_updated",
      entityType: "tenant_module",
      entityId: change.moduleId,
      before,
      after,
    });
    return "enabled" in change
      ? {
          moduleId: change.moduleId,
          enabled: change.enabled,
          modules: getActiveModules({
            modules: { ...modules, [change.moduleId]: change.enabled },
          }).map((item) => item.id),
        }
      : { moduleId: change.moduleId, settings: after };
  }
  throw new Error("Workspace configuration changed concurrently. Refresh and retry.");
}

export async function updateModuleConfigurationAsAdmin(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
  expectedRevision?: string,
) {
  const change = moduleChangeSchema.parse(raw);
  const tenantId = await assertCurrentTenantAdmin(db, actorEmail);
  const writer = bindTenantDatabase(
    createPlatformServiceRoleClient("approved-module-configuration"),
    tenantId,
    true,
  );
  return updateModuleConfiguration(writer, change, actorEmail, expectedRevision);
}
