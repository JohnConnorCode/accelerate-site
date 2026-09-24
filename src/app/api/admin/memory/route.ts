import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listAgentMemoryForReview } from "@/lib/revenue-os/memory";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  try {
    const memories = await listAgentMemoryForReview(auth.database, {
      category: params.get("category"),
      coworkerId: params.get("coworker"),
      search: params.get("q"),
      includeExpired: params.get("expired") === "1",
      limit: 50,
    });
    return NextResponse.json({ memories });
  } catch (error) {
    const message = (error as Error).message;
    if (/unknown memory category/i.test(message))
      return NextResponse.json({ error: message }, { status: 400 });
    console.error("Database error:", message);
    return NextResponse.json({ error: "Memory could not be loaded" }, { status: 500 });
  }
}
