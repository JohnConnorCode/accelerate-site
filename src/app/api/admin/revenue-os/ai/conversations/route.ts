import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AiConversationSchemaUnavailableError,
  ensureAiConversation,
  listAiConversations,
  type AiConversationPurpose,
} from "@/lib/revenue-os/ai-conversations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") || 30);
    const purposeParam = request.nextUrl.searchParams.get("purpose");
    const purpose: AiConversationPurpose | undefined =
      purposeParam === "architect" || purposeParam === "command" ? purposeParam : undefined;
    const conversations = await listAiConversations(
      auth.database,
      auth.user.email || "founder",
      limit,
      purpose ? { purpose } : undefined,
    );
    return NextResponse.json({ schemaReady: true, conversations });
  } catch (error) {
    if (error instanceof AiConversationSchemaUnavailableError)
      return NextResponse.json(
        { schemaReady: false, conversations: [], error: error.message },
        { status: 503 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load AI conversations" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: { purpose?: unknown; title?: unknown } | null = null;
  try {
    body = (await request.json()) as { purpose?: unknown; title?: unknown };
  } catch (error) {
    console.warn("Architect conversation create received invalid JSON", error);
  }
  const purpose: AiConversationPurpose = body?.purpose === "architect" ? "architect" : "command";
  try {
    const conversation = await ensureAiConversation(auth.database, {
      actorEmail: auth.user.email || "founder",
      purpose,
      title: typeof body?.title === "string" ? body.title : undefined,
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    const status = error instanceof AiConversationSchemaUnavailableError ? 503 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open conversation" },
      { status },
    );
  }
}
