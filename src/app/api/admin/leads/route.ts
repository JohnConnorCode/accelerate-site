import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") || "desc";

  let query = supabase
    .from("solution_requests")
    .select("*", { count: "exact" })
    .order(sort, { ascending: order === "asc" });

  if (status && status !== "all") {
    query = query.eq("lead_status", status);
  }
  if (industry && industry !== "all") {
    query = query.eq("industry", industry);
  }

  // Pagination
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leads: data,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  // Support bulk updates
  if (Array.isArray(body.ids) && body.lead_status) {
    const updateData: Record<string, unknown> = { lead_status: body.lead_status };
    if (body.lead_status === "contacted") updateData.contacted_at = new Date().toISOString();

    const { error } = await supabase
      .from("solution_requests")
      .update(updateData)
      .in("id", body.ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, updated: body.ids.length });
  }

  // Single update
  const { id, lead_status, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (lead_status) updateData.lead_status = lead_status;
  if (notes !== undefined) updateData.notes = notes;
  if (lead_status === "contacted") updateData.contacted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("solution_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
