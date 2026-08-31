-- Production rollout hold only; intentionally excluded from clean-install
-- order. Recreate legacy conflict targets while the pre-tenant application is
-- still deployed. The final uniqueness cutover drops every compat index after
-- the tenant-aware application release.

CREATE UNIQUE INDEX IF NOT EXISTS compat_action_queue_pending_dedupe ON public.action_queue (dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS compat_activities_external_unique ON public.activities (source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_admin_notifications_unread_dedupe ON public.admin_notifications (dedupe_key) WHERE dedupe_key IS NOT NULL AND read = false;
CREATE UNIQUE INDEX IF NOT EXISTS compat_admin_settings_key ON public.admin_settings (key);
CREATE UNIQUE INDEX IF NOT EXISTS compat_ai_messages_client_replay ON public.ai_messages (conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_calendar_events_provider_external ON public.calendar_events (provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS compat_campaign_members_campaign_email ON public.campaign_members (campaign_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS compat_campaign_steps_campaign_order ON public.campaign_steps (campaign_id, step_order);
CREATE UNIQUE INDEX IF NOT EXISTS compat_companies_domain ON public.companies (lower(domain)) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_companies_source_record ON public.companies (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_contact_import_rows_batch_row ON public.contact_import_rows (batch_id, row_index);
CREATE UNIQUE INDEX IF NOT EXISTS compat_contacts_primary_email ON public.contacts (lower(primary_email)) WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_contacts_source_record ON public.contacts (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_conversations_channel_external ON public.conversations (channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS compat_drive_documents_provider_external ON public.drive_documents (provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS compat_email_template_draft ON public.email_template_versions (template_key) WHERE state = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS compat_email_templates_key ON public.email_templates (template_key);
CREATE UNIQUE INDEX IF NOT EXISTS compat_integration_connections_provider ON public.integration_connections (provider);
CREATE UNIQUE INDEX IF NOT EXISTS compat_job_runs_claim_key ON public.job_runs (claim_key) WHERE claim_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_job_runs_active_job ON public.job_runs (job_key) WHERE status = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS compat_job_runs_idempotency ON public.job_runs (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS compat_messages_external ON public.messages (conversation_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_messages_idempotency ON public.messages (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_messages_provider ON public.messages (provider_id) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_opportunities_source_record ON public.opportunities (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compat_subscribers_email ON public.subscribers (email);
CREATE UNIQUE INDEX IF NOT EXISTS compat_tasks_open_dedupe ON public.tasks (dedupe_key) WHERE dedupe_key IS NOT NULL AND status <> 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS compat_website_events_event_id ON public.website_events (event_id);

