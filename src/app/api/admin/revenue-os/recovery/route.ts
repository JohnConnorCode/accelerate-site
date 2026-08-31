import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { activateCampaign, executeDueCampaignMembers, pauseCampaign } from "@/lib/revenue-os/campaigns";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { createRecoveryPlaybook, loadRecoveryWorkspace, previewRecoveryAudience, reconcileRecoveryOutcomes, type RecoveryMotion } from "@/lib/revenue-os/recovery";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const supabase = auth.database;
    const batchId = new URL(request.url).searchParams.get("batchId");
    if (batchId) return NextResponse.json(await previewRecoveryAudience(supabase, batchId));
    const workspace = await loadRecoveryWorkspace(supabase);
    const booking = auth.tenant.config.booking;
    const defaultBookingUrl = booking && typeof booking === "object" && typeof (booking as Record<string, unknown>).url === "string"
      ? (booking as Record<string, string>).url
      : "";
    return NextResponse.json({ ...workspace, defaultBookingUrl });
  }
  catch (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, batches: [], playbooks: [] });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load recovery" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const steps = Array.isArray(body.steps) ? body.steps.map((step) => {
      const value = step && typeof step === "object" ? step as Record<string, unknown> : {};
      return { delayDays: Number(value.delayDays), subject: String(value.subject || ""), body: String(value.body || "") };
    }) : [];
    const result = await createRecoveryPlaybook(auth.database, {
      name: String(body.name || ""), sourceBatchId: String(body.sourceBatchId || ""), motion: String(body.motion || "") as RecoveryMotion,
      relationshipBasis: String(body.relationshipBasis || ""), offerLabel: String(body.offerLabel || ""), bookingUrl: String(body.bookingUrl || ""),
      timezone: String(body.timezone || "America/Detroit"), outcomeWindowDays: Number(body.outcomeWindowDays), steps, actorEmail: auth.user.email || "founder",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create recovery playbook" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json() as { campaignId?: string; action?: "activate" | "pause" | "run" };
    if (!body.campaignId || !body.action) return NextResponse.json({ error: "Choose a recovery playbook action" }, { status: 400 });
    const supabase = auth.database;
    if (body.action === "activate") return NextResponse.json({ campaign: await activateCampaign(supabase, body.campaignId, auth.user.email || "founder") });
    if (body.action === "pause") return NextResponse.json({ campaign: await pauseCampaign(supabase, body.campaignId, auth.user.email || "founder") });
    const result = await executeDueCampaignMembers(supabase, new Date(), body.campaignId);
    const outcomes = await reconcileRecoveryOutcomes(supabase, body.campaignId, auth.user.email || "founder");
    return NextResponse.json({ result, outcomes });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update recovery playbook" }, { status: 400 }); }
}
