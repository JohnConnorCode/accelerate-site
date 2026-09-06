import { NextResponse } from "next/server";
import { requireAdmin, type AdminAuthorization } from "./auth";
import { isModuleEnabled, MODULE_MAP } from "@/lib/revenue-os/modules";

/**
 * The real gate. Page-level gating in src/app/admin/layout.tsx renders a
 * notice instead of children, but Next renders layout and page in parallel,
 * so a page's own data fetching is never actually stopped by that layer.
 * This is authorization: it composes with the requireAdmin() call every
 * admin API route already makes and refuses before any handler body runs.
 *
 * Deliberately not middleware. /api/admin/* is outside the middleware
 * matcher, and adding it would put a tenant row read at the edge on every
 * admin API call; requireAdmin() already loads the tenant row once per
 * request, so this reuses that read instead of adding a second one.
 */
export async function requireAdminForModule(
  moduleId: string,
): Promise<AdminAuthorization | NextResponse> {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const moduleDef = MODULE_MAP.get(moduleId);
  if (!moduleDef) {
    // A guard naming a module that does not exist is a programming error in
    // this route, not a tenant configuration state, so it fails closed and
    // loudly rather than silently granting access.
    return NextResponse.json({ error: "Module not registered" }, { status: 500 });
  }

  const tenantConfig = {
    modules: authorization.tenant.config?.modules as Partial<Record<string, boolean>> | undefined,
  };
  if (!isModuleEnabled(moduleId, tenantConfig)) {
    return NextResponse.json(
      { error: `The "${moduleDef.name}" module is disabled for this workspace.` },
      { status: 403 },
    );
  }

  return authorization;
}
