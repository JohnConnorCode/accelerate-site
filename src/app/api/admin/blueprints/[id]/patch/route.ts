import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { applyConversationalPatch } from "@/lib/revenue-os/architect-review-simulation";
import {
  getLatestBlueprintVersion,
  parseBlueprint,
  saveBlueprintVersion,
} from "@/lib/revenue-os/workspace-blueprint";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!UUID_PATTERN.test((id ?? "").trim())) {
    return NextResponse.json({ error: "A valid blueprint id is required" }, { status: 400 });
  }
  let body: { patch?: unknown; changeSummary?: unknown } = {};
  try {
    body = (await request.json()) as { patch?: unknown; changeSummary?: unknown };
  } catch (error) {
    console.warn("Blueprint patch received invalid JSON", error);
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) {
    return NextResponse.json({ error: "patch must be an object" }, { status: 400 });
  }
  if (typeof body.changeSummary !== "string" || !body.changeSummary.trim()) {
    return NextResponse.json({ error: "changeSummary is required" }, { status: 400 });
  }
  try {
    const current = await getLatestBlueprintVersion(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
    });
    const { next, diff } = applyConversationalPatch(
      parseBlueprint(current.document),
      body.patch as Record<string, unknown>,
    );
    const saved = await saveBlueprintVersion(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
      document: next,
      changeSummary: body.changeSummary.trim(),
      actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json({ version: saved.version.version, diff, applied: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not patch Blueprint";
    console.warn("Blueprint patch failed:", message);
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
