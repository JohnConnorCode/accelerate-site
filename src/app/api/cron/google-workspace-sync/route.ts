import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncCalendar, syncDrive, syncGmail } from "@/lib/revenue-os/google";
import { withJobRun } from "@/lib/revenue-os/runs";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServiceRoleClient();
  try {
    const result = await withJobRun(supabase, "google-workspace-sync", async () => {
      const summary: Record<string, unknown> = {};
      summary.gmail = await syncGmail(supabase);
      summary.calendar = await syncCalendar(supabase);
      summary.drive = await syncDrive(supabase);
      return { value: summary, summary };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google sync failed" }, { status: 500 });
  }
}
