import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendGmailReply } from "@/lib/revenue-os/google";
import { proposeAction } from "@/lib/revenue-os/actions";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { conversationId?: string; body?: string; confirmed?: boolean };
  if (!body.conversationId || !body.body?.trim()) return NextResponse.json({ error: "Conversation and reply body are required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  if (!body.confirmed) {
    const action = await proposeAction(supabase, {
      actionType: "send_gmail_reply",
      title: "Send Gmail reply",
      description: body.body.trim().slice(0, 180),
      urgency: "normal",
      payload: { conversationId: body.conversationId, body: body.body.trim() },
      sourceContext: "conversation_reply",
      entityType: "conversation",
      entityId: body.conversationId,
      dedupeKey: `gmail-reply:${body.conversationId}:${Buffer.from(body.body.trim()).toString("base64url").slice(0, 32)}`,
      proposedBy: auth.user.email,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    return NextResponse.json({ confirmationRequired: true, action });
  }
  try {
    const result = await sendGmailReply(supabase, {
      conversationId: body.conversationId,
      body: body.body,
      actorEmail: auth.user.email || "founder",
      idempotencyKey: `gmail-reply:${body.conversationId}:${Buffer.from(body.body.trim()).toString("base64url").slice(0, 48)}`,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail reply failed" }, { status: 400 });
  }
}
