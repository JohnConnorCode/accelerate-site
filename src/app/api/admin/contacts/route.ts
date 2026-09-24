import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { attachRevenueLinkageWithTelemetry } from "@/lib/revenue-os/legacy-adapter";
import { retainedSourceDispositions } from "@/lib/revenue-os/retained-source-dispositions";
import { recordAudit } from "@/lib/revenue-os/audit";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { count } = await supabase
    .from("contact_submissions")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", auth.tenant.id);

  const { data, error } = await supabase
    .from("contact_submissions")
    .select("*")
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const linked = await attachRevenueLinkageWithTelemetry(
    supabase,
    data || [],
    {
      sourceRecordType: "contact_form",
    },
    { route: "admin-contacts" },
  );

  return NextResponse.json({
    contacts: linked.records,
    canonicalSchemaReady: linked.schemaReady,
    dispositions: retainedSourceDispositions("/admin/contacts")[0]?.fields ?? [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
  });
}

/** PATCH { id, read } — mark a single website request as read/unread. */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = z
    .object({ id: z.uuid(), read: z.boolean() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Choose a valid website request" }, { status: 400 });
  const supabase = auth.database;
  const { data, error } = await supabase
    .from("contact_submissions")
    .update({ read_at: body.data.read ? new Date().toISOString() : null })
    .eq("tenant_id", auth.tenant.id)
    .eq("id", body.data.id)
    .select("id,read_at")
    .maybeSingle();
  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Website request not found" }, { status: 404 });
  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "contact_submission.read_status_changed",
    entityType: "contact_submission",
    entityId: data.id,
    after: { read_at: data.read_at },
  });
  return NextResponse.json({ success: true, readAt: data.read_at });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = auth.database;
  const { error } = await supabase
    .from("contact_submissions")
    .delete()
    .eq("tenant_id", auth.tenant.id)
    .eq("id", id);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
