import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { simulateBlueprint } from "@/lib/revenue-os/architect-review-simulation";
import {
  collectBlueprintLiveContext,
  getLatestBlueprintVersion,
  parseBlueprint,
} from "@/lib/revenue-os/workspace-blueprint";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!UUID_PATTERN.test((id ?? "").trim())) {
    return NextResponse.json({ error: "A valid blueprint id is required" }, { status: 400 });
  }
  try {
    const version = await getLatestBlueprintVersion(auth.database, {
      tenantId: auth.tenant.id,
      blueprintId: id.trim(),
    });
    const live = await collectBlueprintLiveContext(auth.database, auth.tenant.id);
    const simulation = simulateBlueprint(parseBlueprint(version.document), live);
    return NextResponse.json(simulation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not simulate Blueprint";
    console.warn("Blueprint simulate failed:", message);
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
