import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AiConversationSchemaUnavailableError, listAiConversations } from "@/lib/revenue-os/ai-conversations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") || 30);
    const conversations = await listAiConversations(createServiceRoleClient(), auth.user.email || "founder", limit);
    return NextResponse.json({ schemaReady: true, conversations });
  } catch (error) {
    if (error instanceof AiConversationSchemaUnavailableError) return NextResponse.json({ schemaReady: false, conversations: [], error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load AI conversations" }, { status: 500 });
  }
}

