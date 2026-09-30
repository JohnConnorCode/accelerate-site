import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { applyWorkspaceConfigurationAsAdmin } from "@/lib/revenue-os/workspace-configuration";
import { z } from "zod";
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({ source: z.enum(["all", "gmail", "calendar", "drive"]).default("all") })
    .strict()
    .safeParse(await readBoundedJson(request).catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid Google source" }, { status: 400 });
  try {
    const receipt = await runWithTenantRequestContext(auth, () =>
      applyWorkspaceConfigurationAsAdmin(
        auth.database,
        { operation: "sync_google", source: input.data.source },
        auth.user.email!,
      ),
    );
    if (!receipt.success && !receipt.skipped)
      return NextResponse.json(
        {
          ...receipt,
          error:
            "Google sync did not complete. Inspect the recorded source results; completed work remains. Retry only the incomplete source.",
        },
        { status: 400 },
      );
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google sync could not complete" },
      { status: 400 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({ driveFolderIds: z.array(z.string().max(256)).max(10) })
    .strict()
    .safeParse(await readBoundedJson(request).catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Supply up to 10 valid Google Drive folder IDs" },
      { status: 400 },
    );
  try {
    const result = await runWithTenantRequestContext(auth, () =>
      applyWorkspaceConfigurationAsAdmin(
        auth.database,
        { operation: "set_drive_folders", folderIds: input.data.driveFolderIds },
        auth.user.email!,
      ),
    );
    return NextResponse.json({ success: true, folders: input.data.driveFolderIds.length, result });
  } catch {
    return NextResponse.json(
      { error: "Drive folders could not be saved. Refresh and review the folder selection." },
      { status: 409 },
    );
  }
}
