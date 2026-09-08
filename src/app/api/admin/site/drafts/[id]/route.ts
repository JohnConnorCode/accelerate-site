import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { siteDrafts } from "@/lib/site-studio/store";
import { SlugInUseError } from "@/lib/site-studio/drafts";
import {
  DraftNotFoundError,
  StaleDraftError,
  reviseSiteDraft,
  sitePatchSchema,
} from "@/lib/site-studio/revision";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const draft = siteDrafts().get(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

const patchSchema = z
  .object({
    patches: z.array(sitePatchSchema).min(1).max(50),
    expectedChecksum: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[site-studio] Draft revision received a non-JSON body");
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "A revision needs 1 to 50 valid patch operations" },
      { status: 400 },
    );
  try {
    const draft = await reviseSiteDraft(siteDrafts(), id, parsed.data);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DraftNotFoundError)
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (error instanceof StaleDraftError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof SlugInUseError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    const message = error instanceof Error ? error.message : "Draft revision failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
