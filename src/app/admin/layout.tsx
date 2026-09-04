import { headers } from "next/headers";
import { NextResponse } from "next/server";
import AdminShell from "@/components/admin/AdminShell";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import { ModuleDisabledNotice } from "@/components/admin/ModuleDisabledNotice";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { tenant } from "@/config/tenant";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/context";
import { requireAdmin } from "@/lib/admin/auth";
import { getCurrentLayout } from "@/lib/revenue-os/admin-layout";
import type { LayoutDoc } from "@/lib/admin/layout-overrides";
import { isModuleEnabled, SELF_LOCKOUT_EXEMPT_MODULES } from "@/lib/revenue-os/modules";
import { resolveModuleForAdminPath } from "@/lib/revenue-os/module-routes";

// Demo URLs are request-time rewrites. Rendering this shared layout dynamically
// lets the server pass the validated scenario to the exact same admin shell
// without exposing live admin data or creating a parallel demo application.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const rawScenarioId = requestHeaders.get("x-accelerate-demo-scenario") || "";
  const demoScenarioId: DemoScenarioId | null = isDemoScenarioId(rawScenarioId)
    ? rawScenarioId
    : null;
  const demoRoute = demoScenarioId
    ? requestHeaders.get("x-accelerate-demo-route") || "today"
    : null;
  const workspaceSlug = requestHeaders.get("x-tenant-slug") || ACCELERATE_TENANT_SLUG;
  const workspaceName = requestHeaders.get("x-tenant-name") || tenant.brand.name;
  const isPlatformAdmin = requestHeaders.get("x-platform-admin") === "true";

  // Best-effort: the nav layout override is a presentation nicety, never a
  // reason to fail the shell. Demo scenarios never read or write real tenant
  // admin_settings, keeping the live/demo boundary untouched.
  let navLayoutOverride: LayoutDoc | null = null;
  // The real tenant row's config.modules, not the static compile-time default.
  // Previously nothing ever supplied this, so every module resolved to
  // enabled everywhere regardless of what a tenant had disabled.
  let moduleConfig: { modules?: Partial<Record<string, boolean>> } | null = null;
  if (!demoScenarioId) {
    try {
      const auth = await requireAdmin();
      if (!(auth instanceof NextResponse)) {
        navLayoutOverride = await getCurrentLayout(auth.database, "nav.sidebar", auth.tenant.id);
        moduleConfig = {
          modules: (auth.tenant.config?.modules as Partial<Record<string, boolean>>) ?? {},
        };
      }
    } catch {
      navLayoutOverride = null;
    }
  }

  // Display gating and defense in depth, not authorization: Next renders this
  // layout and the page in parallel, so this does not stop the page's own
  // data fetching. The real gate is requireAdminForModule() in each module's
  // API routes (src/lib/admin/module-guard.ts). Demo scenarios never resolve
  // moduleConfig above, so they are never gated here, preserving the
  // fictional-workspace boundary untouched.
  const adminPath = requestHeaders.get("x-admin-path");
  const owningModule = adminPath ? resolveModuleForAdminPath(adminPath) : null;
  const moduleDisabled =
    !demoScenarioId &&
    moduleConfig &&
    owningModule &&
    !SELF_LOCKOUT_EXEMPT_MODULES.has(owningModule.id) &&
    !isModuleEnabled(owningModule.id, moduleConfig);

  return (
    <AdminDemoBoundary scenarioId={demoScenarioId}>
      <AdminShell
        demoScenarioId={demoScenarioId}
        demoRoute={demoRoute}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        isPlatformAdmin={isPlatformAdmin}
        navLayoutOverride={navLayoutOverride}
        moduleConfig={moduleConfig}
      >
        {moduleDisabled ? <ModuleDisabledNotice module={owningModule} /> : children}
      </AdminShell>
    </AdminDemoBoundary>
  );
}
