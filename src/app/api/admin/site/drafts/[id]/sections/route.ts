import { DEFAULT_SITE_MODEL, SITE_STUDIO_MODELS } from "@/lib/site-studio/models";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit } from "@/lib/rate-limit";
import { siteDrafts } from "@/lib/site-studio/database-store";
import { DraftNotFoundError } from "@/lib/site-studio/drafts";
import { regenerateSection } from "@/lib/site-studio/regenerate";
import { StaleDraftError } from "@/lib/site-studio/revision";
import { regenerateSectionWithOpenRouter } from "@/lib/site-studio/openrouter-adapter";
import { siteNodeIdSchema } from "@/lib/site-studio/document";

const regenerateSchema = z
  .object({
    sectionId: siteNodeIdSchema,
    model: z
      .string()
      .refine(
        (value) => SITE_STUDIO_MODELS.some((model) => model.id === value),
        "Choose a supported model",
      )
      .default(DEFAULT_SITE_MODEL),
    direction: z.string().trim().max(1000).optional(),
    expectedChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const maxDuration = 180;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[site-studio] Section regeneration received a non-JSON body");
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = regenerateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Regeneration needs a section id and optional direction" },
      { status: 400 },
    );
  const adminKey = auth.user.email ?? auth.user.id;
  const { success } = rateLimit(`site-studio-regenerate:${adminKey}`, 20, 60 * 60 * 1000);
  if (!success)
    return NextResponse.json(
      { error: "Generation limit reached. Try again in an hour." },
      { status: 429 },
    );
  try {
    const draft = await regenerateSection(
      siteDrafts(auth.database, auth.user.email ?? auth.user.id),
      id,
      parsed.data.sectionId,
      {
        direction: parsed.data.direction,
        expectedChecksum: parsed.data.expectedChecksum,
      },
      (system, user) =>
        regenerateSectionWithOpenRouter(auth.database, system, user, parsed.data.model),
    );
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DraftNotFoundError)
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (error instanceof StaleDraftError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    const message = error instanceof Error ? error.message : "Section regeneration failed";
    const status = /not configured|limit reached/i.test(message) ? 503 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
