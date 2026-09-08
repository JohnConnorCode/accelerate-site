import { ProviderCircuit } from "@/lib/revenue-os/bounded-execution";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { listTenantSystemContexts } from "@/lib/tenancy/system";
import { executeClaimableWork, workExecutionJobStatus } from "@/lib/revenue-os/work-executor";
import { scheduleRecurringWork } from "@/lib/revenue-os/work-scheduler";
import { registerSalesWorkHandlers } from "@/lib/revenue-os/sales-coworker";
import { registerBusinessPulseWorkHandlers } from "@/lib/revenue-os/business-pulse-coworker";
import { registerMeetingIntelWorkHandlers } from "@/lib/revenue-os/meeting-intel-coworker";
import { registerFinanceWorkHandlers } from "@/lib/revenue-os/finance-coworker";
import { registerOperationsWorkHandlers } from "@/lib/revenue-os/operations-coworker";
import { registerTrustGraduationHandlers } from "@/lib/revenue-os/trust-graduation";
import { registerProactiveIntelHandlers } from "@/lib/revenue-os/proactive-intel";
import { withJobRun } from "@/lib/revenue-os/runs";

// Register all coworker handlers on module load.
registerSalesWorkHandlers();
registerBusinessPulseWorkHandlers();
registerMeetingIntelWorkHandlers();
registerFinanceWorkHandlers();
registerOperationsWorkHandlers();
registerTrustGraduationHandlers();
registerProactiveIntelHandlers();

// A warm process can reuse this admission hint; it is not a durable provider circuit.
const tenantCircuits = new Map<string, ProviderCircuit>();
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deadlineAt = Date.now() + 45_000;
  try {
    const contexts = await listTenantSystemContexts({
      source: "work-engine-cron",
      includeBootstrapFallback: true,
    });

    const tenants = [] as Array<Record<string, unknown>>;

    for (const context of contexts) {
      if (Date.now() >= deadlineAt || request.signal.aborted) {
        tenants.push({
          tenant: context.tenantSlug,
          status: "unattempted",
          reason: "Cron execution budget exhausted",
        });
        continue;
      }
      try {
        const result = await runWithTenantRequestContext(context, async () => {
          const supabase = createServiceRoleClient(context);
          return withJobRun(supabase, "work-engine", async () => {
            // Schedule recurring work (daily + weekly on Mondays) before execution.
            const scheduling = await scheduleRecurringWork(supabase);
            const circuit = tenantCircuits.get(context.tenantSlug) ?? new ProviderCircuit();
            if (!tenantCircuits.has(context.tenantSlug) && tenantCircuits.size >= 500)
              tenantCircuits.delete(tenantCircuits.keys().next().value!);
            tenantCircuits.set(context.tenantSlug, circuit);
            const summary = await executeClaimableWork(supabase, {
              maxItems: 10,
              deadlineMs: 20_000,
              circuit,
              signal: request.signal,
              batchDeadlineMs: Math.max(1, deadlineAt - Date.now()),
            });
            summary.errors.push(...scheduling.errors.map((error) => `scheduler:${error}`));
            return {
              value: summary,
              summary: summary as unknown as Record<string, unknown>,
              status: workExecutionJobStatus(summary),
            };
          });
        });

        tenants.push({
          tenant: context.tenantSlug,
          status:
            !result.claimed || !result.value
              ? "skipped"
              : workExecutionJobStatus(result.value) === "success"
                ? "completed"
                : workExecutionJobStatus(result.value),
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
      unattempted: tenants.filter((t) => t.status === "unattempted").length,
      failed: tenants.filter((t) => t.status === "failed").length,
      partial: tenants.filter((t) => t.status === "partial").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Work engine job failed" },
      { status: 500 },
    );
  }
}
