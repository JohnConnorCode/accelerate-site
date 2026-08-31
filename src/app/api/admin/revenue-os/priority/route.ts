import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOperatorQueue, summarizeOperatorQueue } from "@/lib/revenue-os/queue";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await loadOperatorQueue(auth.database);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: summarizeOperatorQueue(items),
      items,
    });
  } catch (error) {
    console.error("[revenue-os/priority]", error);
    return NextResponse.json({ error: "Could not load operator priorities." }, { status: 500 });
  }
}
