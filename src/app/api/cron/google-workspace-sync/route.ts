import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { listTenantSystemContexts } from "@/lib/tenancy/system";
import { syncCalendar, syncDrive, syncGmail } from "@/lib/revenue-os/google";
import { withJobRun } from "@/lib/revenue-os/runs";

// A workspace sync pages through Gmail and Calendar. At the 10s Hobby default
// it is killed partway through. 60s is the Hobby maximum.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const contexts = await listTenantSystemContexts({ source: "google-workspace-cron", provider: "google", includeBootstrapFallback: true });
    const tenants = [] as Array<Record<string, unknown>>;
    for (const context of contexts) {
      try {
        const result = await runWithTenantRequestContext(context, async () => {
          const supabase = createServiceRoleClient(context);
          return withJobRun(supabase, "google-workspace-sync", async () => {
            const summary: Record<string, unknown> = {};
            summary.gmail = await syncGmail(supabase);
            summary.calendar = await syncCalendar(supabase);
            summary.drive = await syncDrive(supabase);
            return { value: summary, summary };
          });
        });
        tenants.push({ tenant: context.tenantSlug, status: result.claimed ? "completed" : "skipped", runId: result.runId, summary: result.value });
      } catch (error) {
        tenants.push({ tenant: context.tenantSlug, status: "failed", error: error instanceof Error ? error.message : "Google sync failed" });
      }
    }
    return NextResponse.json({ tenants, failed: tenants.filter((tenant) => tenant.status === "failed").length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google sync failed" }, { status: 500 });
  }
}
