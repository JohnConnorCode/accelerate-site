import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  generateWorkspaceOperations,
  WorkspaceOperationsError,
} from "@/lib/revenue-os/workspace-architect-generated-operations";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compose boards, views, navigation, and capability-cited workflow/Coworker
 * recommendations from an approved/applied Workspace Blueprint. Reuses the
 * existing Kanban column primitive. This route never writes lifecycle state,
 * never auto-applies from chat, and never enqueues action types the executor
 * cannot run.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!UUID_PATTERN.test((id ?? "").trim())) {
    return NextResponse.json({ error: "A valid blueprint id is required" }, { status: 400 });
  }
  let body: { version?: unknown; requestKey?: unknown } = {};
  try {
    body = (await request.json()) as { version?: unknown; requestKey?: unknown };
  } catch {
    console.warn("Blueprint generate-operations received invalid JSON");
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.version !== "number" ||
    typeof body.requestKey !== "string"
  ) {
    return NextResponse.json({ error: "version and requestKey are required" }, { status: 400 });
  }
  try {
    const result = await generateWorkspaceOperations(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
      version: body.version,
      requestKey: body.requestKey,
      actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof WorkspaceOperationsError
        ? error.message
        : "Operating setup could not be saved. Reload the Blueprint and try again.";
    console.warn(
      "Blueprint generate-operations failed:",
      error instanceof WorkspaceOperationsError ? error.code : "generation_failed",
    );
    if (error instanceof WorkspaceOperationsError) {
      return NextResponse.json(
        { error: message, code: error.code },
        {
          status:
            error.code === "generation_forbidden"
              ? 403
              : error.code === "generation_save_failed"
                ? 503
                : 409,
        },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
