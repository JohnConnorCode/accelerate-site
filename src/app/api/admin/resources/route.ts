import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count } = await supabase
    .from("resource_downloads")
    .select("*", { count: "exact", head: true });

  // Count unique emails
  const { data: uniqueData } = await supabase
    .rpc("count_distinct_emails_resources")
    .single();

  const { data, error } = await supabase
    .from("resource_downloads")
    .select("*")
    .order("downloaded_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({
    downloads: data || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
    stats: {
      totalDownloads: count || 0,
      uniqueUsers: uniqueData?.count || 0,
    },
  });
}
