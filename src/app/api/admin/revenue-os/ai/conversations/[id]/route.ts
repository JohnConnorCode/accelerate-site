import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AiConversationSchemaUnavailableError, archiveAiConversation, loadAiConversation } from "@/lib/revenue-os/ai-conversations";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await context.params;
    return NextResponse.json(await loadAiConversation(createServiceRoleClient(), auth.user.email || "founder", id));
  } catch (error) {
    const status = error instanceof AiConversationSchemaUnavailableError ? 503 : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load AI conversation" }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await context.params;
    await archiveAiConversation(createServiceRoleClient(), auth.user.email || "founder", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof AiConversationSchemaUnavailableError ? 503 : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not archive AI conversation" }, { status });
  }
}
