import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { tenant } from "@/config/tenant";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/context";

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

  return (
    <AdminDemoBoundary scenarioId={demoScenarioId}>
      <AdminShell
        demoScenarioId={demoScenarioId}
        demoRoute={demoRoute}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        isPlatformAdmin={isPlatformAdmin}
      >
        {children}
      </AdminShell>
    </AdminDemoBoundary>
  );
}
