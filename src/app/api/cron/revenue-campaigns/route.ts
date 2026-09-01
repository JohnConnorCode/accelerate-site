import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { listTenantSystemContexts } from "@/lib/tenancy/system";
import { executeDueCampaignMembers } from "@/lib/revenue-os/campaigns";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { reconcileRecoveryOutcomes } from "@/lib/revenue-os/recovery";
import { withJobRun } from "@/lib/revenue-os/runs";

// A campaign run sends real email one recipient at a time. At the 10s Hobby
// default it is killed partway through, which the job ledger then has to
// recover as a stale claim. 60s is the Hobby maximum.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const contexts = await listTenantSystemContexts({
      source: "revenue-campaign-cron",
      provider: "resend",
      includeBootstrapFallback: true,
    });
    const tenants = [] as Array<Record<string, unknown>>;
    for (const context of contexts) {
      try {
        const result = await runWithTenantRequestContext(context, async () => {
          const supabase = createServiceRoleClient(context);
          return withJobRun(supabase, "revenue-campaigns", async () => {
            const summary = await executeDueCampaignMembers(supabase);
            // Recovery campaigns use the same governed executor as every other
            // campaign. Reconcile their canonical reply/booking/pipeline facts after
            // each run so revenue receipts do not depend on an operator clicking a
            // dashboard button. A not-yet-applied additive recovery migration must
            // never block ordinary campaign delivery.
            let recovery = { playbooks: 0, reconciled: 0, outcomes: 0 };
            try {
              const { data: playbooks, error } = await supabase
                .from("recovery_playbooks")
                .select("campaign_id")
                .limit(100);
              if (error) throw new Error(error.message);
              const reconciled = await Promise.all(
                (playbooks ?? []).map((playbook) =>
                  reconcileRecoveryOutcomes(
                    supabase,
                    playbook.campaign_id,
                    "system:revenue-campaigns",
                  ),
                ),
              );
              recovery = {
                playbooks: reconciled.length,
                reconciled: reconciled.reduce((total, item) => total + item.reconciled, 0),
                outcomes: reconciled.reduce((total, item) => total + item.outcomes, 0),
              };
            } catch (error) {
              if (!isMissingRevenueSchema(error)) throw error;
            }
            const value = { ...summary, recovery };
            return {
              value,
              summary: value,
              status: summary.failed ? ("partial" as const) : ("success" as const),
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
          error: error instanceof Error ? error.message : "Campaign job failed",
        });
      }
    }
    return NextResponse.json({
      tenants,
      failed: tenants.filter((tenant) => tenant.status === "failed").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign job failed" },
      { status: 500 },
    );
  }
}
