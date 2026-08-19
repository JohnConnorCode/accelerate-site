import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The minimum deployed shape every Revenue OS service is allowed to depend on.
 * Keep this declarative: the CLI validates database metadata; the application
 * validates that the API-visible contract is usable at runtime.
 */
export const REVENUE_SCHEMA_CONTRACT_VERSION = "revenue-os.2026-08-17.5";

export const REVENUE_SCHEMA_TABLES = [
  { table: "contacts", columns: ["id", "full_name", "primary_email", "alternate_emails", "company_id", "communication_status", "unsubscribe_token"] },
  { table: "companies", columns: ["id", "name", "domain", "source_record_type", "source_record_id"] },
  { table: "opportunities", columns: ["id", "contact_id", "company_id", "stage", "pipeline", "estimated_value", "won_value", "probability", "source_record_type", "source_record_id"] },
  { table: "stage_events", columns: ["id", "opportunity_id", "to_stage", "source", "created_at"] },
  { table: "activities", columns: ["id", "activity_type", "opportunity_id", "source", "external_id", "occurred_at"] },
  { table: "tasks", columns: ["id", "contact_id", "company_id", "opportunity_id", "source", "dedupe_key", "status"] },
  { table: "conversations", columns: ["id", "channel", "external_id", "contact_id", "opportunity_id", "status"] },
  { table: "messages", columns: ["id", "conversation_id", "provider_id", "direction", "status", "idempotency_key", "delivery_status", "delivery_updated_at", "bounced_at", "complained_at"] },
  { table: "campaigns", columns: ["id", "name", "status", "version", "approved_version", "policy"] },
  { table: "campaign_steps", columns: ["id", "campaign_id", "step_order", "delay_days", "active"] },
  { table: "campaign_members", columns: ["id", "campaign_id", "contact_id", "email", "status", "next_send_at", "send_claimed_at", "send_claim_key"] },
  { table: "proposals", columns: ["id", "opportunity_id", "contact_id", "company_id", "status", "version"] },
  { table: "proposal_events", columns: ["id", "proposal_id", "event_type", "source"] },
  { table: "action_queue", columns: ["id", "action_type", "status", "dedupe_key", "expires_at"] },
  { table: "job_runs", columns: ["id", "job_key", "status", "idempotency_key", "claim_key", "claimed_at"] },
  { table: "source_runs", columns: ["id", "source_key", "status", "summary", "started_at"] },
  { table: "webhook_receipts", columns: ["id", "provider", "event_type", "status", "received_at"] },
  { table: "integration_connections", columns: ["id", "provider", "status", "scopes", "last_success_at"] },
  { table: "audit_log", columns: ["id", "action", "entity_type", "source", "created_at"] },
  { table: "website_events", columns: ["id", "event_id", "visitor_id", "event_name", "path", "created_at"] },
  { table: "email_templates", columns: ["template_key", "current_published_version", "enabled"] },
  { table: "email_template_versions", columns: ["id", "template_key", "state", "body_template"] },
  { table: "contact_import_batches", columns: ["id", "status", "review_digest", "approval_digest", "ai_provider"] },
  { table: "contact_import_rows", columns: ["id", "batch_id", "row_index", "included", "status"] },
  { table: "contact_import_events", columns: ["id", "batch_id", "event_type", "created_at"] },
  { table: "feature_requests", columns: ["id", "seed_key", "status", "sort_order", "source"] },
  { table: "schema_verification_runs", columns: ["id", "contract_version", "status", "summary", "checked_at"] },
] as const;

export const REVENUE_SCHEMA_CONSTRAINTS = [
  { table: "opportunities", name: "opportunities_stage_check" },
  { table: "opportunities", name: "opportunities_probability_check" },
  { table: "proposals", name: "proposals_status_check" },
  { table: "schema_verification_runs", name: "schema_verification_runs_status_check" },
] as const;

