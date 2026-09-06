import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { runReportPlugin } from "@/lib/revenue-os/report-plugins";
import { MODULE_MAP } from "@/lib/revenue-os/modules";
const inputSchema = z.object({ pluginId: z.string().min(3).max(49) }).strict();
export async function POST(request: Request) {
  const input = inputSchema.safeParse(
    await request.json().catch(() => {
      console.error("[plugin-report] Invalid JSON request");
      return null;
    }),
  );
  if (!input.success)
    return NextResponse.json({ error: "Choose a report plugin" }, { status: 400 });
  const authorization = await requireAdminForModule(input.data.pluginId);
  if (authorization instanceof NextResponse) return authorization;
  if (!MODULE_MAP.get(input.data.pluginId)?.report)
    return NextResponse.json({ error: "Unknown report plugin" }, { status: 404 });
  try {
    return NextResponse.json(
      await runReportPlugin(
        authorization.database,
        input.data.pluginId,
        authorization.user.email || "workspace-member",
      ),
    );
  } catch {
    console.error("[plugin-report] Invocation failed", { pluginId: input.data.pluginId });
    return NextResponse.json(
      {
        error:
          "Report could not run. Check that this plugin is enabled and its workspace sources are registered. No result was published.",
      },
      { status: 422 },
    );
  }
}
