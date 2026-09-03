import { NextRequest, NextResponse } from "next/server";
import { resolveKanbanBoardAuth } from "@/lib/kanban/auth";
import { isKanbanBoardKey, type KanbanColumnMetadata } from "@/lib/kanban/types";

type RouteContext = { params: Promise<{ columnKey: string }> };

function cleanMetadata(value: unknown): KanbanColumnMetadata | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as KanbanColumnMetadata;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { columnKey } = await params;
  const boardKeyParam = new URL(request.url).searchParams.get("board_key");
  if (!isKanbanBoardKey(boardKeyParam)) {
    return NextResponse.json({ error: "A valid board_key is required" }, { status: 400 });
  }
  const auth = await resolveKanbanBoardAuth(boardKeyParam);
  if (!auth.ok) return auth.response;
  const { supabase, tenantId } = auth;

  // Rename touches the label only; column_key is the stable identity and is
  // never accepted here, in the request body or otherwise.
  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") {
    const label = body.label.trim().slice(0, 60);
    if (!label) return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    update.label = label;
  }
  if ("color" in body) {
    update.color = typeof body.color === "string" ? body.color : null;
  }
  const metadata = cleanMetadata(body.metadata);
  if (metadata !== undefined) update.metadata = metadata;
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "No valid changes supplied" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const query = supabase
    .from("kanban_columns")
    .update(update)
    .eq("board_key", boardKeyParam)
    .eq("column_key", columnKey);
  const scoped = tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
  const { data, error } = await scoped.select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Column not found" }, { status: 404 });
  return NextResponse.json(data);
}

const HAS_CARDS_PATTERN = /^column_has_cards:(\d+)$/;
const LAST_ROLE_PATTERN = /^cannot_delete_last_role:(\w+)$/;

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { columnKey } = await params;
  const url = new URL(request.url);
  const boardKeyParam = url.searchParams.get("board_key");
  const reassignTo = url.searchParams.get("reassign_to") || null;
  if (!isKanbanBoardKey(boardKeyParam)) {
    return NextResponse.json({ error: "A valid board_key is required" }, { status: 400 });
  }
  const auth = await resolveKanbanBoardAuth(boardKeyParam);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { error } = await supabase.rpc("kanban_delete_column", {
    p_board_key: boardKeyParam,
    p_column_key: columnKey,
    p_reassign_to: reassignTo,
  });
  if (error) {
    const cardsMatch = HAS_CARDS_PATTERN.exec(error.message);
    if (cardsMatch) {
      return NextResponse.json(
        { error: "column_has_cards", cardCount: Number(cardsMatch[1]) },
        { status: 409 },
      );
    }
    const roleMatch = LAST_ROLE_PATTERN.exec(error.message);
    if (roleMatch) {
      return NextResponse.json(
        { error: "cannot_delete_last_role", role: roleMatch[1] },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
