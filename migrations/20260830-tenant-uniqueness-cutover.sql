-- Replace operational global business keys with tenant-composite identity.
-- UUID/share-token primary identities remain globally unguessable by design.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_tenant_client_replay
  ON public.ai_messages (tenant_id, conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_members_tenant_campaign_email
  ON public.campaign_members (tenant_id, campaign_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_steps_tenant_campaign_order
  ON public.campaign_steps (tenant_id, campaign_id, step_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_import_rows_tenant_batch_row
  ON public.contact_import_rows (tenant_id, batch_id, row_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_tenant_external_unique
  ON public.messages (tenant_id, conversation_id, external_id) WHERE external_id IS NOT NULL;

-- Remove obsolete single-tenant indexes after all replacements exist.
DROP INDEX IF EXISTS public.compat_action_queue_pending_dedupe;
DROP INDEX IF EXISTS public.compat_activities_external_unique;
DROP INDEX IF EXISTS public.compat_admin_notifications_unread_dedupe;
DROP INDEX IF EXISTS public.compat_admin_settings_key;
DROP INDEX IF EXISTS public.compat_ai_messages_client_replay;
DROP INDEX IF EXISTS public.compat_calendar_events_provider_external;
DROP INDEX IF EXISTS public.compat_campaign_members_campaign_email;
DROP INDEX IF EXISTS public.compat_campaign_steps_campaign_order;
DROP INDEX IF EXISTS public.compat_companies_domain;
DROP INDEX IF EXISTS public.compat_companies_source_record;
DROP INDEX IF EXISTS public.compat_contact_import_rows_batch_row;
DROP INDEX IF EXISTS public.compat_contacts_primary_email;
DROP INDEX IF EXISTS public.compat_contacts_source_record;
DROP INDEX IF EXISTS public.compat_conversations_channel_external;
DROP INDEX IF EXISTS public.compat_drive_documents_provider_external;
DROP INDEX IF EXISTS public.compat_email_template_draft;
DROP INDEX IF EXISTS public.compat_email_templates_key;
DROP INDEX IF EXISTS public.compat_integration_connections_provider;
DROP INDEX IF EXISTS public.compat_job_runs_claim_key;
DROP INDEX IF EXISTS public.compat_job_runs_active_job;
DROP INDEX IF EXISTS public.compat_job_runs_idempotency;
DROP INDEX IF EXISTS public.compat_messages_external;
DROP INDEX IF EXISTS public.compat_messages_idempotency;
DROP INDEX IF EXISTS public.compat_messages_provider;
DROP INDEX IF EXISTS public.compat_opportunities_source_record;
DROP INDEX IF EXISTS public.compat_subscribers_email;
DROP INDEX IF EXISTS public.compat_tasks_open_dedupe;
DROP INDEX IF EXISTS public.compat_website_events_event_id;
DROP INDEX IF EXISTS public.idx_action_queue_pending_dedupe;
DROP INDEX IF EXISTS public.idx_activities_external_unique;
DROP INDEX IF EXISTS public.idx_admin_notifications_unread_dedupe;
DROP INDEX IF EXISTS public.idx_ai_messages_client_replay;
DROP INDEX IF EXISTS public.idx_companies_domain_unique;
DROP INDEX IF EXISTS public.idx_companies_source_record_unique;
DROP INDEX IF EXISTS public.idx_contacts_primary_email_unique;
DROP INDEX IF EXISTS public.idx_contacts_source_record_unique;
DROP INDEX IF EXISTS public.email_template_one_draft;
DROP INDEX IF EXISTS public.idx_job_runs_claim_key;
DROP INDEX IF EXISTS public.idx_job_runs_one_active_per_job;
DROP INDEX IF EXISTS public.idx_messages_external_unique;
DROP INDEX IF EXISTS public.idx_messages_idempotency_key;
DROP INDEX IF EXISTS public.idx_messages_provider_unique;
DROP INDEX IF EXISTS public.idx_opportunities_source_record_unique;
DROP INDEX IF EXISTS public.idx_tasks_open_dedupe;

ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_provider_external_id_key;
ALTER TABLE public.campaign_members DROP CONSTRAINT IF EXISTS campaign_members_campaign_id_email_key;
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_campaign_id_step_order_key;
ALTER TABLE public.contact_import_rows DROP CONSTRAINT IF EXISTS contact_import_rows_batch_id_row_index_key;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_external_id_key;
ALTER TABLE public.drive_documents DROP CONSTRAINT IF EXISTS drive_documents_provider_external_id_key;
ALTER TABLE public.integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_key;
ALTER TABLE public.job_runs DROP CONSTRAINT IF EXISTS job_runs_idempotency_key_key;
ALTER TABLE public.subscribers DROP CONSTRAINT IF EXISTS subscribers_email_key;

-- These two legacy tables used a business key as their primary key. Preserve
-- the values and upgrade the primary identity in place.
ALTER TABLE public.email_template_versions DROP CONSTRAINT IF EXISTS email_template_versions_template_key_fkey;
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_pkey;
ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_pkey;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.email_templates'::regclass AND conname = 'email_templates_pkey') THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_pkey PRIMARY KEY (tenant_id, template_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.admin_settings'::regclass AND conname = 'admin_settings_pkey') THEN
    ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (tenant_id, key);
  END IF;
END $$;

COMMENT ON CONSTRAINT email_templates_pkey ON public.email_templates IS 'Tenant-composite template identity; template keys may repeat across workspaces.';
COMMENT ON CONSTRAINT admin_settings_pkey ON public.admin_settings IS 'Tenant-composite setting identity; keys may repeat across workspaces.';
