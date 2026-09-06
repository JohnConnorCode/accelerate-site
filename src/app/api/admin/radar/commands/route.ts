import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { dispatchRadarWorkspaceCommand } from "@/lib/revenue-os/radar-workspace";
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await dispatchRadarWorkspaceCommand(
        auth.database,
        await readBoundedJson(request),
        auth.user.email ?? "",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Radar request could not be prepared. Refresh the record and retry.",
      },
      { status: 422 },
    );
  }
}
