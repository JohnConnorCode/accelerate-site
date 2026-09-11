import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { approveBlueprint } from "@/lib/revenue-os/workspace-blueprint-compiler";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!UUID_PATTERN.test((id ?? "").trim())) {
    return NextResponse.json({ error: "A valid blueprint id is required" }, { status: 400 });
  }
  let body: { version?: unknown } = {};
  try {
    body = (await request.json()) as { version?: unknown };
  } catch (error) {
    console.warn("Blueprint approve received invalid JSON", error);
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  if (typeof body.version !== "number") {
    return NextResponse.json({ error: "version is required" }, { status: 400 });
  }
  try {
    const result = await approveBlueprint(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
      version: body.version,
      actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve Blueprint";
    console.warn("Blueprint approve failed:", message);
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
