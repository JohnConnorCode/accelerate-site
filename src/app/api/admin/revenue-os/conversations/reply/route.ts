import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { readGmailReplyTarget, sendGmailReply } from "@/lib/revenue-os/google";
import { proposeAction } from "@/lib/revenue-os/actions";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    conversationId?: string;
    body?: string;
    confirmed?: boolean;
  };
  if (!body.conversationId || !body.body?.trim())
    return NextResponse.json(
      { error: "Conversation and reply body are required" },
      { status: 400 },
    );
  const supabase = auth.database;
  const contentKey = createHash("sha256").update(body.body.trim()).digest("hex");
  if (!body.confirmed) {
    try {
      const replyTarget = await readGmailReplyTarget(supabase, body.conversationId);
      const action = await proposeAction(supabase, {
        actionType: "send_gmail_reply",
        title: "Send Gmail reply",
        description: body.body.trim().slice(0, 180),
        urgency: "normal",
        payload: { conversationId: body.conversationId, body: body.body.trim(), replyTarget },
        sourceContext: "conversation_reply",
        entityType: "conversation",
        entityId: body.conversationId,
        dedupeKey: `gmail-reply:${body.conversationId}:${replyTarget.latestMessageId}:${contentKey}`,
        proposedBy: auth.user.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return NextResponse.json({ confirmationRequired: true, action });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not prepare Gmail reply" },
        { status: 400 },
      );
    }
  }
  try {
    const replyTarget = await readGmailReplyTarget(supabase, body.conversationId);
    const result = await sendGmailReply(supabase, {
      conversationId: body.conversationId,
      body: body.body,
      actorEmail: auth.user.email || "founder",
      idempotencyKey: `gmail-reply:${body.conversationId}:${replyTarget.latestMessageId}:${contentKey}`,
      expectedTarget: replyTarget,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail reply failed" },
      { status: 400 },
    );
  }
}
