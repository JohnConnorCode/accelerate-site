import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count } = await supabase
    .from("resource_downloads")
    .select("*", { count: "exact", head: true });

  // Count unique emails via RPC
  const { data: uniqueData } = await supabase
    .rpc("count_distinct_emails_resources")
    .single<{ count: number }>();

  const { data, error } = await supabase
    .from("resource_downloads")
    .select("*")
    .order("downloaded_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "resource_download",
  });

  return NextResponse.json({
    downloads: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
    stats: {
      totalDownloads: count || 0,
      uniqueUsers: uniqueData?.count || 0,
    },
  });
}
