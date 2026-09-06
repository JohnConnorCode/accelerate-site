import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";

export async function GET() {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;

  const { data, error } = await supabase
    .from("content_calendar")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  const { data, error } = await supabase.from("content_calendar").insert(body).select().single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  if (Array.isArray(body.reorder)) {
    if (!body.reorder.length || body.reorder.length > 250) {
      return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
    }
    const { data: validColumns, error: columnsError } = await supabase
      .from("kanban_columns")
      .select("column_key")
      .eq("board_key", "content")
      .eq("tenant_id", auth.tenant.id);
    if (columnsError) {
      return NextResponse.json({ error: columnsError.message }, { status: 500 });
    }
    const validColumnKeys = new Set((validColumns ?? []).map((row) => row.column_key as string));
    const updates = body.reorder.map((item: Record<string, unknown>) => ({
      id: typeof item.id === "string" ? item.id : "",
      column_key: typeof item.column_key === "string" ? item.column_key : "",
      sort_order: Number(item.sort_order),
    }));
    if (
      updates.some(
        (item: { id: string; column_key: string; sort_order: number }) =>
          !item.id || !validColumnKeys.has(item.column_key) || !Number.isFinite(item.sort_order),
      )
    ) {
      return NextResponse.json(
        { error: "Every reordered card needs a valid id, status, and order" },
        { status: 400 },
      );
    }
    const { data: affected, error } = await supabase.rpc("reorder_kanban_items", {
      p_board_key: "content",
      p_updates: updates,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (affected !== updates.length) {
      return NextResponse.json(
        { error: "One or more items could not be reordered. Refresh and try again." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, affected });
  }

  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("content_calendar")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  const { error } = await supabase.from("content_calendar").delete().eq("id", id);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
