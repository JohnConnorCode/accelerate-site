import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getFirstUseProgress } from "@/lib/revenue-os/first-use";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getFirstUseProgress(auth.database));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Progress unavailable" },
      { status: 503 },
    );
  }
}
