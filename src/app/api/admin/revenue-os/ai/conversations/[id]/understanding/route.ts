import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { AiConversationSchemaUnavailableError } from "@/lib/revenue-os/ai-conversations";
import { understandArchitectSession } from "@/lib/revenue-os/architect-understanding";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await context.params;
    const understanding = await understandArchitectSession(
      auth.database,
      auth.user.email || "founder",
      id,
    );
    return NextResponse.json({ understanding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not extract business model";
    const status =
      error instanceof AiConversationSchemaUnavailableError
        ? 503
        : /not found/i.test(message)
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
