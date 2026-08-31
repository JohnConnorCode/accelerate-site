import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
  const search = (searchParams.get("q") || "")
    .trim()
    .slice(0, 100)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ");
  const from = (page - 1) * limit;

  let query = supabase
    .from("chat_leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "chat",
  });

  return NextResponse.json({
    leads: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    query: search,
  });
}
