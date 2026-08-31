import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  const { data, error } = await supabase
    .from("content_calendar")
    .insert(body)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();
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
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("content_calendar")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
