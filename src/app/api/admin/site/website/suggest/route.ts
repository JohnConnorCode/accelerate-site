import { SiteModelSelectionError } from "@/lib/site-studio/models";
import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { rateLimit } from "@/lib/rate-limit";
import { assertWebsiteOwner } from "@/lib/site-studio/website-store";
import { proposeWebsitePage, websiteAiInput } from "@/lib/site-studio/website-ai";
export const maxDuration = 180;

export async function POST(request: Request) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  try {
    assertWebsiteOwner(auth);
  } catch {
    console.warn("[site-studio] Website AI refused installation ownership");
    return NextResponse.json(
      { error: "Only the installation owner can use website AI." },
      { status: 403 },
    );
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Use this installation to request changes." },
      { status: 403 },
    );
  let input;
  try {
    input = websiteAiInput.parse(await readBoundedJson(request, 600000));
  } catch {
    console.warn("[site-studio] Website AI input rejected");
    return NextResponse.json(
      { error: "Choose a valid page and describe the change in up to 2,000 characters." },
      { status: 400 },
    );
  }
  if (!rateLimit(`website-ai:${auth.user.id}`, 20, 60 * 60 * 1000).success)
    return NextResponse.json(
      { error: "Generation limit reached. Try again in an hour." },
      { status: 429 },
    );
  try {
    return NextResponse.json(await proposeWebsitePage(auth, input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SiteModelSelectionError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    console.warn("[site-studio] Website AI provider suggestion failed; no content written");
    return NextResponse.json(
      {
        error:
          "AI could not prepare this change. Try a shorter request or another model; check Setup if AI is not connected. Your page is unchanged.",
      },
      { status: 503 },
    );
  }
}
