import "server-only";
import { SEED_DEFAULT_MILESTONES } from "./delivery-handoff-contract";
import type { OnboardingTemplate } from "./delivery-handoff";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVITY_LEDGER_CONTRACT,
  loadActivityTimeline,
  type ActivityLedgerRecord,
} from "./activities";
import { loadPipelineStages } from "./pipeline-stage-resolver";
import { isMissingRevenueSchema } from "./db";
import { tenantIdForDatabase } from "@/lib/supabase/server";

export const OPPORTUNITY_RECORD_CONTRACT = "revenue-os-opportunity-record.v1";

type Row = Record<string, unknown>;

export interface OpportunityRecord {
  contract: typeof OPPORTUNITY_RECORD_CONTRACT;
  activityContract: typeof ACTIVITY_LEDGER_CONTRACT;
  opportunity: Record<string, unknown> & {
    id: string;
    canonical_stage: string | null;
  };
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  tasks: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  meetings: Array<Record<string, unknown>>;
  proposals: Array<Record<string, unknown>>;
  activity: ActivityLedgerRecord[];
  /**
   * Delivery engagement linked by opportunity_id, with the next open
   * milestone and overdue handoff commitments surfaced as blockers.
   * Null when nothing has handed off yet — the sales record stands alone.
   */
  handoff_templates: OnboardingTemplate[];
  engagement: {
    id: string;
    business_name: string | null;
    status: string | null;
    next_milestone: { key: string; title: string | null } | null;
    blockers: Array<{ title: string; due_date: string | null }>;
    handed_off_at: string | null;
    /** Exact handoff receipt: template, replay/remainder, originating proposal. */
    receipt: {
      template_key: string;
      template_version: number;
      replayed: boolean;
      created_milestones: string[];
      remainder: string[];
      proposal_id: string | null;
    } | null;
  } | null;
}

function assertQuery(result: { error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`Could not load ${label}: ${result.error.message}`);
}

function requireTenantDatabase(supabase: SupabaseClient, label: string): string {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error(`${label} require a tenant-bound workspace`);
  return tenantId;
}

/** Keyset window used by graph adapters: exact ids or rows after a record id. */
export interface RecordWindow {
  ids?: string[];
  afterId?: string;
  limit: number;
}

/** A full opportunities row (select "*"); the named columns are always present. */
export type OpportunityListRow = Record<string, unknown> & {
  id: string;
  name: string | null;
  stage: string;
  contact_id: string | null;
  company_id: string | null;
};

/**
 * Opportunity list shared by the Pipeline route and the workspace graph. The
 * Pipeline board orders by next action (500 rows); a graph window orders by
 * id for keyset continuation. Missing schema is reported, not thrown.
 */
export async function listOpportunities(
  supabase: SupabaseClient,
  input: {
    stage?: string | null;
    search?: string | null;
    contactId?: string;
    companyId?: string;
    /** Leave out these stages; used by graph reads of open work. */
    excludeStages?: readonly string[];
    window?: RecordWindow;
  } = {},
): Promise<{ schemaReady: boolean; opportunities: OpportunityListRow[] }> {
  const tenantId = requireTenantDatabase(supabase, "Opportunity reads");
  let query = supabase.from("opportunities").select("*").eq("tenant_id", tenantId);
  if (input.window) {
    query = query.order("id", { ascending: true }).limit(input.window.limit);
    if (input.window.ids) query = query.in("id", input.window.ids);
    if (input.window.afterId) query = query.gt("id", input.window.afterId);
  } else
    query = query
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
  if (input.stage) query = query.eq("stage", input.stage);
  if (input.contactId) query = query.eq("contact_id", input.contactId);
  if (input.companyId) query = query.eq("company_id", input.companyId);
  if (input.excludeStages?.length)
    query = query.not("stage", "in", `(${input.excludeStages.join(",")})`);
  if (input.search)
    query = query.or(
      `name.ilike.%${input.search.replace(/[,%]/g, "")}%,email.ilike.%${input.search.replace(/[,%]/g, "")}%`,
    );
  const result = await query;
  if (result.error) {
    if (isMissingRevenueSchema(result.error)) return { schemaReady: false, opportunities: [] };
    throw new Error(`Could not load the pipeline: ${result.error.message}`);
  }
  return { schemaReady: true, opportunities: (result.data ?? []) as OpportunityListRow[] };
}

