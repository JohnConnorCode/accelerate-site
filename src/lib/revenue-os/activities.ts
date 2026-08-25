import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVITY_LEDGER_CONTRACT = "revenue-os-activity-ledger.v1";
const MAX_TITLE_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 5_000;
const MAX_METADATA_BYTES = 20_000;
const ACTIVITY_TYPE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const SOURCE_PATTERN = /^[a-z][a-z0-9_-]{0,79}$/;

export interface ActivityLedgerInput {
  activityType: string;
  title: string;
  summary?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
  proposalId?: string | null;
  campaignId?: string | null;
  source: string;
  actorEmail?: string | null;
  externalId: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface ActivityLedgerRecord {
  id: string;
  activity_type: string;
  title: string;
  summary: string | null;
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  conversation_id: string | null;
  proposal_id: string | null;
  campaign_id: string | null;
  source: string;
  actor_email: string | null;
  external_id: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface ActivityTimelineFilter {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  conversationId?: string;
  proposalId?: string;
  campaignId?: string;
  before?: string;
  limit?: number;
}

const ACTIVITY_COLUMNS = "id,activity_type,title,summary,contact_id,company_id,opportunity_id,conversation_id,proposal_id,campaign_id,source,actor_email,external_id,metadata,occurred_at,created_at";

function normalizedInput(input: ActivityLedgerInput) {
  const activityType = input.activityType.trim();
  const title = input.title.trim();
  const source = input.source.trim();
  const externalId = input.externalId.trim();
  if (!ACTIVITY_TYPE_PATTERN.test(activityType)) throw new Error("Activity type must be a stable snake_case identifier");
  if (!title) throw new Error("Activity title is required");
  if (title.length > MAX_TITLE_LENGTH) throw new Error(`Activity titles are limited to ${MAX_TITLE_LENGTH} characters`);
  if (!SOURCE_PATTERN.test(source)) throw new Error("Activity source must be a stable lowercase identifier");
  if (!externalId) throw new Error("Activity external ID is required for replay safety");
  if (externalId.length > 500) throw new Error("Activity external IDs are limited to 500 characters");
  const summary = input.summary?.trim() || null;
  if (summary && summary.length > MAX_SUMMARY_LENGTH) throw new Error(`Activity summaries are limited to ${MAX_SUMMARY_LENGTH.toLocaleString()} characters`);
  const metadata = input.metadata ?? {};
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") throw new Error("Activity metadata must be an object");
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) throw new Error("Activity metadata is too large");
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(occurredAt))) throw new Error("Activity occurrence time is invalid");
  return {
    activity_type: activityType,
    title,
    summary,
    contact_id: input.contactId ?? null,
    company_id: input.companyId ?? null,
    opportunity_id: input.opportunityId ?? null,
    conversation_id: input.conversationId ?? null,
    proposal_id: input.proposalId ?? null,
    campaign_id: input.campaignId ?? null,
    source,
    actor_email: input.actorEmail?.trim() || null,
    external_id: externalId,
    metadata,
    occurred_at: new Date(occurredAt).toISOString(),
  };
}

async function findActivityReceipt(supabase: SupabaseClient, source: string, externalId: string): Promise<ActivityLedgerRecord | null> {
  const { data, error } = await supabase.from("activities").select(ACTIVITY_COLUMNS).eq("source", source).eq("external_id", externalId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ActivityLedgerRecord | null;
}

/**
 * The only writer for the cross-channel activity ledger. A logical event owns
 * one `(source, external_id)` receipt; concurrent retries return that receipt
 * instead of inventing another timeline event.
 */
export async function recordActivity(supabase: SupabaseClient, input: ActivityLedgerInput): Promise<{ activity: ActivityLedgerRecord; duplicate: boolean }> {
  const row = normalizedInput(input);
  const existing = await findActivityReceipt(supabase, row.source, row.external_id);
  if (existing) return { activity: existing, duplicate: true };

  const { data, error } = await supabase.from("activities").insert(row).select(ACTIVITY_COLUMNS).single();
  if (!error && data) return { activity: data as ActivityLedgerRecord, duplicate: false };

  // A concurrent writer may have won the unique `(source, external_id)` race.
  // Re-read before surfacing failure so provider and browser retries are safe.
  const replay = await findActivityReceipt(supabase, row.source, row.external_id);
  if (replay) return { activity: replay, duplicate: true };
  throw new Error(error?.message ?? "Activity receipt could not be recorded");
}

/** Bounded, deterministic reader shared by record workspaces and AI context. */
export async function loadActivityTimeline(supabase: SupabaseClient, filter: ActivityTimelineFilter): Promise<ActivityLedgerRecord[]> {
  const links = [filter.contactId, filter.companyId, filter.opportunityId, filter.conversationId, filter.proposalId, filter.campaignId].filter(Boolean);
  if (!links.length) throw new Error("A canonical record ID is required to load activity");
  const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 50)));
  let query = supabase.from("activities").select(ACTIVITY_COLUMNS);
  if (filter.contactId) query = query.eq("contact_id", filter.contactId);
  if (filter.companyId) query = query.eq("company_id", filter.companyId);
  if (filter.opportunityId) query = query.eq("opportunity_id", filter.opportunityId);
  if (filter.conversationId) query = query.eq("conversation_id", filter.conversationId);
  if (filter.proposalId) query = query.eq("proposal_id", filter.proposalId);
  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId);
  if (filter.before) {
    if (Number.isNaN(Date.parse(filter.before))) throw new Error("Activity cursor is invalid");
    query = query.lt("occurred_at", new Date(filter.before).toISOString());
  }
  const { data, error } = await query.order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLedgerRecord[];
}
