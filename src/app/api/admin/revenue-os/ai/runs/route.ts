import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AiOperationsValidationError,
  loadAiRunHistory,
  parseAiRunHistoryFilters,
} from "@/lib/revenue-os/ai-operations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const filters = parseAiRunHistoryFilters(request.nextUrl.searchParams);
    return NextResponse.json(await loadAiRunHistory(auth.database, filters));
  } catch (error) {
    if (error instanceof AiOperationsValidationError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(
      "[ai-operations] could not load run history",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Could not load AI run history" }, { status: 500 });
  }
}
