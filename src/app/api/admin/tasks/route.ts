import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { executeTaskWrite } from "@/lib/revenue-os/action-executor";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const owner = searchParams.get("owner");
  const id = searchParams.get("id");
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

  if (id) query = query.eq("id", id);
  if (owner === "me") query = query.eq("assigned_to", auth.user.id);
  if (owner === "unassigned") query = query.is("assigned_to", null);

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

  return NextResponse.json({ tasks: data || [], viewerId: auth.user.id });
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
    // Operator saves traverse the unified executor: propose into action_queue
    // and execute approved, so UI writes carry the same claim, autonomy
    // re-check, audit, idempotency and reversibility stamp as programmatic
    // writes. The executor returns the underlying service result unchanged.
    const result = (await executeTaskWrite(
      supabase,
      {
        kind: "create",
        title,
        description,
        dueDate: due_date,
        dueTime: due_time,
        priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
        relatedType: related_type,
        relatedId: related_id,
        relatedName: related_name,
      },
      auth.user.email || "founder",
    )) as { task: unknown; deduplicated: boolean };
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
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      description?: string | null;
      priority?: "high" | "medium" | "low";
      due_date?: string | null;
      status?: string;
      snoozed_until?: string | null;
    };
    if (!body.id) return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    const actorEmail = auth.user.email || "founder";
    // Same unified path as POST: the body selects the task operation, the
    // executor performs it. Covers every shape the UI sends today: field
    // edits (title/priority/due date/description), completion, snooze and
    // reopen. Unknown status values fail closed like any unregistered write.
    const task = (await executeTaskWrite(
      auth.database,
      body.status === "completed"
        ? { kind: "complete", taskId: body.id }
        : body.status === "pending"
          ? { kind: "reopen", taskId: body.id }
          : body.status === "snoozed" || body.snoozed_until
            ? { kind: "snooze", taskId: body.id, until: body.snoozed_until ?? "" }
            : {
                kind: "edit",
                taskId: body.id,
                ...(body.title !== undefined ? { title: body.title } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.priority !== undefined ? { priority: body.priority } : {}),
                ...(body.due_date !== undefined ? { dueDate: body.due_date } : {}),
              },
      actorEmail,
    )) as unknown;
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
    await executeTaskWrite(supabase, { kind: "delete", taskId: id }, auth.user.email || "founder");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete task" },
      { status: 400 },
    );
  }
}
