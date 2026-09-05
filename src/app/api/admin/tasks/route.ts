import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createRevenueTask, patchOperatorTask, deleteOperatorTask } from "@/lib/revenue-os/tasks";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
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
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  const {
    title,
    description,
    due_date,
    due_time,
    priority,
    related_type,
    related_id,
    related_name,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const result = await createRevenueTask(supabase, {
      title,
      description,
      dueDate: due_date,
      dueTime: due_time,
      priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
      relatedType: related_type,
      relatedId: related_id,
      relatedName: related_name,
      source: "manual",
      actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database operation failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const task = await patchOperatorTask(auth.database, {
      ...body,
      actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update task" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 });
  }

  try {
    await deleteOperatorTask(supabase, id, auth.user.email || "founder");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete task" },
      { status: 400 },
    );
  }
}
