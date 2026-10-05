import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { siteDrafts } from "@/lib/site-studio/database-store";
import { createSiteDraft, createSiteDraftSchema, SlugInUseError } from "@/lib/site-studio/drafts";
import {
  buildPageSystemPrompt,
  buildPageUserPrompt,
  type PageBrief,
} from "@/lib/site-studio/generate";
import { generatePageWithOpenRouter } from "@/lib/site-studio/openrouter-adapter";

export const maxDuration = 180;

export async function GET() {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  const drafts = (await siteDrafts(auth).list()).map((draft) => ({
    id: draft.id,
    slug: draft.slug,
    title: draft.title,
    source: draft.source,
    updatedAt: draft.updatedAt,
    checksum: draft.checksum,
  }));
  return NextResponse.json({ drafts });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[site-studio] Draft create received a non-JSON body");
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = createSiteDraftSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Check the title, slug, brief, and mode" }, { status: 400 });
  const input = parsed.data;
  const brief: PageBrief = {
    serviceName: input.brief.serviceName,
    audience: input.brief.audience,
    outcome: input.brief.outcome,
    extra: input.brief.extra,
  };
  if (input.mode === "ai") {
    const adminKey = auth.user.email ?? auth.user.id;
    const rateLimitResult = await rateLimit(`site-studio-generate:${adminKey}`, 20, 60 * 60 * 1000);
    if (!rateLimitResult.success)
      return rateLimitResponse(rateLimitResult, {
        error: "Generation limit reached. Try again in an hour.",
      });
  }
  try {
    const draft = await createSiteDraft(
      siteDrafts(auth),
      {
        title: input.title,
        slug: input.slug,
        brief,
        mode: input.mode,
        assetIds: input.assetIds ?? [],
      },
      (candidate) =>
        generatePageWithOpenRouter(
          auth.database,
          candidate,
          buildPageSystemPrompt(),
          buildPageUserPrompt(candidate),
          input.model,
          input.priceCeiling,
        ),
    );
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof SlugInUseError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    const message = error instanceof Error ? error.message : "Draft creation failed";
    const status = /not configured|limit reached/i.test(message) ? 503 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
