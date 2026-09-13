import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { executeTaskWrite } from "@/lib/revenue-os/action-executor";

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    id?: string;
    action?: "complete" | "snooze";
    until?: string;
  };
  if (!body.id || !body.action)
    return NextResponse.json({ error: "Task ID and action are required" }, { status: 400 });
  if (
    (body.action !== "complete" && body.action !== "snooze") ||
    (body.action === "snooze" && !body.until)
  )
    return NextResponse.json({ error: "A snooze date is required" }, { status: 400 });

  try {
    const supabase = auth.database;
    const actorEmail = auth.user.email || "founder";
    // Same unified path as the task workspace: complete and snooze run as
    // approved executor actions, never as direct row writes.
    const task = (await executeTaskWrite(
      supabase,
      body.action === "complete"
        ? { kind: "complete", taskId: body.id }
        : { kind: "snooze", taskId: body.id, until: body.until ?? "" },
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
