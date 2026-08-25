import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { canonicalStage, createOpportunity, transitionOpportunity, transitionStatusFromError, updateOpportunityDetails } from "@/lib/revenue-os/pipeline";
import { REVENUE_STAGES, type RevenueStage } from "@/lib/revenue-os/types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  const params = new URL(request.url).searchParams;
  const stage = params.get("stage");
  const search = params.get("search")?.trim();

  let query = supabase.from("opportunities").select("*").order("next_action_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
  if (stage && REVENUE_STAGES.includes(stage as RevenueStage)) query = query.eq("stage", stage);
  if (search) query = query.or(`name.ilike.%${search.replace(/[,%]/g, "")}%,email.ilike.%${search.replace(/[,%]/g, "")}%`);
  const result = await query;
  if (result.error) {
    if (isMissingRevenueSchema(result.error)) return NextResponse.json({ schemaReady: false, opportunities: [], contacts: [], companies: [] });
    return NextResponse.json({ error: "Could not load the pipeline" }, { status: 500 });
  }

  const contactIds = [...new Set((result.data ?? []).map((item) => item.contact_id).filter(Boolean))];
  const companyIds = [...new Set((result.data ?? []).map((item) => item.company_id).filter(Boolean))];
  const opportunityIds = (result.data ?? []).map((item) => item.id);
  const [contacts, companies, meetings] = await Promise.all([
    contactIds.length ? supabase.from("contacts").select("*").in("id", contactIds) : Promise.resolve({ data: [], error: null }),
    companyIds.length ? supabase.from("companies").select("*").in("id", companyIds) : Promise.resolve({ data: [], error: null }),
    opportunityIds.length
      ? supabase.from("calendar_events").select("opportunity_id,start_at,status").in("opportunity_id", opportunityIds).gte("start_at", new Date().toISOString()).neq("status", "cancelled").order("start_at", { ascending: true }).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const contactMap = new Map((contacts.data ?? []).map((item) => [item.id, item]));
  const companyMap = new Map((companies.data ?? []).map((item) => [item.id, item]));
  const meetingMap = new Map<string, string>();
  for (const meeting of meetings.data ?? []) {
    if (meeting.opportunity_id && !meetingMap.has(meeting.opportunity_id)) meetingMap.set(meeting.opportunity_id, meeting.start_at);
  }
  return NextResponse.json({
    schemaReady: true,
    signalsReady: { calendar: !meetings.error },
    opportunities: (result.data ?? []).map((item) => ({ ...item, canonical_stage: canonicalStage(item.stage), next_meeting_at: meetingMap.get(item.id) ?? null, contact: contactMap.get(item.contact_id) ?? null, company: companyMap.get(item.company_id) ?? null })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name || !email) return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  try {
    const data = await createOpportunity(supabase, {
      actorEmail: auth.user.email || "founder",
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone : null,
      companyName: typeof body.companyName === "string" ? body.companyName : null,
      website: typeof body.website === "string" ? body.website : null,
      industry: typeof body.industry === "string" ? body.industry : null,
      opportunityName: typeof body.opportunityName === "string" ? body.opportunityName : null,
      estimatedValue: Number.isFinite(Number(body.estimatedValue)) ? Number(body.estimatedValue) : null,
      nextAction: typeof body.nextAction === "string" ? body.nextAction : null,
      nextActionAt: typeof body.nextActionAt === "string" ? body.nextActionAt : null,
    });
    return NextResponse.json({ opportunity: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the opportunity" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  try {
    if (typeof body.stage === "string") {
      if (!REVENUE_STAGES.includes(body.stage as RevenueStage)) return NextResponse.json({ error: "Invalid pipeline stage" }, { status: 400 });
      try {
        const data = await transitionOpportunity(supabase, {
          id,
          to: body.stage as RevenueStage,
          actorEmail: auth.user.email || "founder",
          reason: typeof body.reason === "string" ? body.reason : undefined,
          lossReason: typeof body.lossReason === "string" ? body.lossReason : undefined,
        });
        return NextResponse.json({ opportunity: data });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the opportunity" }, { status: transitionStatusFromError(error) });
      }
    }

    const detailInput: { id: string; actorEmail: string; nextAction?: string | null; nextActionAt?: string | null; estimatedValue?: number | null } = { id, actorEmail: auth.user.email || "founder" };
    if (typeof body.nextAction === "string" || body.nextAction === null) detailInput.nextAction = body.nextAction;
    if (typeof body.nextActionAt === "string" || body.nextActionAt === null) detailInput.nextActionAt = body.nextActionAt;
    if (Number.isFinite(Number(body.estimatedValue))) detailInput.estimatedValue = Number(body.estimatedValue);
    const data = await updateOpportunityDetails(supabase, detailInput);
    return NextResponse.json({ opportunity: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the opportunity" }, { status: 400 });
  }
}
