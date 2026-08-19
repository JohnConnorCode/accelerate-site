import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const id = searchParams.get("id");

  // Single client fetch
  if (id) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
    const linked = await attachRevenueLinkage(supabase, data ? [data] : [], {
      sourceRecordType: "client",
      emailField: "contact_email",
    });
    return NextResponse.json({
      client: linked.records[0] ?? data,
      canonicalSchemaReady: linked.schemaReady,
    });
  }

  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `business_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  // Calculate MRR total
  const activeClients = (data || []).filter((c: { status?: string }) => c.status === "active");
  const totalMRR = activeClients.reduce((sum: number, c: { monthly_value?: number }) => sum + (c.monthly_value || 0), 0);

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "client",
    emailField: "contact_email",
  });

  return NextResponse.json({
    clients: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    totalMRR,
    activeCount: activeClients.length,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  const {
    lead_id,
    business_name,
    contact_name,
    contact_email,
    contact_phone,
    industry,
    monthly_value,
    one_time_value,
    contract_start,
    contract_end,
    services,
    notes,
  } = body;

  if (!business_name || !contact_name || !contact_email) {
    return NextResponse.json(
      { error: "Business name, contact name, and email are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      lead_id: lead_id || null,
      business_name,
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
      industry: industry || null,
      monthly_value: monthly_value || 0,
      one_time_value: one_time_value || 0,
      contract_start: contract_start || null,
      contract_end: contract_end || null,
      services: services || [],
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ client: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Client id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    "status", "business_name", "contact_name", "contact_email", "contact_phone",
    "industry", "monthly_value", "one_time_value", "contract_start", "contract_end",
    "services", "onboarding_checklist", "notes",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ client: data });
}
