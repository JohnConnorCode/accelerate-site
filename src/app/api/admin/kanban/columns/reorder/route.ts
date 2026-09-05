import { NextRequest, NextResponse } from "next/server";
import { resolveKanbanBoardAuth } from "@/lib/kanban/auth";
import { isKanbanBoardKey } from "@/lib/kanban/types";

/**
 * Column-header reordering only (distinct from card reordering, which goes
 * through the `reorder_kanban_items` RPC against the board's item table).
 * This only ever touches kanban_columns itself, so no RPC is needed.
 */
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const boardKeyParam = body.board_key;
  if (!isKanbanBoardKey(boardKeyParam)) {
    return NextResponse.json({ error: "A valid board_key is required" }, { status: 400 });
  }
  const rawOrder = Array.isArray(body.order) ? body.order : [];
  const order = rawOrder.filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!order.length || order.length !== rawOrder.length) {
    return NextResponse.json({ error: "A valid column order is required" }, { status: 400 });
  }

  const auth = await resolveKanbanBoardAuth(boardKeyParam);
  if (!auth.ok) return auth.response;
  const { supabase, tenantId } = auth;

  const scopedSelect = () => {
    const query = supabase
      .from("kanban_columns")
      .select("column_key")
      .eq("board_key", boardKeyParam);
    return tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
  };
  const { data: existing, error: existingError } = await scopedSelect();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const existingKeys = new Set((existing ?? []).map((row) => row.column_key as string));
  if (order.some((key) => !existingKeys.has(key))) {
    return NextResponse.json({ error: "Unknown column in the requested order" }, { status: 400 });
  }

  for (const [index, columnKey] of order.entries()) {
    const query = supabase
      .from("kanban_columns")
      .update({ sort_order: (index + 1) * 1000, updated_at: new Date().toISOString() })
      .eq("board_key", boardKeyParam)
      .eq("column_key", columnKey);
    const scoped = tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
    const { error } = await scoped;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
