import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
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

  // Get stats
  const { data: allSeqs } = await supabase
    .from("email_sequences")
    .select("status");

  const stats = { active: 0, completed: 0, paused: 0, unsubscribed: 0, total: 0 };
  (allSeqs || []).forEach((s: { status: string }) => {
    stats.total++;
    if (s.status === "active") stats.active++;
    else if (s.status === "completed") stats.completed++;
    else if (s.status === "paused") stats.paused++;
    else if (s.status === "unsubscribed") stats.unsubscribed++;
  });

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

  const supabase = createServiceRoleClient();
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
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
