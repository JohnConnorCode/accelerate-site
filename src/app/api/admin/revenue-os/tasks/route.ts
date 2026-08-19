import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { completeOperatorTask, snoozeOperatorTask } from "@/lib/revenue-os/tasks";

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { id?: string; action?: "complete" | "snooze"; until?: string };
  if (!body.id || !body.action) return NextResponse.json({ error: "Task ID and action are required" }, { status: 400 });

  try {
    const supabase = createServiceRoleClient();
    const actorEmail = auth.user.email || "founder";
    const task = body.action === "complete"
      ? await completeOperatorTask(supabase, { id: body.id, actorEmail })
      : body.action === "snooze" && body.until
        ? await snoozeOperatorTask(supabase, { id: body.id, until: body.until, actorEmail })
        : null;
    if (!task) return NextResponse.json({ error: "A snooze date is required" }, { status: 400 });
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update task" }, { status: 400 });
  }
}
