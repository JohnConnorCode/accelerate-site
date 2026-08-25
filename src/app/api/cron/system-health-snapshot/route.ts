import { NextRequest, NextResponse } from "next/server";
import { loadOperationalHealth } from "@/lib/revenue-os/health";
import { withJobRun } from "@/lib/revenue-os/runs";
import { healthSnapshotClaimKey, summarizeOperationalHealth } from "@/lib/revenue-os/scheduler";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  try {
    const result = await withJobRun(supabase, "system-health-snapshot", async () => {
      const health = await loadOperationalHealth(supabase);
      const summary = summarizeOperationalHealth(health);
      return { value: summary, summary };
    }, healthSnapshotClaimKey());

    return NextResponse.json(result.claimed
      ? { success: true, runId: result.runId, summary: result.value }
      : { success: true, skipped: true, runId: result.runId, reason: "This cadence window already has a receipt." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Health snapshot failed" }, { status: 500 });
  }
}
