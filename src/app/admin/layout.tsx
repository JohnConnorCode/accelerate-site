import { headers } from "next/headers";
import { NextResponse } from "next/server";
import AdminShell from "@/components/admin/AdminShell";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { tenant } from "@/config/tenant";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/context";
import { requireAdmin } from "@/lib/admin/auth";
import { getCurrentLayout } from "@/lib/revenue-os/admin-layout";
import type { LayoutDoc } from "@/lib/admin/layout-overrides";

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
  if (!demoScenarioId) {
    try {
      const auth = await requireAdmin();
      if (!(auth instanceof NextResponse)) {
        navLayoutOverride = await getCurrentLayout(auth.database, "nav.sidebar");
      }
    } catch {
      navLayoutOverride = null;
    }
  }

  return (
    <AdminDemoBoundary scenarioId={demoScenarioId}>
      <AdminShell
        demoScenarioId={demoScenarioId}
        demoRoute={demoRoute}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        isPlatformAdmin={isPlatformAdmin}
        navLayoutOverride={navLayoutOverride}
      >
        {children}
      </AdminShell>
    </AdminDemoBoundary>
  );
}
