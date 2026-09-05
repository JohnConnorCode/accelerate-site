import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readCollectionWorkspace } from "@/lib/revenue-os/collection-workspace";
export async function GET(request: Request) {
  const auth = await requireAdminForModule("receivables-collections");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await readCollectionWorkspace(
        auth.database,
        new URL(request.url).searchParams.get("contactId") ?? undefined,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.warn("[collections] Workspace read unavailable");
    return NextResponse.json(
      { error: "Collections workspace could not be loaded" },
      { status: 503 },
    );
  }
}
