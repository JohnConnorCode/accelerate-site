import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const from = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("website_grades")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "website_grade",
  });

  return NextResponse.json({
    grades: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
