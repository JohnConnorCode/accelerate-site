import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listBlueprints, saveBlueprintVersion } from "@/lib/revenue-os/workspace-blueprint";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const blueprints = await listBlueprints(auth.database, auth.tenant.id);
    return NextResponse.json({ blueprints });
  } catch (error) {
    console.warn("Blueprint list failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}

function cleanSummary(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 2000) : "";
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn("Blueprint save received invalid JSON", error);
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  const changeSummary = cleanSummary(body.changeSummary);
  if (!changeSummary) {
    return NextResponse.json({ error: "changeSummary is required" }, { status: 400 });
  }
  if (body.document === undefined) {
    return NextResponse.json({ error: "document is required" }, { status: 400 });
  }
  const blueprintId =
    typeof body.blueprintId === "string" && body.blueprintId.trim()
      ? body.blueprintId.trim()
      : undefined;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : undefined;
  try {
    // Saving against an existing blueprintId always forks a new version;
    // reviewed versions are never mutated.
    const saved = await saveBlueprintVersion(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId,
      title,
      document: body.document,
      changeSummary,
      createdBy: auth.user.email ?? null,
      actorEmail: auth.user.email ?? null,
    });
    return NextResponse.json(
      { blueprintId: saved.blueprintId, version: saved.version.version },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("Blueprint save failed:", message);
    if (/not found in this workspace/i.test(message)) {
      return NextResponse.json({ error: "Blueprint not found in this workspace" }, { status: 404 });
    }
    if (
      /Invalid WorkspaceBlueprint|must be a UUID|changeSummary is required|must not contain secrets/i.test(
        message,
      )
    ) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
