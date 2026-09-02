import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/revenue-os/audit";
import {
  MODULE_MAP,
  getActiveModules,
  validateModuleSettingsInput,
  type ModuleSettingsConfig,
} from "@/lib/revenue-os/modules";

/**
 * Toggles an optional module on or off, and reads/writes its per-module
 * settings, for the caller's own tenant.
 *
 * Writes tenants.config.modules[moduleId] (enablement) and
 * tenants.config.moduleSettings[moduleId] (settings), which every module
 * gate (isModuleEnabled / isNavLinkEnabled / isAiToolModuleEnabled) and
 * getModuleSettings already read through the tenantConfig they are passed.
 * The enablement write was previously missing entirely: nothing anywhere
 * ever supplied it, so every module resolved to enabled on every
 * deployment regardless of what this route now lets an admin turn off.
 *
 * The tenants table itself only grants SELECT to authenticated roles (see
 * migrations/20260830-shared-database-tenancy.sql); writing it requires the
 * service-role client, scoped explicitly to auth.tenant.id, which is read
 * from the authenticated session, never from request input.
 */

const patchSchema = z.union([
  z.object({ moduleId: z.string().trim().min(1).max(80), enabled: z.boolean() }),
  z.object({
    moduleId: z.string().trim().min(1).max(80),
    settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
]);

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const tenantConfig = {
    modules: (authorization.tenant.config?.modules as Partial<Record<string, boolean>>) ?? {},
  };
  const moduleSettings =
    (authorization.tenant.config?.moduleSettings as ModuleSettingsConfig) ?? {};
  return NextResponse.json({
    modules: getActiveModules(tenantConfig).map((module) => module.id),
    overrides: tenantConfig.modules,
    moduleSettings,
  });
}

export async function PATCH(request: NextRequest) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid module request" }, { status: 400 });

  const moduleDef = MODULE_MAP.get(parsed.data.moduleId);
  if (!moduleDef) return NextResponse.json({ error: "Unknown module" }, { status: 404 });

  const platform = createPlatformServiceRoleClient("tenant-module-toggle");
  const { data: tenantRow, error: readError } = await platform
    .from("tenants")
    .select("config")
    .eq("id", authorization.tenant.id)
    .single();
  if (readError || !tenantRow) {
    return NextResponse.json({ error: "Workspace could not be read" }, { status: 500 });
  }

  const existingConfig =
    tenantRow.config && typeof tenantRow.config === "object"
      ? (tenantRow.config as Record<string, unknown>)
      : {};
  const existingModules =
    existingConfig.modules && typeof existingConfig.modules === "object"
      ? (existingConfig.modules as Record<string, boolean>)
      : {};
  const existingModuleSettings =
    existingConfig.moduleSettings && typeof existingConfig.moduleSettings === "object"
      ? (existingConfig.moduleSettings as ModuleSettingsConfig)
      : {};

  if ("enabled" in parsed.data) {
    if (moduleDef.isCore) {
      return NextResponse.json({ error: "Core modules cannot be disabled" }, { status: 400 });
    }
    const nextModules = { ...existingModules, [parsed.data.moduleId]: parsed.data.enabled };
    const nextConfig = { ...existingConfig, modules: nextModules };

    const { error: writeError } = await platform
      .from("tenants")
      .update({ config: nextConfig, updated_at: new Date().toISOString() })
      .eq("id", authorization.tenant.id);
    if (writeError) {
      return NextResponse.json(
        { error: "The module could not be updated. Try again." },
        { status: 500 },
      );
    }

    await recordAudit(authorization.database, {
      actorEmail: authorization.user.email,
      action: parsed.data.enabled ? "module.enabled" : "module.disabled",
      entityType: "tenant_module",
      entityId: parsed.data.moduleId,
      before: { enabled: existingModules[parsed.data.moduleId] ?? moduleDef.defaultEnabled },
      after: { enabled: parsed.data.enabled },
    });

    return NextResponse.json({
      moduleId: parsed.data.moduleId,
      enabled: parsed.data.enabled,
      modules: getActiveModules({ modules: nextModules }).map((module) => module.id),
    });
  }

  // Settings write. The client is never the authority on shape or range:
  // every field is re-validated against what the module actually declared.
  if (!moduleDef.settings?.length) {
    return NextResponse.json(
      { error: `${moduleDef.name} does not declare any settings.` },
      { status: 400 },
    );
  }
  const validated = validateModuleSettingsInput(parsed.data.moduleId, parsed.data.settings);
  if (!validated.valid) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const before = existingModuleSettings[parsed.data.moduleId] ?? {};
  const nextModuleSettings = {
    ...existingModuleSettings,
    [parsed.data.moduleId]: { ...before, ...validated.value },
  };
  const nextConfig = { ...existingConfig, moduleSettings: nextModuleSettings };

  const { error: writeError } = await platform
    .from("tenants")
    .update({ config: nextConfig, updated_at: new Date().toISOString() })
    .eq("id", authorization.tenant.id);
  if (writeError) {
    return NextResponse.json({ error: "Settings could not be saved. Try again." }, { status: 500 });
  }

  await recordAudit(authorization.database, {
    actorEmail: authorization.user.email,
    action: "module.settings_updated",
    entityType: "tenant_module",
    entityId: parsed.data.moduleId,
    before,
    after: nextModuleSettings[parsed.data.moduleId],
  });

  return NextResponse.json({
    moduleId: parsed.data.moduleId,
    settings: nextModuleSettings[parsed.data.moduleId],
  });
}
