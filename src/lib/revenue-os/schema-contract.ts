import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The minimum deployed shape every Revenue OS service is allowed to depend on.
 * Keep this declarative: the CLI validates database metadata; the application
 * validates that the API-visible contract is usable at runtime.
 */
export const REVENUE_SCHEMA_CONTRACT_VERSION = "revenue-os.2026-09-08.1";

export const TENANT_SCOPED_TABLES = [
  "proposal_lifecycle_receipts",
  "radar_outreach_attempts",
  "radar_relationship_reviews",
  "radar_current_relationships",
  "message_evidence_context",
  "radar_assessments",
  "site_drafts",
  "site_draft_revisions",
  "radar_current_assessments",
  "radar_current_evidence_links",
  "radar_sources",
  "radar_source_versions",
  "radar_discoveries",
  "radar_opportunities",
  "radar_evidence_links",
  "radar_assets",
  "radar_asset_sources",
  "radar_outcomes",
  "radar_store_receipts",
  "collection_reminder_attempts",
  "collection_cases",
  "collection_observations",
  "collection_case_invoices",
  "collection_events",
  "collection_commands",

  "invoice_pages",
  "work_items",
  "workspace_capabilities",
  "coworkers",
  "claims",
  "evidence",
  "autonomy_policies",
  "autonomy_hard_floors",
  "agent_memory",
  "learned_policies",
  "budget_limits",
  "budget_usage",
  "budget_receipts",
  "model_call_receipts",
  "model_call_events",
  "plugins",
  "plugin_tools",
  "plugin_triggers",
  "kanban_columns",

  "action_queue",
  "activities",
  "admin_notifications",
  "admin_settings",
  "agent_run_events",
  "agent_runs",
  "ai_conversations",
  "ai_messages",
  "audit_log",
  "calendar_events",
  "calendly_webhook_receipts",
  "campaign_members",
  "campaign_steps",
  "campaigns",
  "campaign_duplicate_receipts",
  "chat_leads",
  "clients",
  "companies",
  "contact_import_batches",
  "contact_import_events",
  "contact_import_rows",
  "contact_submissions",
  "contacts",
  "content_calendar",
  "conversations",
  "drive_documents",
  "email_sequence_logs",
  "email_sequences",
  "email_template_versions",
  "email_templates",
  "entity_links",
  "entity_types",
  "integration_connections",
  "job_runs",
  "messages",
  "onboarding_templates",
  "opportunities",
  "opportunity_stage_events",
  "partner_applications",
  "plan_views",
  "proposal_events",
  "proposals",
  "recovery_candidates",
  "recovery_outcomes",
  "recovery_playbooks",
  "resource_downloads",
  "roi_calculations",
  "sent_emails",
  "solution_requests",
  "source_runs",
  "stage_events",
  "subscribers",
  "tasks",
  "webhook_receipts",
  "website_events",
  "website_grades",
] as const;

const TENANT_SCOPED_TABLE_SET = new Set<string>(TENANT_SCOPED_TABLES);

