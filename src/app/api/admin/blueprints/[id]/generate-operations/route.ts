import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { generateWorkspaceOperations } from "@/lib/revenue-os/workspace-architect-generated-operations";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compose boards, views, navigation, workflow proposals and Coworker
 * recommendations from an approved/applied Workspace Blueprint. Reuses the
 * existing Kanban column primitive and the existing action-queue approval
 * path (`proposeAction`) — this route never writes lifecycle state itself
 * and never auto-applies from chat; workflow/Coworker proposals still need
 * their own approval through the normal action-queue surface.
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
  } catch (error) {
    console.warn("Blueprint generate-operations received invalid JSON", error);
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  if (typeof body.version !== "number" || typeof body.requestKey !== "string") {
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
    const message = error instanceof Error ? error.message : "Could not generate operations";
    console.warn("Blueprint generate-operations failed:", message);
    const status = /not found/i.test(message) ? 404 : /approved or applied/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
