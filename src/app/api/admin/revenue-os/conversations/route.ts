import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  assignConversation,
  listConversations,
  getConversationDetail,
  updateConversationStatus,
  linkConversationRecord,
  type ConversationFilter,
  type ConversationStatus,
  type ConversationChannel,
} from "@/lib/revenue-os/conversations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const supabase = auth.database;

  const assigneeParam = params.get("assignee") || undefined;
  const filter: ConversationFilter = {
    status: (params.get("status") as ConversationStatus | "all") || "all",
    channel: (params.get("channel") as ConversationChannel | "all") || "all",
    intent: params.get("intent") || undefined,
    record: (params.get("record") as "all" | "linked" | "unlinked") || "all",
    campaign: (params.get("campaign") as "all" | "linked" | "unlinked") || "all",
    unreadOnly: params.get("unread") === "1" || params.get("unread") === "true",
    followUp: params.get("followUp") === "1" || params.get("followUp") === "true",
    // "me" resolves server-side so the client never has to know (or spoof)
    // the operator's address; "unassigned" matches threads with no assignee.
    assignee:
      assigneeParam === "me" ? auth.user.email || undefined : assigneeParam,
    search: params.get("search") || undefined,
  };

  try {
    const listResult = await listConversations(supabase, filter);

    let detail = null;
    let messages: unknown[] = [];

    if (id) {
      detail = await getConversationDetail(supabase, id);
      messages = detail?.messages ?? [];
    }

    return NextResponse.json({
      schemaReady: listResult.schemaReady,
      conversations: listResult.conversations,
      stats: listResult.stats,
      intents: listResult.intents,
      detail,
      messages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load conversations" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    id?: string;
    status?: ConversationStatus;
    intent?: string;
    opportunityId?: string | null;
    contactId?: string | null;
    companyId?: string | null;
    assigneeEmail?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Conversation id is required" }, { status: 400 });
  }

  const supabase = auth.database;
  const actorEmail = auth.user.email || "founder@revenue-os.local";

  try {
    if (body.status) {
      const updated = await updateConversationStatus(supabase, {
        id: body.id,
        status: body.status,
        actorEmail,
      });
      return NextResponse.json({ conversation: updated });
    }

    if (
      body.opportunityId !== undefined ||
      body.contactId !== undefined ||
      body.companyId !== undefined
    ) {
      const updated = await linkConversationRecord(supabase, {
        conversationId: body.id,
        opportunityId: body.opportunityId,
        contactId: body.contactId,
        companyId: body.companyId,
        actorEmail,
      });
      return NextResponse.json({ conversation: updated });
    }

    if (body.assigneeEmail !== undefined) {
      // "me" resolves to the authenticated operator so the client never has
      // to know (or spoof) its own address on the write path either.
      const assignee =
        body.assigneeEmail === "me" ? (auth.user.email ?? null) : body.assigneeEmail;
      if (body.assigneeEmail === "me" && !assignee)
        return NextResponse.json({ error: "Could not identify the operator" }, { status: 400 });
      const updated = await assignConversation(supabase, {
        id: body.id,
        assigneeEmail: assignee,
        actorEmail,
      });
      return NextResponse.json({ conversation: updated });
    }

    return NextResponse.json({ error: "No valid updates supplied" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
