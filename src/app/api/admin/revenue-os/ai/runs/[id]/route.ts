import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AiOperationsValidationError, loadAiRunDetail } from "@/lib/revenue-os/ai-operations";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await context.params;
    const payload = await loadAiRunDetail(createServiceRoleClient(), id);
    if (payload.schemaReady && !payload.run) return NextResponse.json({ error: "AI run not found" }, { status: 404 });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AiOperationsValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[ai-operations] could not load run detail", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Could not load AI run" }, { status: 500 });
  }
}
