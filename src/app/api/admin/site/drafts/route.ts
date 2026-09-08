import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import { siteSlugSchema } from "@/lib/site-studio/document";
import { siteDrafts } from "@/lib/site-studio/store";
import { createSiteDraft, MAX_ATTACHED_ASSETS, SlugInUseError } from "@/lib/site-studio/drafts";
import {
  buildPageSystemPrompt,
  buildPageUserPrompt,
  type PageBrief,
} from "@/lib/site-studio/generate";
import { generatePageWithOpenRouter } from "@/lib/site-studio/openrouter-adapter";

const briefSchema = z
  .object({
    serviceName: z.string().trim().min(1).max(120),
    audience: z.string().trim().min(1).max(160),
    outcome: z.string().trim().min(1).max(500),
    extra: z.string().trim().max(1000).optional(),
  })
  .strict();

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    slug: siteSlugSchema.optional(),
    brief: briefSchema,
    mode: z.enum(["template", "ai"]),
    assetIds: z.array(z.string().min(1).max(120)).max(MAX_ATTACHED_ASSETS).optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const drafts = siteDrafts()
    .list()
    .map((draft) => ({
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
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[site-studio] Draft create received a non-JSON body");
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
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
    const { success } = rateLimit(`site-studio-generate:${adminKey}`, 20, 60 * 60 * 1000);
    if (!success)
      return NextResponse.json(
        { error: "Generation limit reached. Try again in an hour." },
        { status: 429 },
      );
  }
  try {
    const draft = await createSiteDraft(
      siteDrafts(),
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
