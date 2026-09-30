import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  attachRevenueLinkageWithTelemetry,
  leadPatchSchema,
  updateLegacyLead,
} from "@/lib/revenue-os/legacy-adapter";
import { retainedSourceDispositions } from "@/lib/revenue-os/retained-source-dispositions";
import { captureManualLead, manualLeadSchema } from "@/lib/revenue-os/inbound";
import { z } from "zod";

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
  const auth = await requireAdminForModule("leads-capture");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
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

  const linked = await attachRevenueLinkageWithTelemetry(
    supabase,
    data || [],
    {
      sourceRecordType: "solution_request",
      emailField: "contact_email",
    },
    { route: "admin-leads" },
  );

  return NextResponse.json({
    leads: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    dispositions: retainedSourceDispositions("/admin/leads")[0]?.fields ?? [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("leads-capture");
  if (auth instanceof NextResponse) return auth;
  const parsed = manualLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide a valid name, email and lead details" },
      { status: 400 },
    );
  try {
    const result = await captureManualLead(
      auth.database,
      parsed.data,
      auth.user.email || "founder",
    );
    return NextResponse.json(result, { status: result.status === "complete" ? 200 : 207 });
  } catch (error) {
    console.error("[admin-leads] capture failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save lead" },
      {
        status:
          error instanceof Error && error.message.includes("different lead details") ? 409 : 500,
      },
    );
  }
}

const bulkPatchSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_IDS),
    lead_status: z.string().min(1).max(64),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminForModule("leads-capture");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const parsed = z.union([bulkPatchSchema, leadPatchSchema]).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Provide valid lead IDs and changes" }, { status: 400 });
  const actorEmail = auth.user.email || "founder";
  if ("ids" in parsed.data) {
    const { ids, lead_status } = parsed.data;
    const outcomes = [];
    for (const id of new Set(ids))
      outcomes.push(await updateLegacyLead(auth.database, { id, lead_status }, actorEmail));
    const updated = outcomes.filter((outcome) => outcome.status === "complete").length;
    const partial = outcomes.filter((outcome) => outcome.status === "partial").length;
    const failed = outcomes.length - updated - partial;
    return NextResponse.json(
      { success: updated === outcomes.length, updated, partial, failed, outcomes },
      { status: updated === outcomes.length ? 200 : 207 },
    );
  }
  const result = await updateLegacyLead(auth.database, parsed.data, actorEmail);
  return NextResponse.json(result, { status: result.status === "complete" ? 200 : 207 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminForModule("leads-capture");
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  const ids = validateBulkIds(body.ids);
  if (!ids) {
    return NextResponse.json(
      { error: `ids must be a non-empty array of up to ${MAX_BULK_IDS} strings` },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("solution_requests").delete().in("id", ids);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
