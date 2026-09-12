import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { diffDrafts } from "@/lib/revenue-os/correction-capture";

/**
 * Detect reusable-correction candidates from a draft diff. Read-only: this
 * endpoint never files anything. Filing goes through POST /api/admin/learning
 * after human review.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.warn("Correction detection received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { before, after } = body as { before?: unknown; after?: unknown };
  if (typeof before !== "string" || typeof after !== "string") {
    return NextResponse.json({ error: "before and after strings are required" }, { status: 400 });
  }

  try {
    const candidate = diffDrafts({
      before,
      after,
      context:
        body.context && typeof body.context === "object"
          ? (body.context as Record<string, unknown>)
          : null,
    });
    return NextResponse.json({ candidate });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
