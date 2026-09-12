import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { siteDrafts } from "@/lib/site-studio/database-store";
import { discardSiteDraft, DraftNotFoundError, SlugInUseError } from "@/lib/site-studio/drafts";
import { StaleDraftError, reviseSiteDraft, sitePatchSchema } from "@/lib/site-studio/revision";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const draft = await siteDrafts(auth).get(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

const patchSchema = z
  .object({
    patches: z.array(sitePatchSchema).min(1).max(50),
    expectedChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminForModule("site-studio");
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
    const draft = await reviseSiteDraft(
      siteDrafts(auth),
      id,
      parsed.data,
    );
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const expectedChecksum = request.headers.get("if-match");
  if (!expectedChecksum || !/^[a-f0-9]{64}$/.test(expectedChecksum))
    return NextResponse.json({ error: "Reload the draft before discarding it" }, { status: 428 });
  try {
    const discarded = await discardSiteDraft(
      siteDrafts(auth),
      id,
      expectedChecksum,
    );
    return NextResponse.json({ discarded });
  } catch (error) {
    if (error instanceof DraftNotFoundError)
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    const message = error instanceof Error ? error.message : "Draft discard failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
