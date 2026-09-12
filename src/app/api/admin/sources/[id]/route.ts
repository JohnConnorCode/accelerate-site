import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { verifySource } from "@/lib/revenue-os/source-authority";

export async function PUT(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const source = await verifySource(auth.database, { id, actorEmail: auth.user.email });
    return NextResponse.json({ source });
  } catch (error) {
    const message = (error as Error).message;
    console.error("Database error:", message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
