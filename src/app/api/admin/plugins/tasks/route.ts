import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
const workflowIds = ["client-onboarding", "meeting-commitments"];
export async function GET(request: Request) {
  const pluginId = new URL(request.url).searchParams.get("pluginId") || "";
  if (!workflowIds.includes(pluginId))
    return NextResponse.json({ error: "Unknown task workflow" }, { status: 400 });
  const auth = await requireAdminForModule(pluginId);
  if (auth instanceof NextResponse) return auth;
  try {
    const onboarding = pluginId === "client-onboarding";
    const source = onboarding
      ? auth.database
          .from("opportunities")
          .select("id,name")
          .eq("stage", "won")
          .order("updated_at", { ascending: false })
          .limit(100)
      : auth.database
          .from("calendar_events")
          .select("id,title,start_at")
          .neq("status", "cancelled")
          .order("start_at", { ascending: false })
          .limit(100);
    const [records, members, actions] = await Promise.all([
      source,
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
    if (records.error || members.error || actions.error)
      throw new Error("Workflow workspace could not be read");
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
      records: records.data,
      members: members.data,
      actions: actions.data,
      currentUserId: auth.user.id,
      truncated: records.data.length === 100 || members.data.length === 100,
    });
  } catch {
    console.error("[task-workflow] Read failed");
    return NextResponse.json({ error: "Workflow workspace is unavailable" }, { status: 503 });
  }
}
