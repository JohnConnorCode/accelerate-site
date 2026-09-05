import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { attachRevenueLinkageWithTelemetry } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("resources");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count } = await supabase
    .from("resource_downloads")
    .select("*", { count: "exact", head: true });

  const { data: uniqueRows } = await supabase
    .from("resource_downloads")
    .select("email")
    .limit(10000);

  const { data, error } = await supabase
    .from("resource_downloads")
    .select("*")
    .order("downloaded_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkageWithTelemetry(
    supabase,
    data || [],
    {
      sourceRecordType: "resource_download",
    },
    { route: "admin-resources" },
  );

  return NextResponse.json({
    downloads: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
    stats: {
      totalDownloads: count || 0,
      uniqueUsers: new Set(
        (uniqueRows || []).map((row) => row.email?.trim().toLowerCase()).filter(Boolean),
      ).size,
    },
  });
}