export const REVENUE_SCHEMA_INDEXES = [
  "idx_contacts_primary_email_unique",
  "idx_contacts_source_record_unique",
  "idx_opportunities_source_record_unique",
  "idx_messages_idempotency_key",
  "idx_tasks_open_dedupe",
  "idx_contact_import_rows_batch",
  "idx_schema_verification_runs_latest",
  "idx_job_runs_claim_key",
  "idx_job_runs_one_active_per_job",
  "idx_messages_provider_id",
  "idx_webhook_receipts_provider_received",
] as const;

export const REVENUE_SCHEMA_FUNCTIONS = [
  "public.revenue_os_touch_updated_at()",
  "public.publish_email_template(text,text)",
  "public.claim_contact_import_batch(uuid,text)",
  "public.claim_revenue_job_run(text,text)",
  "public.claim_campaign_member_send(uuid,text)",
  "public.stop_campaign_memberships(uuid,uuid,text)",
] as const;

export const REVENUE_SCHEMA_POLICIES = [
  { table: "contacts", name: "Service role full access" },
  { table: "opportunities", name: "Service role full access" },
  { table: "messages", name: "Service role full access" },
  { table: "campaigns", name: "Service role full access" },
  { table: "schema_verification_runs", name: "Service role full access" },
] as const;

export type RevenueSchemaStatus = "success" | "unapplied_migration" | "drift" | "connectivity_failure";
export interface RevenueSchemaIssue { table: string; columns: readonly string[]; code?: string; message: string }
export interface RevenueSchemaDataCheck { status: RevenueSchemaStatus; issues: RevenueSchemaIssue[]; checkedAt: string }
export interface SchemaVerificationRun { contract_version: string; status: RevenueSchemaStatus; failure_code?: string | null; failure_detail?: string | null; checked_at: string }
export interface SchemaVerificationState {
  runtimeStatus: RevenueSchemaStatus;
  latestVerification: SchemaVerificationRun | null;
}
export interface SchemaCenterReadiness {
  status: "ready" | "degraded" | "action";
  ready: boolean;
  reason?: string;
}

function isMissingTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || /relation .* does not exist/i.test(error.message ?? "");
}

export function classifyRevenueSchemaContractStatus(issues: RevenueSchemaIssue[]): RevenueSchemaStatus {
  if (issues.some((issue) => {
    const code = issue.code?.toUpperCase();
    const message = issue.message.toLowerCase();
    return code === "08006" || code === "ECONNREFUSED" || code === "57P01" || /connection timeout|connection refused|could not connect|couldn't connect|econnrefused|connect(ion)? (?:to|from|is)?\s+[\w.-]+|network is unreachable/i.test(message);
  })) {
    return "connectivity_failure";
  }
  if (issues.length === 0) return "success";
  return issues.every(isMissingTable)
    ? "unapplied_migration"
    : "drift";
}

export function computeSchemaCenterStatus(state: SchemaVerificationState): SchemaCenterReadiness {
  if (state.runtimeStatus === "connectivity_failure") {
    return { status: "action", ready: false, reason: "The runtime schema check could not connect." };
  }
  if (state.runtimeStatus === "unapplied_migration") {
    return { status: "action", ready: false, reason: "A required migration is not applied." };
  }
  if (state.runtimeStatus === "drift") {
    return { status: "degraded", ready: false, reason: "The runtime schema contract does not match current metadata." };
  }
  if (state.latestVerification?.status !== "success") {
    return { status: "action", ready: false, reason: "No successful schema verification receipt is recorded." };
  }
  if (state.latestVerification.contract_version !== REVENUE_SCHEMA_CONTRACT_VERSION) {
    return { status: "action", ready: false, reason: "Schema verification receipt contract version is stale." };
  }
  return { status: "ready", ready: true };
}

export async function verifyRevenueSchemaDataAccess(supabase: SupabaseClient): Promise<RevenueSchemaDataCheck> {
  const issues: RevenueSchemaIssue[] = [];
  for (const requirement of REVENUE_SCHEMA_TABLES) {
    const { error } = await supabase.from(requirement.table).select(requirement.columns.join(",")).limit(1);
    if (error) issues.push({ table: requirement.table, columns: requirement.columns, code: error.code, message: error.message });
  }

  const status = classifyRevenueSchemaContractStatus(issues);
  return { status, issues, checkedAt: new Date().toISOString() };
}
