import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import {
  createOpportunity,
  transitionOpportunity,
  transitionStatusFromError,
  updateOpportunityDetails,
} from "@/lib/revenue-os/pipeline";
import { loadPipelineStages } from "@/lib/revenue-os/pipeline-stage-resolver";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = auth.database;
  const params = new URL(request.url).searchParams;
  const stage = params.get("stage");
  const search = params.get("search")?.trim();

  let query = supabase
    .from("opportunities")
    .select("*")
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (stage) query = query.eq("stage", stage);
  if (search)
    query = query.or(
      `name.ilike.%${search.replace(/[,%]/g, "")}%,email.ilike.%${search.replace(/[,%]/g, "")}%`,
    );
  const result = await query;
  if (result.error) {
    if (isMissingRevenueSchema(result.error))
      return NextResponse.json({
        schemaReady: false,
        opportunities: [],
        contacts: [],
        companies: [],
      });
    return NextResponse.json({ error: "Could not load the pipeline" }, { status: 500 });
  }

  const contactIds = [
    ...new Set((result.data ?? []).map((item) => item.contact_id).filter(Boolean)),
  ];
  const companyIds = [
    ...new Set((result.data ?? []).map((item) => item.company_id).filter(Boolean)),
  ];
  const opportunityIds = (result.data ?? []).map((item) => item.id);
  const [contacts, companies, meetings] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("*").in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length
      ? supabase.from("companies").select("*").in("id", companyIds)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length
      ? supabase
          .from("calendar_events")
          .select("opportunity_id,start_at,status")
          .in("opportunity_id", opportunityIds)
          .gte("start_at", new Date().toISOString())
          .neq("status", "cancelled")
          .order("start_at", { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const contactMap = new Map((contacts.data ?? []).map((item) => [item.id, item]));
  const companyMap = new Map((companies.data ?? []).map((item) => [item.id, item]));
  const meetingMap = new Map<string, string>();
  for (const meeting of meetings.data ?? []) {
    if (meeting.opportunity_id && !meetingMap.has(meeting.opportunity_id))
      meetingMap.set(meeting.opportunity_id, meeting.start_at);
  }
  const stages = await loadPipelineStages(supabase, auth.tenant.id);
  return NextResponse.json({
    schemaReady: true,
    signalsReady: { calendar: !meetings.error },
    opportunities: (result.data ?? []).map((item) => ({
      ...item,
      canonical_stage: stages.canonicalStage(item.stage),
      next_meeting_at: meetingMap.get(item.id) ?? null,
      contact: contactMap.get(item.contact_id) ?? null,
      company: companyMap.get(item.company_id) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name || !email)
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  const supabase = auth.database;
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
      estimatedValue: Number.isFinite(Number(body.estimatedValue))
        ? Number(body.estimatedValue)
        : null,
      nextAction: typeof body.nextAction === "string" ? body.nextAction : null,
      nextActionAt: typeof body.nextActionAt === "string" ? body.nextActionAt : null,
    });
    return NextResponse.json({ opportunity: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the opportunity" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as Record<string, unknown>;
  const supabase = auth.database;

  if (Array.isArray(body.reorder)) {
    if (!body.reorder.length || body.reorder.length > 250) {
      return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
    }
    const { data: validColumns, error: columnsError } = await supabase
      .from("kanban_columns")
      .select("column_key")
      .eq("board_key", "pipeline")
      .eq("tenant_id", auth.tenant.id);
    if (columnsError) return NextResponse.json({ error: columnsError.message }, { status: 500 });
    const validColumnKeys = new Set((validColumns ?? []).map((row) => row.column_key as string));
    const updates = body.reorder.map((item: Record<string, unknown>) => ({
      id: typeof item.id === "string" ? item.id : "",
      column_key: typeof item.column_key === "string" ? item.column_key : "",
      sort_order: Number(item.sort_order),
    }));
    if (
      updates.some(
        (item: { id: string; column_key: string; sort_order: number }) =>
          !item.id || !validColumnKeys.has(item.column_key) || !Number.isFinite(item.sort_order),
      )
    ) {
      return NextResponse.json(
        { error: "Every reordered card needs a valid id, stage, and order" },
        { status: 400 },
      );
    }
    // Same-column reorder only: a cross-column stage change always goes
    // through transitionOpportunity (below) so probability/closed_at/loss
    // reason/audit stay correct. The kanban board only calls this endpoint
    // for a same-column drag; a cross-column drag calls PATCH with `stage`.
    const { data: affected, error } = await supabase.rpc("reorder_kanban_items", {
      p_board_key: "pipeline",
      p_updates: updates,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (affected !== updates.length) {
      return NextResponse.json(
        { error: "One or more opportunities could not be reordered. Refresh and try again." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, affected });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 });

  try {
    if (typeof body.stage === "string") {
      try {
        const data = await transitionOpportunity(supabase, {
          id,
          to: body.stage,
          actorEmail: auth.user.email || "founder",
          reason: typeof body.reason === "string" ? body.reason : undefined,
          lossReason: typeof body.lossReason === "string" ? body.lossReason : undefined,
          allowTerminalReopen:
            typeof body.allowTerminalReopen === "boolean" ? body.allowTerminalReopen : undefined,
          sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : undefined,
        });
        return NextResponse.json({ opportunity: data });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Could not update the opportunity" },
          { status: transitionStatusFromError(error) },
        );
      }
    }

    const detailInput: {
      id: string;
      actorEmail: string;
      nextAction?: string | null;
      nextActionAt?: string | null;
      estimatedValue?: number | null;
    } = { id, actorEmail: auth.user.email || "founder" };
    if (typeof body.nextAction === "string" || body.nextAction === null)
      detailInput.nextAction = body.nextAction;
    if (typeof body.nextActionAt === "string" || body.nextActionAt === null)
      detailInput.nextActionAt = body.nextActionAt;
    if (Number.isFinite(Number(body.estimatedValue)))
      detailInput.estimatedValue = Number(body.estimatedValue);
    const data = await updateOpportunityDetails(supabase, detailInput);
    return NextResponse.json({ opportunity: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the opportunity" },
      { status: 400 },
    );
  }
}
