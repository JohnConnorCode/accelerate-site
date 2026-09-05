import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { attachRevenueLinkageWithTelemetry } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("website-grades");
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

  const linked = await attachRevenueLinkageWithTelemetry(
    supabase,
    data || [],
    {
      sourceRecordType: "website_grade",
    },
    { route: "admin-website-grades" },
  );

  return NextResponse.json({
    grades: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
