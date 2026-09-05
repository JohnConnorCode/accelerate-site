import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { prepareWorkflowPlugin, proposeWorkflowPlugin } from "@/lib/revenue-os/workflow-plugins";
const schema = z
  .object({
    pluginId: z.string().min(3).max(49),
    input: z.record(z.string(), z.json()),
    mode: z.enum(["preview", "propose"]),
    digest: z.string().length(64).optional(),
    requestId: z.uuid().optional(),
  })
  .strict();
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch {
    console.error("[plugin-workflow] Invalid request body");
    return NextResponse.json(
      { error: "Workflow request is invalid or too large" },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid workflow request" }, { status: 400 });
  const auth = await requireAdminForModule(parsed.data.pluginId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (parsed.data.mode === "preview")
      return NextResponse.json(
        await prepareWorkflowPlugin(auth.database, parsed.data.pluginId, parsed.data.input),
      );
    if (!parsed.data.digest || !parsed.data.requestId)
      return NextResponse.json({ error: "Prepare and review the workflow first" }, { status: 400 });
    return NextResponse.json({
      action: await proposeWorkflowPlugin(
        auth.database,
        parsed.data.pluginId,
        parsed.data.input,
        parsed.data.digest,
        parsed.data.requestId,
        auth.user.email || "workspace-member",
      ),
    });
  } catch (error) {
    console.error("[plugin-workflow] Request refused", { pluginId: parsed.data.pluginId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow could not be prepared" },
      { status: 422 },
    );
  }
}
