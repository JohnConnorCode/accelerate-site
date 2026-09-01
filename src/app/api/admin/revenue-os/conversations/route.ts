import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const supabase = auth.database;
  let query = supabase
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (params.get("status")) query = query.eq("status", params.get("status")!);
  const conversations = await query;
  if (conversations.error) {
    if (isMissingRevenueSchema(conversations.error))
      return NextResponse.json({ schemaReady: false, conversations: [], messages: [] });
    return NextResponse.json({ error: "Could not load conversations" }, { status: 500 });
  }
  let messages: unknown[] = [];
  if (id) {
    const result = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (result.error)
      return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
    messages = result.data ?? [];
  }
  return NextResponse.json({
    schemaReady: true,
    conversations: conversations.data ?? [],
    messages,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    id?: string;
    status?: string;
    intent?: string;
    opportunityId?: string | null;
    contactId?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "Conversation id is required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (body.status && ["open", "waiting", "resolved", "archived"].includes(body.status))
    patch.status = body.status;
  if (typeof body.intent === "string") patch.intent = body.intent.trim().slice(0, 80);
  if (body.opportunityId !== undefined) patch.opportunity_id = body.opportunityId;
  if (body.contactId !== undefined) patch.contact_id = body.contactId;
  if (body.status === "resolved" || body.status === "archived") patch.unread_count = 0;
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "No valid updates supplied" }, { status: 400 });
  const { data, error } = await auth.database
    .from("conversations")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ conversation: data });
}
