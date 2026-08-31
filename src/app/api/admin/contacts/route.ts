import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count } = await supabase
    .from("contact_submissions")
    .select("*", { count: "exact", head: true });

  const { data, error } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  // Auto-mark fetched contacts as read (fire-and-forget).
  // The dashboard unread count queries read_at IS NULL, so this keeps it accurate.
  const unreadIds = (data || [])
    .filter((c: { id: string; read_at: string | null }) => !c.read_at)
    .map((c: { id: string }) => c.id);
  if (unreadIds.length > 0) {
    supabase
      .from("contact_submissions")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => {}, (err: unknown) => console.error("Failed to mark contacts read:", err));
  }

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "contact_form",
  });

  return NextResponse.json({
    contacts: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
  });
}

/** PATCH { id } — mark a single contact as read/unread */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, read } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = auth.database;
  const { error } = await supabase
    .from("contact_submissions")
    .update({ read_at: read === false ? null : new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = auth.database;
  const { error } = await supabase
    .from("contact_submissions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
