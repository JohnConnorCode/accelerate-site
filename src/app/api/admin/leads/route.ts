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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
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
  if (dateFrom) {
    query = query.gte("created_at", new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt("created_at", endDate.toISOString());
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  const { contact_name, contact_email, contact_phone, business_name, industry, source, notes } = body;

  if (!contact_name || !contact_email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Generate a share token for the lead
  const { nanoid } = await import("nanoid");
  const shareToken = nanoid(12);

  const { data, error } = await supabase
    .from("solution_requests")
    .insert({
      share_token: shareToken,
      status: "completed",
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
      business_name: business_name || null,
      industry: industry || "other",
      lead_status: "new",
      notes: notes ? `[Source: ${source || "manual"}] ${notes}` : `[Source: ${source || "manual"}]`,
      intake_data: {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
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
  const { id, lead_status, notes, estimated_value } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (lead_status) updateData.lead_status = lead_status;
  if (notes !== undefined) updateData.notes = notes;
  if (estimated_value !== undefined) updateData.estimated_value = estimated_value;
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

  // Auto-create follow-up task when status → contacted
  if (lead_status === "contacted" && data) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 3);
    await supabase.from("tasks").insert({
      title: `Follow up with ${data.contact_name}`,
      description: `Auto-created: Lead was contacted. Follow up in 3 days.`,
      due_date: followUpDate.toISOString().split("T")[0],
      priority: "high",
      related_type: "lead",
      related_id: id,
      related_name: data.contact_name,
    });
  }

  // Auto-create client record when status → won
  if (lead_status === "won" && data) {
    // Check if client already exists for this lead
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("lead_id", id)
      .maybeSingle();

    if (!existingClient) {
      await supabase.from("clients").insert({
        lead_id: id,
        business_name: data.business_name || data.contact_name,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || null,
        industry: data.industry || null,
        monthly_value: data.estimated_value || 0,
        status: "onboarding",
        contract_start: new Date().toISOString().split("T")[0],
      });
    }
  }

  return NextResponse.json({ lead: data });
}
