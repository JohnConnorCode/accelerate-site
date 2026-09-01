import { NextResponse } from "next/server";
import { buildSearchIndex } from "@/lib/search";

// The index is derived from content that only changes on deploy, so it is
// cached hard. The dialog fetches it once and filters locally, which keeps
// typing instant and costs nothing per keystroke.
export const revalidate = 3600;

export async function GET() {
  try {
    const entries = buildSearchIndex();
    return NextResponse.json(
      { entries },
      { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    // A search index that fails to build must not take a page down with it. The
    // dialog degrades to telling the visitor search is unavailable.
    console.error("[search] index build failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { entries: [], error: "Search is unavailable right now." },
      { status: 503 },
    );
  }
}
