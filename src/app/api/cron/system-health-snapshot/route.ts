import { NextRequest, NextResponse } from "next/server";
import { loadOperationalHealth } from "@/lib/revenue-os/health";
import { withJobRun } from "@/lib/revenue-os/runs";
import { healthSnapshotClaimKey, summarizeOperationalHealth } from "@/lib/revenue-os/scheduler";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { listTenantSystemContexts } from "@/lib/tenancy/system";

export const maxDuration = 30;

// Vercel Cron always issues a GET request to the configured path (see
// vercel.json). This route was POST-only, so it was unreachable by its own
// cron trigger even after being added to the crons array — GET delegates to
// the same handler; POST stays available for manual/local triggering.
export async function GET(request: NextRequest) {
  return handleSnapshot(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshot(request);
}

async function handleSnapshot(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contexts = await listTenantSystemContexts({ source: "system-health-cron" });
    const tenants = [] as Array<Record<string, unknown>>;
    for (const context of contexts) {
      try {
        const result = await runWithTenantRequestContext(context, async () => {
          const supabase = createServiceRoleClient(context);
          return withJobRun(
            supabase,
            "system-health-snapshot",
            async () => {
              const health = await loadOperationalHealth(supabase);
              const summary = summarizeOperationalHealth(health);
              return { value: summary, summary };
            },
            healthSnapshotClaimKey(),
          );
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
          error: error instanceof Error ? error.message : "Health snapshot failed",
        });
      }
    }
    return NextResponse.json({
      success: true,
      tenants,
      failed: tenants.filter((tenant) => tenant.status === "failed").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health snapshot failed" },
      { status: 500 },
    );
  }
}
