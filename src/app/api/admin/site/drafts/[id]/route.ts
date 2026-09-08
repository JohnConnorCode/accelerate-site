import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { siteDrafts } from "@/lib/site-studio/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const draft = siteDrafts().get(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ draft });
}
