import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { attachRevenueLinkageWithTelemetry } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("subscribers");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count: totalCount } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .is("unsubscribed_at", null);

  const { count: unsubCount } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .not("unsubscribed_at", "is", null);

  const { data, error } = await supabase
    .from("subscribers")
    .select("*")
    .order("subscribed_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkageWithTelemetry(supabase, data || [], {
    sourceRecordType: "subscriber",
  }, { route: "admin-subscribers" });

  return NextResponse.json({
    subscribers: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: totalCount || 0,
    totalPages: Math.ceil((totalCount || 0) / pageSize),
    page,
    stats: {
      total: totalCount || 0,
      active: activeCount || 0,
      unsubscribed: unsubCount || 0,
    },
  });
}
