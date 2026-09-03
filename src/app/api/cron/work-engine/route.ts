import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { listTenantSystemContexts } from "@/lib/tenancy/system";
import { executeClaimableWork } from "@/lib/revenue-os/work-executor";
import { registerSalesWorkHandlers } from "@/lib/revenue-os/sales-coworker";
import { registerBusinessPulseWorkHandlers } from "@/lib/revenue-os/business-pulse-coworker";
import { registerMeetingIntelWorkHandlers } from "@/lib/revenue-os/meeting-intel-coworker";
import { withJobRun } from "@/lib/revenue-os/runs";

// Register all coworker handlers on module load.
registerSalesWorkHandlers();
registerBusinessPulseWorkHandlers();
registerMeetingIntelWorkHandlers();

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contexts = await listTenantSystemContexts({
      source: "work-engine-cron",
      includeBootstrapFallback: true,
    });

    const tenants = [] as Array<Record<string, unknown>>;

    for (const context of contexts) {
      try {
        const result = await runWithTenantRequestContext(context, async () => {
          const supabase = createServiceRoleClient(context);
          return withJobRun(supabase, "work-engine", async () => {
            const summary = await executeClaimableWork(supabase, { maxItems: 10 });
            return {
              value: summary,
              summary: summary as unknown as Record<string, unknown>,
              status: summary.failed > 0 ? ("partial" as const) : ("success" as const),
            };
          });
        });

        tenants.push({
          tenant: context.tenantSlug,
          status: result.claimed ? "completed" : "skipped",
          runId: result.runId,
          summary: result.value,
        });
      } catch (error) {
        tenants.push({
          tenant: context.tenantSlug,
          status: "failed",
          error: error instanceof Error ? error.message : "Work engine job failed",
        });
      }
    }

    return NextResponse.json({
      tenants,
      failed: tenants.filter((t) => t.status === "failed").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Work engine job failed" },
      { status: 500 },
    );
  }
}
