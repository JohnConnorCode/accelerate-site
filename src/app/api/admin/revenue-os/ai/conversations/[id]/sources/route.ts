import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AiConversationSchemaUnavailableError,
  attachArchitectSource,
} from "@/lib/revenue-os/ai-conversations";

type SourceBody = {
  clientSourceId?: unknown;
  kind?: unknown;
  filename?: unknown;
  contentType?: unknown;
  excerpt?: unknown;
  source?: unknown;
  scope?: unknown;
  permission?: unknown;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: SourceBody | null = null;
  try {
    body = (await request.json()) as SourceBody;
  } catch (error) {
    console.warn("Architect source attach received invalid JSON", error);
  }
  if (
    !body ||
    typeof body.clientSourceId !== "string" ||
    typeof body.filename !== "string" ||
    typeof body.excerpt !== "string"
  ) {
    return NextResponse.json(
      { error: "clientSourceId, filename and excerpt are required" },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    const source = await attachArchitectSource(auth.database, {
      actorEmail: auth.user.email || "founder",
      conversationId: id,
      clientSourceId: body.clientSourceId,
      kind: body.kind === "connected" ? "connected" : "upload",
      filename: body.filename,
      contentType: typeof body.contentType === "string" ? body.contentType : "text/plain",
      excerpt: body.excerpt,
      source: typeof body.source === "string" ? body.source : undefined,
      scope: typeof body.scope === "string" ? body.scope : undefined,
      permission: typeof body.permission === "string" ? body.permission : undefined,
    });
    return NextResponse.json({ source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not attach source";
    const status =
      error instanceof AiConversationSchemaUnavailableError
        ? 503
        : /not found/i.test(message)
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
