import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AiConversationSchemaUnavailableError,
  setArchitectConnectedContext,
  type AiConnectedContext,
} from "@/lib/revenue-os/ai-conversations";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: { connectedContext?: unknown } | null = null;
  try {
    body = (await request.json()) as { connectedContext?: unknown };
  } catch (error) {
    console.warn("Architect connected context received invalid JSON", error);
  }
  if (!body || !Array.isArray(body.connectedContext)) {
    return NextResponse.json({ error: "connectedContext must be an array" }, { status: 400 });
  }
  const connectedContext = body.connectedContext.flatMap((item): AiConnectedContext[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.source !== "string" ||
      typeof row.scope !== "string" ||
      typeof row.permission !== "string" ||
      typeof row.resourceId !== "string"
    )
      return [];
    return [
      {
        source: row.source,
        scope: row.scope,
        permission: row.permission,
        resourceId: row.resourceId,
      },
    ];
  });
  try {
    const { id } = await context.params;
    const result = await setArchitectConnectedContext(auth.database, {
      actorEmail: auth.user.email || "founder",
      conversationId: id,
      connectedContext,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update connected context";
    const status =
      error instanceof AiConversationSchemaUnavailableError
        ? 503
        : /not found/i.test(message)
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
