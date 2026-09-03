import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVITY_LEDGER_CONTRACT,
  loadActivityTimeline,
  type ActivityLedgerRecord,
} from "./activities";
import { loadPipelineStages } from "./pipeline-stage-resolver";

export const OPPORTUNITY_RECORD_CONTRACT = "revenue-os-opportunity-record.v1";

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
}

function assertQuery(result: { error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`Could not load ${label}: ${result.error.message}`);
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
    loadActivityTimeline(supabase, { opportunityId: id, limit: 100 }),
  ]);

  assertQuery(contactResult, "the linked contact");
  assertQuery(companyResult, "the linked company");
  assertQuery(tasksResult, "related tasks");
  assertQuery(conversationsResult, "related conversations");
  assertQuery(meetingsResult, "related meetings");
  assertQuery(proposalsResult, "related proposals");

  const stages = await loadPipelineStages(supabase, opportunity.tenant_id);

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
  };
}
