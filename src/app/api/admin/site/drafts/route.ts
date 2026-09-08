import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import { servicePageSlug, servicePageTemplate } from "@/lib/site-studio/templates";
import { siteDrafts } from "@/lib/site-studio/store";
import { assertCatalogAsset } from "@/lib/site-studio/assets";
import { parseSiteDocument, type SiteDocument } from "@/lib/site-studio/document";
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
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    brief: briefSchema,
    mode: z.enum(["template", "ai"]),
    assetIds: z.array(z.string().min(1).max(120)).max(8).optional(),
  })
  .strict();

function appendGallery(document: SiteDocument, assetIds: string[]): SiteDocument {
  if (assetIds.length === 0) return document;
  for (const assetId of assetIds) assertCatalogAsset(assetId);
  const gallery = {
    id: "attached-images",
    type: "section",
    styles: { paddingTop: "md", paddingBottom: "md" },
    children: assetIds.map((assetId, index) => ({
      id: `attached-image-${index + 1}`,
      type: "image",
      props: { assetId },
    })),
  } as const;
  return parseSiteDocument({
    ...document,
    root: [...document.root, gallery],
  });
}

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
  const slug = input.slug ?? servicePageSlug(brief.serviceName);
  if (siteDrafts().list().some((draft) => draft.slug === slug))
    return NextResponse.json(
      { error: `A draft already uses the slug ${slug}; choose another slug` },
      { status: 409 },
    );
  try {
    let document: SiteDocument;
    if (input.mode === "ai") {
      const adminKey = auth.user.email ?? auth.user.id;
      const { success } = rateLimit(`site-studio-generate:${adminKey}`, 20, 60 * 60 * 1000);
      if (!success)
        return NextResponse.json(
          { error: "Generation limit reached. Try again in an hour." },
          { status: 429 },
        );
      document = await generatePageWithOpenRouter(
        auth.database,
        brief,
        buildPageSystemPrompt(),
        buildPageUserPrompt(brief),
      );
    } else {
      document = servicePageTemplate(brief);
    }
    const withImages = appendGallery(
      {
        ...document,
        metadata: { ...document.metadata, title: input.title ?? document.metadata.title, slug },
      },
      input.assetIds ?? [],
    );
    const draft = siteDrafts().save({
      title: withImages.metadata.title,
      slug,
      document: withImages,
      source: input.mode,
      brief: buildPageUserPrompt(brief),
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft creation failed";
    const status = /not configured|limit reached/i.test(message) ? 503 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
