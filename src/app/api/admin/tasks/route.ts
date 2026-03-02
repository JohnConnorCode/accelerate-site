import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const relatedType = searchParams.get("related_type");
  const relatedId = searchParams.get("related_id");
  const includeOverdue = searchParams.get("include_overdue");

  let query = supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (date) {
    query = query.eq("due_date", date);
  }

  if (relatedType && relatedId) {
    query = query.eq("related_type", relatedType).eq("related_id", relatedId);
  }

  if (includeOverdue === "true") {
    const today = new Date().toISOString().split("T")[0]!;
    query = query.eq("status", "pending").lte("due_date", today);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  const { title, description, due_date, due_time, priority, related_type, related_id, related_name } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || null,
      due_date: due_date || null,
      due_time: due_time || null,
      priority: priority || "medium",
      related_type: related_type || null,
      related_id: related_id || null,
      related_name: related_name || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();
  const { id, status, snoozed_until, title, description, due_date, priority } = body;

  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
  }
  if (snoozed_until) {
    updateData.snoozed_until = snoozed_until;
    updateData.status = "snoozed";
  }
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (priority !== undefined) updateData.priority = priority;

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
