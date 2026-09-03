import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/revenue-os/audit";
import { isFeaturePriority } from "@/lib/feature-board";

/**
 * Columns are now admin-defined (`kanban_columns`, board_key='features',
 * tenant_id IS NULL) instead of the old static `FEATURE_STATUSES` array.
 * Queried once per write request.
 */
async function isValidFeatureColumn(supabase: SupabaseClient, value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !value) return false;
  const { data, error } = await supabase
    .from("kanban_columns")
    .select("column_key")
    .eq("board_key", "features")
    .is("tenant_id", null)
    .eq("column_key", value)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

const editableFields = [
  "title",
  "description",
  "status",
  "priority",
  "labels",
  "owner",
  "target_date",
  "acceptance_criteria",
  "notes",
] as const;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : null;
}

function cleanLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((label): label is string => typeof label === "string")
        .map((label) => label.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32))
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createPlatformServiceRoleClient("feature-board");
  const { data, error } = await supabase
    .from("feature_requests")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205")
      return NextResponse.json({ schemaReady: false, features: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schemaReady: true, features: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const title = cleanText(body.title, 180);
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const priority = isFeaturePriority(body.priority) ? body.priority : "medium";
  const supabase = createPlatformServiceRoleClient("feature-board");
  let status = "backlog";
  if (typeof body.status === "string" && body.status) {
    if (!(await isValidFeatureColumn(supabase, body.status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    status = body.status;
  }
  const { data: tail } = await supabase
    .from("feature_requests")
    .select("sort_order")
    .eq("status", status)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = {
    title,
    description: cleanText(body.description, 5000),
    status,
    priority,
    labels: cleanLabels(body.labels),
    sort_order: Number(tail?.sort_order || 0) + 1000,
    owner: cleanText(body.owner, 120),
    target_date: cleanText(body.target_date, 10),
    acceptance_criteria: cleanText(body.acceptance_criteria, 5000),
    notes: cleanText(body.notes, 5000),
  };
  const { data, error } = await supabase.from("feature_requests").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "feature.created",
    entityType: "feature_request",
    entityId: data.id,
    after: data,
  });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const supabase = createPlatformServiceRoleClient("feature-board");

  if (Array.isArray(body.reorder)) {
    if (!body.reorder.length || body.reorder.length > 250)
      return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
    const { data: validColumns, error: columnsError } = await supabase
      .from("kanban_columns")
      .select("column_key")
      .eq("board_key", "features")
      .is("tenant_id", null);
    if (columnsError) return NextResponse.json({ error: columnsError.message }, { status: 500 });
    const validColumnKeys = new Set((validColumns ?? []).map((row) => row.column_key as string));
    const updates = body.reorder.map((item: Record<string, unknown>) => ({
      id: typeof item.id === "string" ? item.id : "",
      column_key: typeof item.column_key === "string" ? item.column_key : "",
      sort_order: Number(item.sort_order),
    }));
    if (
      updates.some(
        (item: { id: string; column_key: string; sort_order: number }) =>
          !item.id || !validColumnKeys.has(item.column_key) || !Number.isFinite(item.sort_order),
      )
    ) {
      return NextResponse.json(
        { error: "Every reordered card needs a valid id, status, and order" },
        { status: 400 },
      );
    }
    const { data: affected, error } = await supabase.rpc("reorder_kanban_items", {
      p_board_key: "features",
      p_updates: updates,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (affected !== updates.length)
      return NextResponse.json(
        { error: "One or more cards could not be reordered. Refresh and try again." },
        { status: 409 },
      );
    await recordAudit(supabase, {
      actorEmail: auth.user.email,
      action: "feature.reordered",
      entityType: "feature_request",
      metadata: { updates },
    });
    return NextResponse.json({ success: true, affected });
  }

  if (typeof body.id !== "string")
    return NextResponse.json({ error: "Feature id is required" }, { status: 400 });
  const { data: before } = await supabase
    .from("feature_requests")
    .select("*")
    .eq("id", body.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  const update: Record<string, unknown> = {};
  for (const field of editableFields) {
    if (!(field in body)) continue;
    if (field === "title") update.title = cleanText(body.title, 180);
    else if (field === "status") update.status = body.status;
    else if (field === "priority") update.priority = body.priority;
    else if (field === "labels") update.labels = cleanLabels(body.labels);
    else if (field === "target_date") update.target_date = cleanText(body.target_date, 10);
    else update[field] = cleanText(body[field], 5000);
  }
  if ("title" in update && !update.title)
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  if ("status" in update && !(await isValidFeatureColumn(supabase, update.status)))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if ("priority" in update && !isFeaturePriority(update.priority))
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  if (!Object.keys(update).length)
    return NextResponse.json({ error: "No valid changes supplied" }, { status: 400 });
  const { data, error } = await supabase
    .from("feature_requests")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "feature.updated",
    entityType: "feature_request",
    entityId: body.id,
    before,
    after: data,
  });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Feature id is required" }, { status: 400 });
  const supabase = createPlatformServiceRoleClient("feature-board");
  const { data: before } = await supabase
    .from("feature_requests")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  const { error } = await supabase
    .from("feature_requests")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "feature.archived",
    entityType: "feature_request",
    entityId: id,
    before,
  });
  return NextResponse.json({ success: true });
}
