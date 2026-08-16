import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncCalendar, syncDrive, syncGmail } from "@/lib/revenue-os/google";
import { withJobRun } from "@/lib/revenue-os/runs";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const source = (await request.json().catch(() => ({})) as { source?: string }).source || "all";
  if (!["all", "gmail", "calendar", "drive"].includes(source)) return NextResponse.json({ error: "Invalid Google source" }, { status: 400 });
  const supabase = createServiceRoleClient();
  try {
    const result = await withJobRun(supabase, `google-${source}-sync`, async () => {
      const summary: Record<string, unknown> = {};
      if (source === "all" || source === "gmail") summary.gmail = await syncGmail(supabase);
      if (source === "all" || source === "calendar") summary.calendar = await syncCalendar(supabase);
      if (source === "all" || source === "drive") summary.drive = await syncDrive(supabase);
      return { value: summary, summary };
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google sync failed" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { driveFolderIds?: string[] };
  if (!Array.isArray(body.driveFolderIds) || body.driveFolderIds.length > 10 || body.driveFolderIds.some((id) => typeof id !== "string" || !id.trim())) {
    return NextResponse.json({ error: "Supply up to 10 Google Drive folder IDs" }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("integration_connections").select("settings").eq("provider", "google").maybeSingle();
  const { error } = await supabase.from("integration_connections").update({ settings: { ...(data?.settings ?? {}), drive_folder_ids: body.driveFolderIds.map((id) => id.trim()) } }).eq("provider", "google").eq("status", "connected");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
