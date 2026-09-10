import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadTodaySnapshot } from "@/lib/revenue-os/today-snapshot";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try { return NextResponse.json(await loadTodaySnapshot(auth.database)); }
  catch (error) {
    console.error("[revenue-os/today]", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Today could not be refreshed. Please retry." }, { status: 503 });
  }
}
