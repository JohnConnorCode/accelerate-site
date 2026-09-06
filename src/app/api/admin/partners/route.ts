import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { attachRevenueLinkageWithTelemetry } from "@/lib/revenue-os/legacy-adapter";

const VALID_PARTNER_STATUSES = new Set(["pending", "approved", "rejected", "active", "inactive"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("partners");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
  const status = searchParams.get("status");
  const from = (page - 1) * limit;

  let query = supabase
    .from("partner_applications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkageWithTelemetry(
    supabase,
    data || [],
    {
      sourceRecordType: "partner_application",
    },
    { route: "admin-partners" },
  );

  return NextResponse.json({
    partners: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminForModule("partners");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  if (!VALID_PARTNER_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("partner_applications")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ partner: data });
}
