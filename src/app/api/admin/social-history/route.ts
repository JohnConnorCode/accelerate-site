import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readSocialWorkspace } from "@/lib/revenue-os/social-marketing";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await readSocialWorkspace(auth.database), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Social workspace could not be loaded. Verify setup and retry." },
      { status: 503 },
    );
  }
}
