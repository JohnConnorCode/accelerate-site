import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

const VALID_SEQUENCE_STATUSES = new Set(["active", "paused", "completed", "unsubscribed"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const from = (page - 1) * limit;

  let query = supabase
    .from("email_sequences")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (type && type !== "all") {
    query = query.eq("sequence_type", type);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  // Stats — five parallel COUNT queries instead of pulling every row.
  const [activeRes, completedRes, pausedRes, unsubRes, totalRes] = await Promise.all([
    supabase.from("email_sequences").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("email_sequences").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("email_sequences").select("id", { count: "exact", head: true }).eq("status", "paused"),
    supabase.from("email_sequences").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
    supabase.from("email_sequences").select("id", { count: "exact", head: true }),
  ]);
  const stats = {
    active: activeRes.count || 0,
    completed: completedRes.count || 0,
    paused: pausedRes.count || 0,
    unsubscribed: unsubRes.count || 0,
    total: totalRes.count || 0,
  };

  return NextResponse.json({
    sequences: data,
    stats,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  if (!VALID_SEQUENCE_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("email_sequences")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ sequence: data });
}
