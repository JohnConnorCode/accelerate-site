import { NextResponse } from "next/server";
import { buildSearchIndex } from "@/lib/search";
import { distributionProfile } from "@/lib/distribution/profile";
import { readPublicWebsite } from "@/lib/site-studio/website-public";

// The index is derived from content that only changes on deploy, so it is
// cached hard. The dialog fetches it once and filters locally, which keeps
// typing instant and costs nothing per keystroke.
export const revalidate = 3600;

export async function GET() {
  try {
    let entries = buildSearchIndex();
    const neutral = distributionProfile() === "neutral";
    if (neutral) {
      const website = await readPublicWebsite();
      if (website.mode === "unavailable") throw new Error("Published search unavailable");
      if (website.mode !== "bootstrap")
        entries = entries.filter((entry) => entry.id !== "page-home");
      if (website.mode === "published")
        entries = [
          ...entries,
          ...[
            ...website.document.pages,
            ...website.document.collections.flatMap((collection) => collection.entries),
          ]
            .filter((page) => !page.metadata.noIndex)
            .map((page) => ({
              id: `website-${page.id}`,
              title: page.metadata.title,
              description: page.metadata.description,
              href: page.path,
              group: "Pages" as const,
              keywords: [],
            })),
        ];
    }
    return NextResponse.json(
      { entries },
      {
        headers: {
          "Cache-Control": neutral
            ? "no-store"
            : "public, max-age=600, stale-while-revalidate=86400",
        },
      },
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