export const CONTACT_DIRECTORY_COLUMNS =
  "id,full_name,primary_email,phone,title,lifecycle_stage,communication_status,next_action,next_action_at,company_id,created_at,updated_at";

/**
 * Contact directory read shared by the directory route (50 per page, most
 * recently updated first) and the workspace graph (keyset window by id).
 */
export async function listContacts(
  supabase: SupabaseClient,
  input: { page?: number; search?: string; companyId?: string; window?: RecordWindow } = {},
): Promise<{ contacts: Array<Record<string, unknown>>; total: number }> {
  const tenantId = requireTenantDatabase(supabase, "Contact reads");
  let query = supabase
    .from("contacts")
    .select(CONTACT_DIRECTORY_COLUMNS, { count: "exact" })
    .eq("tenant_id", tenantId);
  if (input.window) {
    query = query.order("id", { ascending: true }).limit(input.window.limit);
    if (input.window.ids) query = query.in("id", input.window.ids);
    if (input.window.afterId) query = query.gt("id", input.window.afterId);
  } else {
    const offset = (Math.max(1, input.page ?? 1) - 1) * 50;
    query = query.order("updated_at", { ascending: false }).range(offset, offset + 49);
  }
  if (input.companyId) query = query.eq("company_id", input.companyId);
  if (input.search) {
    const escaped = input.search.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,primary_email.ilike.%${escaped}%`);
  }
  const { data, count, error } = await query;
  if (error) throw new Error(`Contacts could not be loaded: ${error.message}`);
  return { contacts: (data ?? []) as Array<Record<string, unknown>>, total: count ?? 0 };
}

/** Bounded company read for the workspace graph, keyset by id. */
export async function listCompanies(
  supabase: SupabaseClient,
  window: RecordWindow,
): Promise<{ companies: Array<Record<string, unknown>> }> {
  const tenantId = requireTenantDatabase(supabase, "Company reads");
  let query = supabase
    .from("companies")
    .select("id,name,domain,industry,updated_at")
    .eq("tenant_id", tenantId)
    .order("id", { ascending: true })
    .limit(window.limit);
  if (window.ids) query = query.in("id", window.ids);
  if (window.afterId) query = query.gt("id", window.afterId);
  const { data, error } = await query;
  if (error) throw new Error(`Companies could not be loaded: ${error.message}`);
  return { companies: (data ?? []) as Array<Record<string, unknown>> };
}

/**
 * Founder-facing, bounded opportunity read model. Provider metadata, message
 * bodies, proposal content, attendee payloads, and credentials are deliberately
 * excluded. The timeline is owned by the canonical activity ledger.
 */
export async function loadOpportunityRecord(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<OpportunityRecord | null> {
  const id = opportunityId.trim();
  if (!id) throw new Error("Opportunity id is required");

  const opportunityResult = await supabase
    .from("opportunities")
    .select(
      "id,tenant_id,name,email,contact_id,company_id,stage,source,source_detail,owner_email,next_action,next_action_at,estimated_value,won_value,probability,loss_reason,last_activity_at,closed_at,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  assertQuery(opportunityResult, "the opportunity");
  if (!opportunityResult.data) return null;
  const opportunity = opportunityResult.data;

  const [
    contactResult,
    companyResult,
    tasksResult,
    conversationsResult,
    meetingsResult,
    proposalsResult,
    engagementResult,
    activity,
  ] = await Promise.all([
    opportunity.contact_id
      ? supabase
          .from("contacts")
          .select(
            "id,full_name,primary_email,alternate_emails,phone,title,lifecycle_stage,communication_status,next_action,next_action_at,source,created_at,updated_at",
          )
          .eq("id", opportunity.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    opportunity.company_id
      ? supabase
          .from("companies")
          .select(
            "id,name,domain,website,industry,size_band,location,research_summary,qualification,source,created_at,updated_at",
          )
          .eq("id", opportunity.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("tasks")
      .select(
        "id,title,description,due_date,due_time,priority,status,related_type,related_id,related_name,source,created_at,completed_at,snoozed_until",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("conversations")
      .select("id,channel,subject,status,intent,unread_count,last_message_at,created_at,updated_at")
      .eq("opportunity_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("calendar_events")
      .select(
        "id,provider,title,description,location,start_at,end_at,all_day,status,html_link,created_at,updated_at",
      )
      .eq("opportunity_id", id)
      .order("start_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("proposals")
      .select(
        "id,title,client_name,total_one_time,total_monthly,status,sent_at,viewed_at,responded_at,expires_at,version,created_at,updated_at",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("clients")
      .select("id,business_name,status,onboarding_checklist,handoff_receipt,created_at")
      .eq("opportunity_id", id)
      .limit(1)
      .maybeSingle(),
    loadActivityTimeline(supabase, { opportunityId: id, limit: 100 }),
  ]);

  assertQuery(contactResult, "the linked contact");
  assertQuery(companyResult, "the linked company");
  assertQuery(tasksResult, "related tasks");
  assertQuery(conversationsResult, "related conversations");
  assertQuery(meetingsResult, "related meetings");
  assertQuery(proposalsResult, "related proposals");
  assertQuery(engagementResult, "the delivery engagement");

  const stages = await loadPipelineStages(supabase, opportunity.tenant_id);

  const engagementRow = (engagementResult.data ?? null) as Row | null;
  const checklist = Array.isArray(engagementRow?.onboarding_checklist)
    ? (engagementRow.onboarding_checklist as Array<{ key: string; title?: string; status: string }>)
    : [];
  const today = new Date().toISOString().split("T")[0]!;
  const handoffTasks = ((tasksResult.data ?? []) as Row[]).filter(
    (task) => typeof task.dedupe_key === "string" && task.dedupe_key.startsWith("handoff:"),
  );
  const nextMilestoneEntry = checklist.find((entry) => entry.status !== "complete");
  const storedReceipt = (engagementRow?.handoff_receipt ?? {}) as Record<string, unknown>;
  const engagement = engagementRow
    ? {
        id: String(engagementRow.id),
        business_name: (engagementRow.business_name as string) ?? null,
        status: (engagementRow.status as string) ?? null,
        next_milestone: nextMilestoneEntry
          ? {
              key: nextMilestoneEntry.key,
              title: nextMilestoneEntry.title ?? nextMilestoneEntry.key,
            }
          : null,
        blockers: handoffTasks
          .filter(
            (task) =>
              task.status !== "completed" &&
              typeof task.due_date === "string" &&
              task.due_date < today,
          )
          .map((task) => ({
            title: String(task.title ?? "Untitled commitment"),
            due_date: String(task.due_date),
          })),
        handed_off_at: (engagementRow.created_at as string) ?? null,
        // The exact handoff receipt is returned so delivery traceability is
        // visible: template/version, replay, remainder and originating proposal.
        receipt:
          typeof storedReceipt.engagement_id === "string"
            ? {
                template_key: String(storedReceipt.template_key ?? ""),
                template_version: Number(storedReceipt.template_version ?? 0),
                replayed: storedReceipt.replayed === true,
                created_milestones: Array.isArray(storedReceipt.created_milestones)
                  ? (storedReceipt.created_milestones as unknown[]).map(String)
                  : [],
                remainder: Array.isArray(storedReceipt.remainder)
                  ? (storedReceipt.remainder as unknown[]).map(String)
                  : [],
                proposal_id:
                  typeof storedReceipt.proposal_id === "string" ? storedReceipt.proposal_id : null,
              }
            : null,
      }
    : null;

  const templatesRead = await supabase
    .from("onboarding_templates")
    .select("template_key,version,milestones")
    .eq("active", true)
    .order("template_key")
    .limit(50);
  assertQuery(templatesRead, "onboarding templates");
  const templates: OnboardingTemplate[] = (templatesRead.data ?? []).map((t) => ({
    key: t.template_key,
    version: t.version,
    milestones: t.milestones,
  }));
  if (!templates.some((t) => t.key === "default"))
    templates.unshift({ key: "default", version: 1, milestones: SEED_DEFAULT_MILESTONES });
  if (storedReceipt.template_snapshot) {
    const pinned = storedReceipt.template_snapshot as OnboardingTemplate;
    const index = templates.findIndex((t) => t.key === pinned.key);
    if (index >= 0) templates[index] = pinned;
    else templates.unshift(pinned);
  }

  return {
    contract: OPPORTUNITY_RECORD_CONTRACT,
    activityContract: ACTIVITY_LEDGER_CONTRACT,
    opportunity: { ...opportunity, canonical_stage: stages.canonicalStage(opportunity.stage) },
    contact: contactResult.data,
    company: companyResult.data,
    tasks: tasksResult.data ?? [],
    conversations: conversationsResult.data ?? [],
    meetings: meetingsResult.data ?? [],
    proposals: proposalsResult.data ?? [],
    activity,
    engagement,
    handoff_templates: templates,
  };
}
