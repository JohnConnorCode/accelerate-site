-- =============================================================================
-- Accelerate Revenue OS
-- Canonical founder-operated CRM, conversations, campaigns, approvals, health,
-- and integration foundation. Safe to re-run.
--
-- Run after migrations/roofing-booking-machine.sql. This migration deliberately
-- extends the existing opportunities/tasks/proposals tables so the current
-- funnel keeps working while the admin moves to the canonical services.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  primary_email TEXT,
  alternate_emails TEXT[] NOT NULL DEFAULT '{}',
  phone TEXT,
  title TEXT,
  company_id UUID,
  lifecycle_stage TEXT NOT NULL DEFAULT 'prospect',
  communication_status TEXT NOT NULL DEFAULT 'active',
  last_interaction_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  next_action TEXT,
  source TEXT,
  source_record_type TEXT,
  source_record_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_primary_email_unique
  ON contacts (lower(primary_email)) WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_source_record_unique
  ON contacts (source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_next_action ON contacts(next_action_at)
  WHERE next_action_at IS NOT NULL AND communication_status = 'active';

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  industry TEXT,
  size_band TEXT,
  location TEXT,
  research_summary TEXT,
  qualification JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  source_record_type TEXT,
  source_record_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_domain_unique
  ON companies (lower(domain)) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_source_record_unique
  ON companies (source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The roofing migration may already have created this table. The relaxed legacy
-- fields let all industries and repeat opportunities share the same pipeline.
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  company_website TEXT,
  role TEXT,
  revenue_band TEXT,
  primary_leak TEXT,
  qualified BOOLEAN NOT NULL DEFAULT false,
  qualifier_token TEXT UNIQUE,
  stage TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE opportunities ALTER COLUMN email DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN company_website DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN role DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN revenue_band DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN primary_leak DROP NOT NULL;
ALTER TABLE opportunities ALTER COLUMN qualifier_token DROP NOT NULL;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_email_key;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS pipeline TEXT NOT NULL DEFAULT 'sales';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_detail TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_record_type TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_record_id UUID;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS estimated_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS won_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS probability SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_check CHECK (
    stage IN ('new','contacted','qualified','meeting','proposal','negotiation','won','lost','nurture','calendar_viewed','booked','showed','no_show')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT opportunities_probability_check CHECK (probability BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_source_record_unique
  ON opportunities(source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline_stage ON opportunities(pipeline, stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_action ON opportunities(next_action_at)
  WHERE next_action_at IS NOT NULL AND stage NOT IN ('won', 'lost');

CREATE TABLE IF NOT EXISTS stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_email TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stage_events_opportunity ON stage_events(opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('gmail','resend','form','chat','manual')),
  external_id TEXT,
  subject TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  campaign_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting','resolved','archived')),
  intent TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel, external_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_id TEXT,
  provider_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_email TEXT,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  in_reply_to TEXT,
  references_header TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_unique
  ON messages(conversation_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_unique
  ON messages(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','paused','completed','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  approved_version INTEGER,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  sender_name TEXT,
  sender_email TEXT,
  audience_definition JSONB NOT NULL DEFAULT '{}',
  policy JSONB NOT NULL DEFAULT '{"daily_limit":25,"stop_on_reply":true,"stop_on_booking":true,"stop_on_bounce":true,"stop_on_unsubscribe":true}',
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','active','replied','booked','converted','bounced','unsubscribed','stopped','completed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  stop_reason TEXT,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_campaign_members_due ON campaign_members(next_send_at)
  WHERE status IN ('queued','active') AND next_send_at IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT opportunities_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  proposal_id UUID,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  actor_email TEXT,
  external_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_external_unique
  ON activities(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON activities(opportunity_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('critical','high','normal','low')),
  payload JSONB NOT NULL DEFAULT '{}',
  reasoning TEXT,
  source_context TEXT,
  entity_type TEXT,
  entity_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','executed','rejected','failed','expired')),
  dedupe_key TEXT,
  proposed_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_queue_pending_dedupe
  ON action_queue(dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_action_queue_pending ON action_queue(urgency, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface TEXT NOT NULL DEFAULT 'admin_command',
  actor_email TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  prompt_preview TEXT,
  tool_names TEXT[] NOT NULL DEFAULT '{}',
  input_tokens INTEGER,
  output_tokens INTEGER,
  result_preview TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  input JSONB,
  output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_run ON agent_run_events(run_id, created_at);

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  account_email TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','degraded','revoked')),
  settings JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'google',
  external_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  status TEXT,
  html_link TEXT,
  attendees JSONB NOT NULL DEFAULT '[]',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);

CREATE TABLE IF NOT EXISTS drive_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'google',
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  web_view_link TEXT,
  modified_at TIMESTAMPTZ,
  folder_id TEXT,
  extracted_text TEXT,
  content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_drive_documents_folder ON drive_documents(folder_id, modified_at DESC);

CREATE TABLE IF NOT EXISTS source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed','not_configured')),
  cursor JSONB,
  summary JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_source_runs_latest ON source_runs(source_key, started_at DESC);

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed','skipped')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_job_runs_latest ON job_runs(job_key, claimed_at DESC);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  payload_hash TEXT,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_related_type_check;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_open_dedupe
  ON tasks(dedupe_key) WHERE dedupe_key IS NOT NULL AND status <> 'completed';

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
DO $$ BEGIN
  ALTER TABLE proposals ADD CONSTRAINT proposals_status_check CHECK (
    status IN ('draft','sent','viewed','accepted','declined','expired','superseded')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS proposal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent','viewed','accepted','declined','expired','superseded')),
  source TEXT NOT NULL DEFAULT 'public_link',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_events_proposal ON proposal_events(proposal_id, created_at DESC);

DO $$ BEGIN
  ALTER TABLE activities
    ADD CONSTRAINT activities_proposal_id_fkey FOREIGN KEY (proposal_id)
    REFERENCES proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Import existing solution requests as canonical contacts/companies/opportunities.
INSERT INTO companies (name, domain, website, industry, source, source_record_type, source_record_id)
SELECT
  COALESCE(NULLIF(sr.business_name, ''), NULLIF(split_part(sr.contact_email, '@', 2), ''), 'Unknown company'),
  NULLIF(lower(split_part(sr.contact_email, '@', 2)), ''),
  NULL,
  sr.industry,
  'inbound',
  'solution_request',
  sr.id
FROM solution_requests sr
ON CONFLICT (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL
DO NOTHING;

INSERT INTO contacts (full_name, primary_email, phone, company_id, source, source_record_type, source_record_id, metadata)
SELECT
  COALESCE(NULLIF(sr.contact_name, ''), sr.contact_email),
  lower(sr.contact_email),
  sr.contact_phone,
  c.id,
  'inbound',
  'solution_request',
  sr.id,
  jsonb_build_object('legacy_share_token', sr.share_token)
FROM solution_requests sr
LEFT JOIN companies c ON c.source_record_type = 'solution_request' AND c.source_record_id = sr.id
ON CONFLICT (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL
DO NOTHING;

INSERT INTO opportunities (
  name, contact_id, company_id, email, stage, source, source_record_type,
  source_record_id, estimated_value, next_action, metadata
)
SELECT
  COALESCE(NULLIF(sr.business_name, ''), NULLIF(sr.contact_name, ''), sr.contact_email),
  ct.id,
  co.id,
  lower(sr.contact_email),
  CASE sr.lead_status
    WHEN 'new' THEN 'new' WHEN 'contacted' THEN 'contacted'
    WHEN 'qualified' THEN 'qualified' WHEN 'proposal' THEN 'proposal'
    WHEN 'won' THEN 'won' ELSE 'new' END,
  'inbound',
  'solution_request',
  sr.id,
  COALESCE(sr.estimated_value, 0),
  NULL,
  jsonb_build_object('legacy_status', sr.status, 'legacy_lead_status', sr.lead_status)
FROM solution_requests sr
LEFT JOIN contacts ct ON ct.source_record_type = 'solution_request' AND ct.source_record_id = sr.id
LEFT JOIN companies co ON co.source_record_type = 'solution_request' AND co.source_record_id = sr.id
ON CONFLICT (source_record_type, source_record_id) WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL
DO NOTHING;

-- Founder data is reached through authenticated server routes. New canonical
-- tables intentionally expose no blanket authenticated policies.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'contacts','companies','opportunities','stage_events','conversations','messages',
    'campaigns','campaign_steps','campaign_members','activities','action_queue','agent_runs','agent_run_events',
    'integration_connections','calendar_events','drive_documents','proposal_events','source_runs','job_runs','webhook_receipts','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', table_name);
    EXECUTE format('CREATE POLICY "Service role full access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated opportunities" ON opportunities;
DROP POLICY IF EXISTS "Authenticated opportunity events" ON opportunity_stage_events;
DROP POLICY IF EXISTS "Authenticated full access" ON tasks;
DROP POLICY IF EXISTS "Authenticated full access" ON clients;
DROP POLICY IF EXISTS "Authenticated read" ON sent_emails;
DROP POLICY IF EXISTS "Authenticated full access" ON proposals;

CREATE OR REPLACE FUNCTION revenue_os_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts','companies','opportunities','conversations','campaigns','campaign_steps','campaign_members','action_queue','integration_connections','calendar_events','drive_documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_touch_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at()', table_name || '_touch_updated_at', table_name);
  END LOOP;
END $$;
