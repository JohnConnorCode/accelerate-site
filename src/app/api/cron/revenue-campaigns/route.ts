import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { executeDueCampaignMembers } from "@/lib/revenue-os/campaigns";
import { withJobRun } from "@/lib/revenue-os/runs";

// A campaign run sends real email one recipient at a time. At the 10s Hobby
// default it is killed partway through, which the job ledger then has to
// recover as a stale claim. 60s is the Hobby maximum.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServiceRoleClient();
  try {
    const result = await withJobRun(supabase, "revenue-campaigns", async () => {
      const summary = await executeDueCampaignMembers(supabase);
      return { value: summary, summary, status: summary.failed ? "partial" as const : "success" as const };
    });
    return NextResponse.json(result.claimed ? result.value : { skipped: true, reason: `A ${result.existingStatus || "previous"} run already owns this job`, runId: result.runId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign job failed" }, { status: 500 });
  }
}
