import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/revenue-os/audit";

const inputSchema = z
  .object({
    taskId: z.uuid(),
    rating: z.enum(["helpful", "not_helpful"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

async function readRequestBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    console.error("[task-feedback] Invalid JSON request");
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const parsed = inputSchema.safeParse(await readRequestBody(request));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose a rating and a valid task" }, { status: 400 });
  const { taskId, rating, note } = parsed.data;
  const { data: task, error } = await auth.database
    .from("tasks")
    .select("id,title,source,status")
    .eq("tenant_id", auth.tenant.id)
    .eq("id", taskId)
    .maybeSingle();
  if (error || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  await recordAudit(auth.database, {
    actorEmail: auth.user.email,
    action: "task.feedback_recorded",
    entityType: "task",
    entityId: taskId,
    metadata: { rating, note: note || null, taskSource: task.source, taskStatus: task.status },
  });
  return NextResponse.json({ success: true });
}
