import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AiConversationSchemaUnavailableError,
  setArchitectAssumptions,
  setArchitectConnectedContext,
  type AiConnectedContext,
} from "@/lib/revenue-os/ai-conversations";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: { connectedContext?: unknown; assumptions?: unknown } | null = null;
  try {
    body = (await request.json()) as { connectedContext?: unknown; assumptions?: unknown };
  } catch (error) {
    console.warn("Architect connected context received invalid JSON", error);
  }
  if (!body || (body.connectedContext === undefined && body.assumptions === undefined)) {
    return NextResponse.json(
      { error: "connectedContext or assumptions is required" },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const actorEmail = auth.user.email || "founder";
  try {
    const result: {
      connectedContext?: AiConnectedContext[];
      assumptions?: string[];
    } = {};
    if (Array.isArray(body.connectedContext)) {
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
      result.connectedContext = (
        await setArchitectConnectedContext(auth.database, {
          actorEmail,
          conversationId: id,
          connectedContext,
        })
      ).connectedContext;
    }
    if (Array.isArray(body.assumptions)) {
      result.assumptions = (
        await setArchitectAssumptions(auth.database, {
          actorEmail,
          conversationId: id,
          assumptions: body.assumptions.filter((item): item is string => typeof item === "string"),
        })
      ).assumptions;
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Architect context";
    const status =
      error instanceof AiConversationSchemaUnavailableError
        ? 503
        : /not found/i.test(message)
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
