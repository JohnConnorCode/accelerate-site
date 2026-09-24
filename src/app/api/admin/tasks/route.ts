import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  const source = searchParams.get("source")?.trim().slice(0, 100) ?? "";
  const search = searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const priority = searchParams.get("priority") || "all";
  const due = searchParams.get("due") || "any";
  const sortBy = searchParams.get("sortBy") || "due_date";
  const sortDirection = searchParams.get("sortDirection") || "asc";
  const includeOverdue = searchParams.get("include_overdue");
  const filters = z
    .object({
      status: z.enum(["pending", "snoozed", "completed", "all"]).nullable(),
      owner: z.enum(["team", "me", "unassigned"]).nullable(),
      source: z.string().max(100),
      q: z.string().max(100),
      priority: z.enum(["all", "high", "medium", "low"]),
      due: z.enum(["any", "overdue", "today", "upcoming", "unscheduled"]),
      sortBy: z.enum(["due_date", "created_at"]),
      sortDirection: z.enum(["asc", "desc"]),
      relatedType: z
        .string()
        .max(60)
        .regex(/^[a-z_]+$/)
        .or(z.literal(""))
        .transform((value) => value || null)
        .nullable(),
    })
    .safeParse({
      status,
      owner,
      source,
      q: search,
      priority,
      due,
      sortBy,
      sortDirection,
      relatedType,
    });
  if (!filters.success)
    return NextResponse.json({ error: "Check the task filters" }, { status: 400 });
  const {
    status: taskStatus,
    owner: taskOwner,
    source: taskSource,
    q: taskSearch,
    priority: taskPriority,
    due: taskDue,
    sortBy: taskSortBy,
    sortDirection: taskSortDirection,
    relatedType: taskRelatedType,
  } = filters.data;
  const page = Math.max(1, Math.min(10000, Number(searchParams.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize")) || 100));

  let query = supabase.from("tasks").select("*", { count: "exact" });

  if (taskSortBy === "due_date")
    query = query
      .order("due_date", { ascending: taskSortDirection === "asc", nullsFirst: false })
      .order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: taskSortDirection === "asc" });

  if (taskStatus && taskStatus !== "all") {
    query = query.eq("status", taskStatus);
  }

  if (id) query = query.eq("id", id);
  if (taskOwner === "me") query = query.eq("assigned_to", auth.user.id);
  if (taskOwner === "unassigned") query = query.is("assigned_to", null);
  if (taskSource) query = query.eq("source", taskSource);
  if (taskPriority !== "all") query = query.eq("priority", taskPriority);
  if (taskRelatedType && !relatedId) query = query.eq("related_type", taskRelatedType);
  const today = new Date().toISOString().split("T")[0]!;
  if (taskDue === "overdue") query = query.eq("status", "pending").lt("due_date", today);
  if (taskDue === "today") query = query.eq("due_date", today);
  if (taskDue === "upcoming") query = query.gt("due_date", today);
  if (taskDue === "unscheduled") query = query.is("due_date", null);
  if (taskSearch) {
    const escaped = taskSearch.replace(/[%,()\\]/g, "");
    if (escaped) query = query.or(`title.ilike.%${escaped}%,related_name.ilike.%${escaped}%`);
  }

  if (date) {
    query = query.eq("due_date", date);
  }

  if (taskRelatedType && relatedId) {
    query = query.eq("related_type", taskRelatedType).eq("related_id", relatedId);
  }

  if (includeOverdue === "true") {
    const today = new Date().toISOString().split("T")[0]!;
    query = query.eq("status", "pending").lte("due_date", today);
  }

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  return NextResponse.json({
    tasks: data || [],
    total: count ?? 0,
    viewerId: auth.user.id,
    tenantId: auth.tenant.id,
  });
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
    if (body.status !== undefined && !["completed", "pending", "snoozed"].includes(body.status))
      return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
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
