import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

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

  return (
    <AdminDemoBoundary scenarioId={demoScenarioId}>
      <AdminShell demoScenarioId={demoScenarioId} demoRoute={demoRoute}>
        {children}
      </AdminShell>
    </AdminDemoBoundary>
  );
}
