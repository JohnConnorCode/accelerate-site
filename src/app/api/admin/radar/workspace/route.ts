import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readRadarWorkspace } from "@/lib/revenue-os/radar-workspace";
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await readRadarWorkspace(auth.database, {
        opportunityId: new URL(request.url).searchParams.get("opportunityId") ?? undefined,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[radar-workspace] Authenticated workspace read failed");
    return NextResponse.json(
      { error: "Radar could not be loaded. Check the installation and try again." },
      { status: 503 },
    );
  }
}
