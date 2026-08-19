import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { PIPELINE_STAGES } from "@/lib/admin/pipeline-stages";
import { attachRevenueLinkage } from "@/lib/revenue-os/legacy-adapter";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";
import { canonicalStage, transitionOpportunity } from "@/lib/revenue-os/pipeline";
import type { RevenueStage } from "@/lib/revenue-os/types";

// Statuses a lead can be set to: canonical pipeline stages plus "lost".
const VALID_LEAD_STATUSES = new Set<string>([
  ...PIPELINE_STAGES.map((s) => s.key),
  "lost",
]);
const MAX_BULK_IDS = 200;

/** Validate a bulk `ids` payload: must be a non-empty array of strings, capped. */
function validateBulkIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_IDS) {
    return null;
  }
  if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
    return null;
  }
  return ids as string[];
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));

  // Whitelist sortable columns to prevent invalid/unsafe order clauses
  const SORTABLE = new Set([
    "created_at",
    "contact_name",
    "contact_email",
    "lead_status",
    "industry",
    "estimated_value",
    "contacted_at",
  ]);
  const sortParam = searchParams.get("sort") || "created_at";
  const sort = SORTABLE.has(sortParam) ? sortParam : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

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
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkage(supabase, data || [], {
    sourceRecordType: "solution_request",
    emailField: "contact_email",
  });

  return NextResponse.json({
    leads: linked.records,
    canonicalSchemaReady: linked.schemaReady,
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
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  let canonicalLinked = false;
  try {
    await ingestInboundLead(supabase, {
      name: contact_name,
      email: contact_email,
      phone: contact_phone || null,
      companyName: business_name || null,
      industry: industry || "other",
      source: "solution_request",
      sourceRecordId: data.id,
      summary: notes || `Manual lead created by ${auth.user.email || "founder"}`,
    });
    canonicalLinked = true;
  } catch (canonicalError) {
    console.error("[admin-leads] canonical ingestion failed:", canonicalError);
  }

  return NextResponse.json({ lead: data, canonicalLinked });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  // Support bulk status updates: { ids: string[], lead_status: string }
  if (body.ids !== undefined && body.id === undefined) {
    const ids = validateBulkIds(body.ids);
    if (!ids) {
      return NextResponse.json(
        { error: `ids must be a non-empty array of up to ${MAX_BULK_IDS} strings` },
        { status: 400 },
      );
    }
    if (typeof body.lead_status !== "string" || !VALID_LEAD_STATUSES.has(body.lead_status)) {
      return NextResponse.json({ error: "Invalid lead_status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { lead_status: body.lead_status };
    if (body.lead_status === "contacted") updateData.contacted_at = new Date().toISOString();

    const { error } = await supabase
      .from("solution_requests")
      .update(updateData)
      .in("id", ids);

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, updated: ids.length });
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

  if (lead_status) {
    const target = canonicalStage(lead_status);
    const { data: linkedOpportunity, error: linkageError } = await supabase
      .from("opportunities")
      .select("id,stage")
      .eq("source_record_type", "solution_request")
      .eq("source_record_id", id)
      .maybeSingle();
    if (linkageError) {
      console.error("[admin-leads] canonical linkage failed:", linkageError.message);
    } else if (linkedOpportunity && target && canonicalStage(linkedOpportunity.stage) !== target) {
      try {
        await transitionOpportunity(supabase, {
          id: linkedOpportunity.id,
          to: target as RevenueStage,
          actorEmail: auth.user.email || "founder",
          source: "admin_leads",
          reason: "Updated from Leads compatibility workspace",
          lossReason: target === "lost" ? "Closed from Leads compatibility workspace" : undefined,
        });
      } catch (transitionError) {
        return NextResponse.json(
          { error: transitionError instanceof Error ? transitionError.message : "Could not update canonical pipeline" },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("solution_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
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

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  const ids = validateBulkIds(body.ids);
  if (!ids) {
    return NextResponse.json(
      { error: `ids must be a non-empty array of up to ${MAX_BULK_IDS} strings` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("solution_requests")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
