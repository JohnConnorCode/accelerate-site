import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { syncCalendar, syncDrive, syncGmail } from "@/lib/revenue-os/google";
import { MAX_DRIVE_FOLDERS, normalizeDriveFolderIds } from "@/lib/revenue-os/drive-sync-plan";
import { withJobRun } from "@/lib/revenue-os/runs";
import { googleOperatorError } from "@/lib/revenue-os/google-oauth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const source = ((await request.json().catch(() => ({}))) as { source?: string }).source || "all";
  if (!["all", "gmail", "calendar", "drive"].includes(source))
    return NextResponse.json({ error: "Invalid Google source" }, { status: 400 });
  const supabase = auth.database;
  try {
    const result = await withJobRun(supabase, `google-${source}-sync`, async () => {
      const summary: Record<string, unknown> = {};
      if (source === "all" || source === "gmail") summary.gmail = await syncGmail(supabase);
      if (source === "all" || source === "calendar")
        summary.calendar = await syncCalendar(supabase);
      if (source === "all" || source === "drive") summary.drive = await syncDrive(supabase);
      return { value: summary, summary };
    });
    return NextResponse.json({
      success: true,
      result: result.value,
      skipped: !result.claimed,
      runId: result.runId,
      existingStatus: result.existingStatus ?? null,
    });
  } catch (error) {
    const projected = googleOperatorError(error, "sync");
    return NextResponse.json({ error: projected.message, code: projected.code }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as { driveFolderIds?: string[] };
  if (!Array.isArray(body.driveFolderIds)) {
    return NextResponse.json({ error: "Supply up to 10 Google Drive folder IDs" }, { status: 400 });
  }
  // One shared rule with the sync read path: trim, charset-validate,
  // deduplicate, and cap. Rejections are reported explicitly so the Setup
  // Center can show what did not survive and why.
  const { ids, rejected } = normalizeDriveFolderIds(body.driveFolderIds);
  if (rejected.length > 0) {
    const reasons = [...new Set(rejected.map((entry) => entry.reason))].join(", ");
    return NextResponse.json(
      {
        error: `Rejected ${rejected.length} folder ID(s) (${reasons}). Supply up to ${MAX_DRIVE_FOLDERS} valid Google Drive folder IDs.`,
        rejected: rejected.slice(0, 10),
      },
      { status: 400 },
    );
  }
  const supabase = auth.database;
  const { data } = await supabase
    .from("integration_connections")
    .select("settings")
    .eq("provider", "google")
    .maybeSingle();
  const { error } = await supabase
    .from("integration_connections")
    .update({
      settings: {
        ...(data?.settings ?? {}),
        drive_folder_ids: ids,
      },
    })
    .eq("provider", "google")
    .eq("status", "connected");
  if (error)
    return NextResponse.json({ error: "Drive folder access could not be saved." }, { status: 500 });
  return NextResponse.json({ success: true, folders: ids.length });
}
