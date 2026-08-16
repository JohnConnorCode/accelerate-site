import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveOrCreateIdentity } from "@/lib/revenue-os/identity";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";
import { canonicalStage, transitionOpportunity } from "@/lib/revenue-os/pipeline";
import { REVENUE_STAGES, type RevenueStage } from "@/lib/revenue-os/types";
import { recordAudit } from "@/lib/revenue-os/audit";

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
  const [contacts, companies] = await Promise.all([
    contactIds.length ? supabase.from("contacts").select("*").in("id", contactIds) : Promise.resolve({ data: [], error: null }),
    companyIds.length ? supabase.from("companies").select("*").in("id", companyIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const contactMap = new Map((contacts.data ?? []).map((item) => [item.id, item]));
  const companyMap = new Map((companies.data ?? []).map((item) => [item.id, item]));
  return NextResponse.json({
    schemaReady: true,
    opportunities: (result.data ?? []).map((item) => ({ ...item, canonical_stage: canonicalStage(item.stage), contact: contactMap.get(item.contact_id) ?? null, company: companyMap.get(item.company_id) ?? null })),
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
    const identity = await resolveOrCreateIdentity(supabase, {
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone : null,
      companyName: typeof body.companyName === "string" ? body.companyName : null,
      website: typeof body.website === "string" ? body.website : null,
      industry: typeof body.industry === "string" ? body.industry : null,
      source: "manual",
    });
    const { data, error } = await supabase.from("opportunities").insert({
      name: typeof body.opportunityName === "string" && body.opportunityName.trim() ? body.opportunityName.trim() : identity.company.name,
      contact_id: identity.contact.id,
      company_id: identity.company.id,
      email,
      stage: "new",
      source: "manual",
      estimated_value: Math.max(0, Number(body.estimatedValue) || 0),
      next_action: typeof body.nextAction === "string" ? body.nextAction : null,
      next_action_at: typeof body.nextActionAt === "string" ? body.nextActionAt : null,
      owner_email: auth.user.email,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await recordAudit(supabase, { actorEmail: auth.user.email, action: "opportunity.created", entityType: "opportunity", entityId: data.id, after: data });
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
      const data = await transitionOpportunity(supabase, {
        id,
        to: body.stage as RevenueStage,
        actorEmail: auth.user.email || "founder",
        reason: typeof body.reason === "string" ? body.reason : undefined,
        lossReason: typeof body.lossReason === "string" ? body.lossReason : undefined,
      });
      return NextResponse.json({ opportunity: data });
    }

    const allowed: Record<string, unknown> = {};
    if (typeof body.nextAction === "string" || body.nextAction === null) allowed.next_action = body.nextAction;
    if (typeof body.nextActionAt === "string" || body.nextActionAt === null) allowed.next_action_at = body.nextActionAt;
    if (Number.isFinite(Number(body.estimatedValue))) allowed.estimated_value = Math.max(0, Number(body.estimatedValue));
    if (!Object.keys(allowed).length) return NextResponse.json({ error: "No valid updates supplied" }, { status: 400 });
    const { data: before } = await supabase.from("opportunities").select("*").eq("id", id).maybeSingle();
    const { data, error } = await supabase.from("opportunities").update(allowed).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    await recordAudit(supabase, { actorEmail: auth.user.email, action: "opportunity.updated", entityType: "opportunity", entityId: id, before, after: data });
    return NextResponse.json({ opportunity: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the opportunity" }, { status: 400 });
  }
}