const BASE_REVENUE_SCHEMA_TABLES = [
  {
    table: "site_drafts",
    columns: [
      "id",
      "slug",
      "draft",
      "version",
      "checksum",
      "created_at",
      "updated_at",
      "discarded_at",
    ],
  },
  {
    table: "site_draft_revisions",
    columns: ["id", "draft_id", "version", "operation", "draft", "actor_email", "created_at"],
  },
  {
    table: "campaign_duplicate_receipts",
    columns: ["request_id", "request_hash", "source_id", "source_version", "copy_id", "created_at"],
  },
  {
    table: "drive_documents",
    columns: [
      "indexed_status",
      "content_duplicate_of",
      "content_hash",
      "extracted_text",
      "provider_revision",
    ],
  },
  { table: "clients", columns: ["id", "opportunity_id", "handoff_receipt", "handoff_revision"] },
  {
    table: "work_items",
    columns: [
      "id",
      "status",
      "lease_owner",
      "lease_expires_at",
      "attempt_count",
      "action_ids",
      "agent_run_id",
    ],
  },
  {
    table: "contacts",
    columns: [
      "id",
      "full_name",
      "primary_email",
      "alternate_emails",
      "company_id",
      "communication_status",
      "unsubscribe_token",
      "tags",
    ],
  },
  {
    table: "companies",
    columns: ["id", "name", "domain", "source_record_type", "source_record_id"],
  },
  {
    table: "opportunities",
    columns: [
      "id",
      "contact_id",
      "company_id",
      "stage",
      "pipeline",
      "estimated_value",
      "won_value",
      "probability",
      "source_record_type",
      "source_record_id",
    ],
  },
  { table: "stage_events", columns: ["id", "opportunity_id", "to_stage", "source", "created_at"] },
  {
    table: "activities",
    columns: ["id", "activity_type", "opportunity_id", "source", "external_id", "occurred_at"],
  },
  {
    table: "tasks",
    columns: [
      "id",
      "contact_id",
      "company_id",
      "opportunity_id",
      "source",
      "dedupe_key",
      "status",
      "assigned_to",
    ],
  },
  {
    table: "conversations",
    columns: ["id", "channel", "external_id", "contact_id", "opportunity_id", "status"],
  },
  {
    table: "onboarding_templates",
    columns: ["id", "template_key", "version", "active", "milestones"],
  },
  {
    table: "messages",
    columns: [
      "id",
      "conversation_id",
      "provider_id",
      "direction",
      "status",
      "idempotency_key",
      "delivery_status",
      "delivery_updated_at",
      "bounced_at",
      "complained_at",
    ],
  },
  {
    table: "campaigns",
    columns: ["id", "name", "status", "version", "approved_version", "policy"],
  },
  {
    table: "entity_types",
    columns: [
      "id",
      "type_key",
      "label",
      "backing_table",
      "id_column",
      "fk_catalog",
      "identity_fields",
      "soft_delete_column",
      "is_disabled",
      "metadata",
    ],
  },
  {
    table: "entity_links",
    columns: [
      "id",
      "source_type",
      "source_id",
      "target_type",
      "target_id",
      "link_type",
      "metadata",
    ],
  },
  { table: "campaign_steps", columns: ["id", "campaign_id", "step_order", "delay_days", "active"] },
  {
    table: "campaign_members",
    columns: [
      "id",
      "campaign_id",
      "contact_id",
      "email",
      "status",
      "next_send_at",
      "send_claimed_at",
      "send_claim_key",
    ],
  },
  {
    table: "proposals",
    columns: [
      "id",
      "opportunity_id",
      "contact_id",
      "company_id",
      "status",
      "version",
      "supersedes_id",
      "superseded_by",
    ],
  },
  { table: "proposal_events", columns: ["id", "proposal_id", "event_type", "source"] },
  {
    table: "action_queue",
    columns: ["id", "action_type", "status", "dedupe_key", "expires_at", "work_item_id"],
  },
  {
    table: "job_runs",
    columns: [
      "id",
      "job_key",
      "status",
      "idempotency_key",
      "claim_key",
      "claimed_at",
      "recovered_from",
    ],
  },
  { table: "source_runs", columns: ["id", "source_key", "status", "summary", "started_at"] },
  { table: "webhook_receipts", columns: ["id", "provider", "event_type", "status", "received_at"] },
  {
    table: "integration_connections",
    columns: ["id", "provider", "status", "scopes", "last_success_at"],
  },
  { table: "audit_log", columns: ["id", "action", "entity_type", "source", "created_at"] },
  {
    table: "website_events",
    columns: ["id", "event_id", "visitor_id", "event_name", "path", "created_at"],
  },
  { table: "email_templates", columns: ["template_key", "current_published_version", "enabled"] },
  { table: "email_template_versions", columns: ["id", "template_key", "state", "body_template"] },
  {
    table: "contact_import_batches",
    columns: ["id", "status", "review_digest", "approval_digest", "ai_provider"],
  },
  { table: "contact_import_rows", columns: ["id", "batch_id", "row_index", "included", "status"] },
  { table: "contact_import_events", columns: ["id", "batch_id", "event_type", "created_at"] },
  {
    table: "recovery_playbooks",
    columns: [
      "id",
      "campaign_id",
      "source_batch_id",
      "motion_key",
      "relationship_basis",
      "offer_label",
      "booking_url",
      "outcome_window_days",
      "created_by",
      "created_at",
    ],
  },
  {
    table: "recovery_candidates",
    columns: [
      "id",
      "playbook_id",
      "campaign_id",
      "contact_id",
      "import_row_id",
      "email",
      "status",
      "estimated_value",
      "eligibility_evidence",
      "baseline",
      "outcome_window_ends_at",
      "created_at",
    ],
  },
  {
    table: "recovery_outcomes",
    columns: [
      "id",
      "candidate_id",
      "opportunity_id",
      "outcome_type",
      "amount",
      "source_receipt_id",
      "observed_at",
      "created_at",
    ],
  },
  { table: "feature_requests", columns: ["id", "seed_key", "status", "sort_order", "source"] },
  {
    table: "schema_verification_runs",
    columns: ["id", "contract_version", "status", "summary", "checked_at"],
  },
  {
    table: "agent_runs",
    columns: [
      "id",
      "surface",
      "provider",
      "model",
      "tool_pack",
      "conversation_id",
      "status",
      "tool_names",
      "duration_ms",
      "started_at",
      "finished_at",
    ],
  },
  {
    table: "agent_run_events",
    columns: ["id", "run_id", "event_type", "tool_name", "output", "created_at"],
  },
  {
    table: "ai_conversations",
    columns: [
      "id",
      "actor_email",
      "title",
      "status",
      "last_message_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "ai_messages",
    columns: [
      "id",
      "conversation_id",
      "role",
      "content",
      "run_id",
      "client_message_id",
      "metadata",
      "created_at",
    ],
  },
] as const;

const BASE_REVENUE_SCHEMA_TABLE_NAMES = new Set<string>(
  BASE_REVENUE_SCHEMA_TABLES.map((item) => item.table),
);

export const REVENUE_SCHEMA_TABLES = [
  {
    table: "collection_reminder_attempts",
    columns: [
      "tenant_id",
      "action_id",
      "case_id",
      "state",
      "digest",
      "case_revision",
      "cooldown_hours",
      "message_id",
      "provider_id",
      "sent_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "collection_cases",
    columns: [
      "id",
      "tenant_id",
      "contact_id",
      "currency",
      "status",
      "revision",
      "disputed",
      "paused",
      "pause_until",
      "promise_date",
      "owner_email",
      "next_action",
      "settled_at",
    ],
  },
  {
    table: "collection_observations",
    columns: [
      "id",
      "tenant_id",
      "request_id",
      "creation_action_id",
      "contact_id",
      "provider_account",
      "credential_version",
      "invoice_id",
      "test_mode",
      "currency",
      "status",
      "remaining",
      "due_date",
      "observed_at",
      "provider_request_id",
    ],
  },
  {
    table: "collection_case_invoices",
    columns: ["tenant_id", "case_id", "creation_action_id", "observation_id"],
  },
  {
    table: "collection_events",
    columns: [
      "id",
      "tenant_id",
      "case_id",
      "request_id",
      "kind",
      "actor_email",
      "before_state",
      "after_state",
    ],
  },
  {
    table: "collection_commands",
    columns: ["tenant_id", "request_id", "command_hash", "result", "created_at"],
  },
  {
    table: "tenants",
    columns: [
      "id",
      "slug",
      "name",
      "status",
      "config_version",
      "config",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "tenant_memberships",
    columns: [
      "id",
      "tenant_id",
      "user_id",
      "invited_email",
      "role",
      "status",
      "invited_at",
      "activated_at",
      "revoked_at",
    ],
  },
  {
    table: "tenant_ingest_keys",
    columns: [
      "id",
      "tenant_id",
      "key_prefix",
      "token_digest",
      "surfaces",
      "allowed_origins",
      "status",
      "expires_at",
    ],
  },
  {
    table: "platform_audit_log",
    columns: [
      "id",
      "actor_user_id",
      "actor_email",
      "action",
      "tenant_id",
      "metadata",
      "created_at",
    ],
  },
  ...BASE_REVENUE_SCHEMA_TABLES.map((requirement) => ({
    table: requirement.table,
    columns: TENANT_SCOPED_TABLE_SET.has(requirement.table)
      ? [...requirement.columns, "tenant_id"]
      : [...requirement.columns],
  })),
  ...TENANT_SCOPED_TABLES.filter((table) => !BASE_REVENUE_SCHEMA_TABLE_NAMES.has(table)).map(
    (table) => ({ table, columns: ["tenant_id"] }),
  ),
];

export const REVENUE_SCHEMA_CONSTRAINTS = [
  // Pipeline stages are workspace-defined by the kanban migration; the old
  // hard-coded CHECK is deliberately removed by 20260902-kanban-columns.sql.
  { table: "opportunities", name: "opportunities_probability_check" },
  { table: "proposals", name: "proposals_status_check" },
  { table: "schema_verification_runs", name: "schema_verification_runs_status_check" },
] as const;

export const REVENUE_SCHEMA_INDEXES = [
  "site_drafts_live_slug",
  "site_drafts_recent",
  "idx_drive_documents_content_hash",
  "idx_conversations_tenant_upsert",
  "idx_messages_tenant_external_upsert",
  "idx_contacts_tenant_primary_email_unique",
  "idx_contacts_tenant_source_record_unique",
  "idx_opportunities_tenant_source_record_unique",
  "idx_messages_tenant_idempotency_unique",
  "idx_tasks_tenant_open_dedupe",
  "idx_contact_import_rows_batch",
  "idx_schema_verification_runs_latest",
  "idx_job_runs_tenant_claim_key",
  "idx_job_runs_tenant_active_job",
  "idx_messages_provider_id",
  "idx_webhook_receipts_provider_received",
  "idx_ai_conversations_actor_recent",
  "idx_ai_messages_tenant_client_replay",
  "idx_ai_messages_conversation_order",
  "idx_agent_runs_conversation",
  "idx_tenant_memberships_user_active",
  "idx_companies_tenant_domain_unique",
  "idx_webhook_receipts_tenant_provider_id",
  "idx_entity_types_tenant_key_unique",
  "idx_entity_links_tuple_unique",
  "idx_entity_links_source",
  "idx_entity_links_target",
  "idx_onboarding_templates_tenant_id_id",
  "idx_onboarding_templates_active_key",
  "idx_clients_opportunity",
  "idx_clients_handoff_opportunity_unique",
  "idx_tasks_delivery_handoff_unique",
] as const;

export const REVENUE_SCHEMA_SERVICE_FUNCTIONS = [
  {
    name: "public.write_site_draft(text,uuid,text,jsonb,text)",
    migration: "migrations/20260917-site-studio-drafts.sql",
  },
  {
    name: "public.duplicate_campaign_draft(uuid,integer,uuid,text,text)",
    migration: "migrations/20260918-campaign-duplicate-receipts.sql",
  },
  {
    name: "public.bulk_tag_contacts(uuid[],text[],text[],text)",
    migration: "migrations/20260919-contact-bulk-transactions.sql",
  },
  {
    name: "public.stage_campaign_members(uuid,jsonb,boolean,text)",
    migration: "migrations/20260919-contact-bulk-transactions.sql",
  },
  {
    name: "public.publish_onboarding_template(text,jsonb,text)",
    migration: "migrations/20260920-delivery-handoff-convergence.sql",
  },
] as const;

export const REVENUE_SCHEMA_FUNCTIONS = [
  ...REVENUE_SCHEMA_SERVICE_FUNCTIONS.map(({ name }) => name),
  "private.advance_client_handoff_revision()",
  "private.check_delivery_source_binding()",
  "public.reserve_collection_reminder(uuid)",
  "public.reconcile_collection_reminder(uuid)",
  "public.sync_collection_observations(uuid,jsonb,text)",
  "public.update_collection_case(uuid,integer,uuid,jsonb,text)",
  "public.revenue_os_touch_updated_at()",
  "public.publish_email_template(text,text)",
  "public.claim_contact_import_batch(uuid,text)",
  "public.claim_revenue_job_run(text,text,interval)",
  "public.claim_campaign_member_send(uuid,text)",
  "public.stop_campaign_memberships(uuid,uuid,text)",
  "public.configure_command_center_scheduler(text,text)",
  "public.wake_command_center_health()",
  "public.command_center_scheduler_status()",
  "public.accelerate_default_tenant_id()",
  "private.request_tenant_id()",
  "private.has_active_tenant_membership(uuid)",
  "private.authorized_request_tenant_id()",
] as const;

export const REVENUE_SCHEMA_POLICIES = [
  { table: "site_drafts", name: "site_draft_read" },
  { table: "site_draft_revisions", name: "site_revision_read" },
  { table: "campaign_duplicate_receipts", name: "campaign_duplicate_receipt_read" },
  { table: "contacts", name: "Service role full access" },
  { table: "opportunities", name: "Service role full access" },
  { table: "messages", name: "Service role full access" },
  { table: "campaigns", name: "Service role full access" },
  { table: "schema_verification_runs", name: "Service role full access" },
  { table: "tenants", name: "Member tenant read" },
  { table: "tenant_memberships", name: "Own membership read" },
  { table: "contacts", name: "Tenant member access" },
  { table: "admin_settings", name: "Tenant member access" },
  { table: "entity_types", name: "Tenant member access" },
  { table: "entity_links", name: "Tenant member access" },
  { table: "onboarding_templates", name: "Service role full access" },
  { table: "onboarding_templates", name: "Tenant member access" },
] as const;

export type RevenueSchemaStatus =
  "success" | "unapplied_migration" | "drift" | "connectivity_failure";
export interface RevenueSchemaIssue {
  table: string;
  columns: readonly string[];
  code?: string;
  message: string;
}
export interface RevenueSchemaDataCheck {
  status: RevenueSchemaStatus;
  issues: RevenueSchemaIssue[];
  checkedAt: string;
}
export interface SchemaVerificationRun {
  contract_version: string;
  status: RevenueSchemaStatus;
  failure_code?: string | null;
  failure_detail?: string | null;
  checked_at: string;
}
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
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist/i.test(error.message ?? "")
  );
}

export function classifyRevenueSchemaContractStatus(
  issues: RevenueSchemaIssue[],
): RevenueSchemaStatus {
  if (
    issues.some((issue) => {
      const code = issue.code?.toUpperCase();
      const message = issue.message.toLowerCase();
      return (
        code === "08006" ||
        code === "ECONNREFUSED" ||
        code === "57P01" ||
        /connection timeout|connection refused|could not connect|couldn't connect|econnrefused|connect(ion)? (?:to|from|is)?\s+[\w.-]+|network is unreachable/i.test(
          message,
        )
      );
    })
  ) {
    return "connectivity_failure";
  }
  if (issues.length === 0) return "success";
  return issues.every(isMissingTable) ? "unapplied_migration" : "drift";
}

