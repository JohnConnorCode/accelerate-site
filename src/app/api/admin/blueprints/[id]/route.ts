import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  buildReviewModel,
  collectBlueprintLiveContext,
  getLatestBlueprintVersion,
  parseBlueprint,
  summarizePreflight,
  validateAgainstCapabilities,
} from "@/lib/revenue-os/workspace-blueprint";
import { compileBlueprintPlan } from "@/lib/revenue-os/workspace-blueprint-compiler";
import { planWorkspaceOperations } from "@/lib/revenue-os/workspace-architect-generated-operations";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!UUID_PATTERN.test((id ?? "").trim())) {
    return NextResponse.json({ error: "A valid blueprint id is required" }, { status: 400 });
  }
  try {
    const latest = await getLatestBlueprintVersion(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
    });
    const blueprint = parseBlueprint(latest.document);
    const context = await collectBlueprintLiveContext(auth.database, auth.tenant.id);
    const validation = validateAgainstCapabilities(blueprint, context);
    return NextResponse.json({
      blueprintId: latest.blueprint_id,
      version: latest.version,
      parentVersion: latest.parent_version,
      changeSummary: latest.change_summary,
      createdAt: latest.created_at,
      document: blueprint,
      review: buildReviewModel(blueprint, validation),
      compile: compileBlueprintPlan(blueprint, context),
      operations: planWorkspaceOperations(blueprint, context),
      preflight: summarizePreflight(blueprint),
      blocked: validation.blocked,
      approvals: validation.approvals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("Blueprint detail failed:", message);
    if (/not found in this workspace/i.test(message)) {
      return NextResponse.json({ error: "Blueprint not found in this workspace" }, { status: 404 });
    }
    if (/Invalid WorkspaceBlueprint|must not contain secrets/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
