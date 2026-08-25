import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { updateOpportunityDetails } from "@/lib/revenue-os/pipeline";
import { loadOpportunityRecord } from "@/lib/revenue-os/records";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const record = await loadOpportunityRecord(createServiceRoleClient(), id);
    if (!record) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    return NextResponse.json({ schemaReady: true, record });
  } catch (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, record: null });
    console.error("Opportunity record read failed", error);
    return NextResponse.json({ error: "Could not load the opportunity record" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "A valid JSON body is required" }, { status: 400 });

  const nextAction = body.nextAction;
  if (nextAction !== undefined && nextAction !== null && typeof nextAction !== "string") {
    return NextResponse.json({ error: "Next action must be text" }, { status: 400 });
  }
  if (typeof nextAction === "string" && nextAction.trim().length > 500) {
    return NextResponse.json({ error: "Next action is limited to 500 characters" }, { status: 400 });
  }
  const nextActionAt = body.nextActionAt;
  if (nextActionAt !== undefined && nextActionAt !== null && (typeof nextActionAt !== "string" || Number.isNaN(Date.parse(nextActionAt)))) {
    return NextResponse.json({ error: "Next action time is invalid" }, { status: 400 });
  }
  const estimatedValue = body.estimatedValue;
  if (estimatedValue !== undefined && (!Number.isFinite(Number(estimatedValue)) || Number(estimatedValue) < 0 || Number(estimatedValue) > 1_000_000_000)) {
    return NextResponse.json({ error: "Estimated value must be between 0 and 1,000,000,000" }, { status: 400 });
  }
  const expectedUpdatedAt = body.expectedUpdatedAt;
  if (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(expectedUpdatedAt)))) {
    return NextResponse.json({ error: "Record version is invalid" }, { status: 400 });
  }

  try {
    await updateOpportunityDetails(createServiceRoleClient(), {
      id,
      actorEmail: auth.user.email || "founder",
      nextAction: typeof nextAction === "string" ? nextAction.trim() || null : nextAction === null ? null : undefined,
      nextActionAt: typeof nextActionAt === "string" ? new Date(nextActionAt).toISOString() : nextActionAt === null ? null : undefined,
      estimatedValue: estimatedValue === undefined ? undefined : Number(estimatedValue),
      expectedUpdatedAt: typeof expectedUpdatedAt === "string" ? expectedUpdatedAt : undefined,
    });
    const record = await loadOpportunityRecord(createServiceRoleClient(), id);
    if (!record) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    return NextResponse.json({ schemaReady: true, record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the opportunity";
    return NextResponse.json({ error: message }, { status: /changed while you were editing/i.test(message) ? 409 : /not found/i.test(message) ? 404 : 400 });
  }
}
