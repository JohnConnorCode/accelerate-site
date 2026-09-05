import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient, bindTenantDatabase } from "@/lib/supabase/server";
import { updateModuleConfiguration } from "@/lib/revenue-os/module-configuration";
import { MODULE_MAP, getActiveModules, type ModuleSettingsConfig } from "@/lib/revenue-os/modules";

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

  try {
    const database = bindTenantDatabase(
      createPlatformServiceRoleClient("tenant-module-toggle"),
      authorization.tenant.id,
      true,
    );
    return NextResponse.json(
      await updateModuleConfiguration(
        database,
        parsed.data,
        authorization.user.email || "workspace-member",
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Module configuration could not be saved" },
      { status: 409 },
    );
  }
}
