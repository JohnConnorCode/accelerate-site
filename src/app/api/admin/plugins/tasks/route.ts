import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { workflowTaskSources } from "@/lib/revenue-os/workflow-tasks";
import { z } from "zod";
const workflowIds = ["client-onboarding", "meeting-commitments"];
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pluginId = params.get("pluginId") || "";
  if (!workflowIds.includes(pluginId))
    return NextResponse.json({ error: "Unknown task workflow" }, { status: 400 });
  const auth = await requireAdminForModule(pluginId);
  if (auth instanceof NextResponse) return auth;
  const sourceId = params.get("sourceId") || undefined;
  if (sourceId && !z.uuid().safeParse(sourceId).success)
    return NextResponse.json(
      { error: "The linked source is invalid. Choose another record." },
      { status: 400 },
    );
  try {
    const [records, members, actions] = await Promise.all([
      workflowTaskSources(auth.database, pluginId, sourceId),
      auth.database
        .from("tenant_memberships")
        .select("user_id,invited_email")
        .eq("status", "active")
        .limit(100),
      auth.database
        .from("action_queue")
        .select("id,title,description,status,result,error,payload")
        .eq("action_type", "create_task_batch")
        .eq("source_context", "plugin")
        .contains("payload", { pluginOrigin: { id: pluginId } })
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (members.error || actions.error) throw new Error("Workflow workspace could not be read");
    const taskIds = [
      ...new Set(
        actions.data.flatMap((action) =>
          Array.isArray(action.result?.tasks)
            ? action.result.tasks.map((task: { id: string }) => task.id)
            : [],
        ),
      ),
    ] as string[];
    const liveTasks = taskIds.length
      ? await auth.database.from("tasks").select("id,status").in("id", taskIds).limit(300)
      : { data: [], error: null };
    if (liveTasks.error) throw new Error("Workflow task status is unavailable");
    return NextResponse.json({
      taskStates: Object.fromEntries((liveTasks.data || []).map((task) => [task.id, task.status])),
      records: records.records,
      members: members.data,
      actions: actions.data,
      currentUserId: auth.user.id,
      truncated: records.truncated || members.data.length === 100,
    });
  } catch {
    console.error("[task-workflow] Read failed");
    return NextResponse.json({ error: "Workflow workspace is unavailable" }, { status: 503 });
  }
}