export function computeSchemaCenterStatus(state: SchemaVerificationState): SchemaCenterReadiness {
  if (state.runtimeStatus === "connectivity_failure") {
    return {
      status: "action",
      ready: false,
      reason: "The runtime schema check could not connect.",
    };
  }
  if (state.runtimeStatus === "unapplied_migration") {
    return { status: "action", ready: false, reason: "A required migration is not applied." };
  }
  if (state.runtimeStatus === "drift") {
    return {
      status: "degraded",
      ready: false,
      reason: "The runtime schema contract does not match current metadata.",
    };
  }
  if (state.latestVerification?.status !== "success") {
    return {
      status: "action",
      ready: false,
      reason: "No successful schema verification receipt is recorded.",
    };
  }
  if (state.latestVerification.contract_version !== REVENUE_SCHEMA_CONTRACT_VERSION) {
    return {
      status: "action",
      ready: false,
      reason: "Schema verification receipt contract version is stale.",
    };
  }
  return { status: "ready", ready: true };
}

export async function verifyRevenueSchemaDataAccess(
  supabase: SupabaseClient,
): Promise<RevenueSchemaDataCheck> {
  const issues: RevenueSchemaIssue[] = [];
  for (const requirement of REVENUE_SCHEMA_TABLES) {
    const { error } = await supabase
      .from(requirement.table)
      .select(requirement.columns.join(","))
      .limit(1);
    if (error)
      issues.push({
        table: requirement.table,
        columns: requirement.columns,
        code: error.code,
        message: error.message,
      });
  }

  const status = classifyRevenueSchemaContractStatus(issues);
  return { status, issues, checkedAt: new Date().toISOString() };
}
