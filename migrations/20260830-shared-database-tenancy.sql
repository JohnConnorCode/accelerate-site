-- =============================================================================
-- Shared-database tenant control plane and bootstrap tenant ownership backfill.
--
-- Additive compatibility migration. Existing application writers continue to
-- resolve to the bootstrap tenant through a temporary column default. The
-- tenant authorization cutover removes those defaults after every writer sends
-- an explicit TenantActor or TenantSystemContext.
--
-- The bootstrap tenant's identity fields (brand, founder, AI voice, booking)
-- below are BOOTSTRAP_* token placeholders, resolved from environment
-- variables by scripts/lib/bootstrap-identity.mjs when this file is applied
-- through npm run db:migrate / db:migrate:all. Unset, they default to the
-- reference Accelerate deployment's own values. Set BOOTSTRAP_BRAND_NAME,
-- BOOTSTRAP_FOUNDER_EMAIL, etc. (see .env.example) before running migrations
-- on a fresh project so your fork does not inherit Accelerate's identity.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning','active','suspended','archived')),
  config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_memberships_email_open
  ON public.tenant_memberships (tenant_id, lower(invited_email))
  WHERE status IN ('invited','active');
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_active
  ON public.tenant_memberships (user_id, tenant_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.tenant_ingest_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  key_prefix TEXT NOT NULL CHECK (char_length(key_prefix) BETWEEN 8 AND 32),
  token_digest BYTEA NOT NULL UNIQUE,
  surfaces TEXT[] NOT NULL DEFAULT '{}',
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tenant_ingest_keys_tenant_active
  ON public.tenant_ingest_keys (tenant_id, created_at DESC) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant_created
  ON public.platform_audit_log (tenant_id, created_at DESC);

-- Stable bootstrap identity. This UUID is source-controlled so an idempotent
-- rerun, a scratch database, and the production backfill all resolve the same
-- default tenant without inspecting business rows or email addresses.
INSERT INTO public.tenants (id, slug, name, status, config_version, config)
VALUES (
  'acce1e8e-0000-4000-8000-000000000001'::uuid,
  'accelerate',
  'Accelerate',
  'active',
  1,
  jsonb_build_object(
    'brand', jsonb_build_object(
      'name', '__BOOTSTRAP_BRAND_NAME__',
      'domain', '__BOOTSTRAP_BRAND_DOMAIN__',
      'siteUrl', '__BOOTSTRAP_BRAND_SITE_URL__',
      'logoMark', 'A',
      'accentColor', '__BOOTSTRAP_BRAND_ACCENT_COLOR__',
      'tagline', '__BOOTSTRAP_BRAND_TAGLINE__',
      'emailFooter', '__BOOTSTRAP_BRAND_EMAIL_FOOTER__'
    ),
    'founder', jsonb_build_object(
      'name', '__BOOTSTRAP_FOUNDER_NAME__',
      'fullName', '__BOOTSTRAP_FOUNDER_FULL_NAME__',
      'email', '__BOOTSTRAP_FOUNDER_EMAIL__',
      'systemActorEmail', '__BOOTSTRAP_SYSTEM_ACTOR_EMAIL__'
    ),
    'capabilities', jsonb_build_object('publicBooking', true),
    'ai', jsonb_build_object(
      'businessDescriptor', '__BOOTSTRAP_AI_DESCRIPTOR__',
      'voice', '__BOOTSTRAP_AI_VOICE__',
      'positioning', '__BOOTSTRAP_AI_POSITIONING__'
    ),
    'booking', jsonb_build_object(
      'url', '__BOOTSTRAP_BOOKING_URL__',
      'path', '__BOOTSTRAP_BOOKING_PATH__',
      'schedulerUrl', '__BOOTSTRAP_SCHEDULER_URL__'
    ),
    'pipeline', jsonb_build_object('stageLabels', '{}'::jsonb),
    'playbooks', jsonb_build_array(jsonb_build_object(
      'key', 'roofing',
      'label', 'Roofing',
      'industry', 'roofing',
      'sourceTag', 'roofing_qualifier',
      'path', '/roofing',
      'nextAction', 'Respond to qualified roofing audit request'
    )),
    'external', jsonb_build_object(
      'vercelProjectUrl', NULL,
      'supabaseProjectRef', NULL
    )
  )
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  status = 'active',
  config = CASE WHEN public.tenants.config = '{}'::jsonb THEN EXCLUDED.config ELSE public.tenants.config END,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.accelerate_default_tenant_id()
RETURNS UUID LANGUAGE sql IMMUTABLE
AS $$ SELECT 'acce1e8e-0000-4000-8000-000000000001'::uuid $$;
REVOKE ALL ON FUNCTION public.accelerate_default_tenant_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerate_default_tenant_id() TO service_role;

-- Every existing and ordered-future operational table belongs to one tenant.
-- Tables absent from a particular installation are skipped safely.
DO $$
DECLARE
  operational_table_name TEXT;
  operational_tables CONSTANT TEXT[] := ARRAY[
    'action_queue','activities','admin_notifications','admin_settings',
    'agent_run_events','agent_runs','ai_conversations','ai_messages','audit_log',
    'calendar_events','calendly_webhook_receipts','campaign_members','campaign_steps','campaigns',
    'chat_leads','clients','companies','contact_import_batches','contact_import_events',
    'contact_import_rows','contact_submissions','contacts','content_calendar','conversations',
    'drive_documents','email_sequence_logs','email_sequences','email_template_versions','email_templates',
    'integration_connections','job_runs','messages','opportunities','opportunity_stage_events',
    'partner_applications','plan_views','proposal_events','proposals','recovery_candidates',
    'recovery_outcomes','recovery_playbooks','resource_downloads','roi_calculations','sent_emails',
    'solution_requests','source_runs','stage_events','subscribers','tasks','webhook_receipts',
    'website_events','website_grades'
  ];
BEGIN
  FOREACH operational_table_name IN ARRAY operational_tables LOOP
    IF to_regclass(format('public.%I', operational_table_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID', operational_table_name);
    EXECUTE format('UPDATE public.%I SET tenant_id = public.accelerate_default_tenant_id() WHERE tenant_id IS NULL', operational_table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.accelerate_default_tenant_id()', operational_table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', operational_table_name);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', operational_table_name)::regclass
        AND conname = operational_table_name || '_tenant_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT',
        operational_table_name, operational_table_name || '_tenant_id_fkey'
      );
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns AS column_info
      WHERE column_info.table_schema = 'public'
        AND column_info.table_name = operational_table_name
        AND column_info.column_name = 'id'
    ) THEN
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, id)',
        'idx_' || operational_table_name || '_tenant_id_id', operational_table_name
      );
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', operational_table_name);
  END LOOP;
END $$;

-- Compatibility-safe tenant-composite business keys. The global constraints
-- stay in place until the application cutover changes every onConflict target;
-- the final isolation migration then removes only those obsolete globals.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_primary_email_unique
  ON public.contacts (tenant_id, lower(primary_email)) WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_source_record_unique
  ON public.contacts (tenant_id, source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tenant_domain_unique
  ON public.companies (tenant_id, lower(domain)) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tenant_source_record_unique
  ON public.companies (tenant_id, source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_tenant_source_record_unique
  ON public.opportunities (tenant_id, source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_tenant_external_unique
  ON public.conversations (tenant_id, channel, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_tenant_provider_unique
  ON public.messages (tenant_id, provider_id) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_tenant_idempotency_unique
  ON public.messages (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_tenant_external_unique
  ON public.activities (tenant_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_queue_tenant_pending_dedupe
  ON public.action_queue (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_tenant_open_dedupe
  ON public.tasks (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND status <> 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_connections_tenant_provider
  ON public.integration_connections (tenant_id, provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_tenant_provider_external
  ON public.calendar_events (tenant_id, provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_documents_tenant_provider_external
  ON public.drive_documents (tenant_id, provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_tenant_claim_key
  ON public.job_runs (tenant_id, claim_key) WHERE claim_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_tenant_active_job
  ON public.job_runs (tenant_id, job_key) WHERE status = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_tenant_idempotency
  ON public.job_runs (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_receipts_tenant_provider_id
  ON public.webhook_receipts (tenant_id, provider, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_events_tenant_event_id
  ON public.website_events (tenant_id, event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_tenant_unread_dedupe
  ON public.admin_notifications (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND read = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_tenant_email
  ON public.subscribers (tenant_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_settings_tenant_key
  ON public.admin_settings (tenant_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_tenant_key
  ON public.email_templates (tenant_id, template_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_template_versions_tenant_draft
  ON public.email_template_versions (tenant_id, template_key) WHERE state = 'draft';

-- Add tenant-composite foreign keys alongside the existing ID-only constraints.
-- Keeping both is compatibility-safe; the composite constraint is the boundary.
DO $$
DECLARE
  relationship RECORD;
BEGIN
  FOR relationship IN
    SELECT * FROM (VALUES
      ('activities','campaign_id','campaigns','id','SET NULL'),
      ('activities','company_id','companies','id','SET NULL'),
      ('activities','contact_id','contacts','id','SET NULL'),
      ('activities','conversation_id','conversations','id','SET NULL'),
      ('activities','opportunity_id','opportunities','id','SET NULL'),
      ('activities','proposal_id','proposals','id','SET NULL'),
      ('agent_run_events','run_id','agent_runs','id','CASCADE'),
      ('agent_runs','conversation_id','ai_conversations','id','SET NULL'),
      ('ai_messages','conversation_id','ai_conversations','id','CASCADE'),
      ('ai_messages','run_id','agent_runs','id','SET NULL'),
      ('calendar_events','contact_id','contacts','id','SET NULL'),
      ('calendar_events','opportunity_id','opportunities','id','SET NULL'),
      ('campaign_members','campaign_id','campaigns','id','CASCADE'),
      ('campaign_members','contact_id','contacts','id','SET NULL'),
      ('campaign_members','opportunity_id','opportunities','id','SET NULL'),
      ('campaign_steps','campaign_id','campaigns','id','CASCADE'),
      ('clients','lead_id','solution_requests','id','NO ACTION'),
      ('contact_import_events','batch_id','contact_import_batches','id','CASCADE'),
      ('contact_import_events','row_id','contact_import_rows','id','SET NULL'),
      ('contact_import_rows','batch_id','contact_import_batches','id','CASCADE'),
      ('contact_import_rows','imported_company_id','companies','id','SET NULL'),
      ('contact_import_rows','imported_contact_id','contacts','id','SET NULL'),
      ('contact_import_rows','matched_company_id','companies','id','SET NULL'),
      ('contact_import_rows','matched_contact_id','contacts','id','SET NULL'),
      ('contacts','company_id','companies','id','SET NULL'),
      ('conversations','campaign_id','campaigns','id','SET NULL'),
      ('conversations','company_id','companies','id','SET NULL'),
      ('conversations','contact_id','contacts','id','SET NULL'),
      ('conversations','opportunity_id','opportunities','id','SET NULL'),
      ('email_sequence_logs','sequence_id','email_sequences','id','CASCADE'),
      ('email_template_versions','template_key','email_templates','template_key','CASCADE'),
      ('email_templates','current_published_version','email_template_versions','id','SET NULL'),
      ('messages','conversation_id','conversations','id','CASCADE'),
      ('opportunities','campaign_id','campaigns','id','SET NULL'),
      ('opportunities','company_id','companies','id','SET NULL'),
      ('opportunities','contact_id','contacts','id','SET NULL'),
      ('opportunity_stage_events','opportunity_id','opportunities','id','CASCADE'),
      ('plan_views','solution_request_id','solution_requests','id','CASCADE'),
      ('proposal_events','proposal_id','proposals','id','CASCADE'),
      ('proposals','company_id','companies','id','SET NULL'),
      ('proposals','contact_id','contacts','id','SET NULL'),
      ('proposals','lead_id','solution_requests','id','NO ACTION'),
      ('proposals','opportunity_id','opportunities','id','SET NULL'),
      ('proposals','sent_message_id','messages','id','SET NULL'),
      ('stage_events','opportunity_id','opportunities','id','CASCADE'),
      ('tasks','company_id','companies','id','SET NULL'),
      ('tasks','contact_id','contacts','id','SET NULL'),
      ('tasks','opportunity_id','opportunities','id','SET NULL')
    ) AS links(child_table, child_column, parent_table, parent_column, delete_action)
  LOOP
    IF to_regclass(format('public.%I', relationship.child_table)) IS NULL
      OR to_regclass(format('public.%I', relationship.parent_table)) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = relationship.child_table AND column_name = relationship.child_column
    ) THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', relationship.child_table)::regclass
        AND conname = relationship.child_table || '_' || relationship.child_column || '_tenant_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, %I) REFERENCES public.%I (tenant_id, %I) ON DELETE %s',
        relationship.child_table,
        relationship.child_table || '_' || relationship.child_column || '_tenant_fkey',
        relationship.child_column,
        relationship.parent_table,
        relationship.parent_column,
        relationship.delete_action
      );
    END IF;
  END LOOP;
END $$;

-- The source-config founder becomes the initial active member when that Auth
-- account already exists. A later bootstrap command reconciles ADMIN_EMAIL when
-- deployment configuration intentionally differs from the public founder email.
INSERT INTO public.tenant_memberships (
  tenant_id, user_id, invited_email, role, status, activated_at
)
SELECT tenant.id, auth_user.id, auth_user.email, 'admin', 'active', now()
FROM public.tenants AS tenant
JOIN auth.users AS auth_user
  ON lower(auth_user.email) = lower(tenant.config #>> '{founder,email}')
WHERE tenant.slug = 'accelerate'
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  invited_email = EXCLUDED.invited_email,
  status = 'active',
  activated_at = COALESCE(public.tenant_memberships.activated_at, now()),
  revoked_at = NULL,
  updated_at = now();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.request_tenant_id()
RETURNS UUID
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  raw_value TEXT;
BEGIN
  raw_value := current_setting('request.headers', true)::jsonb ->> 'x-tenant-id';
  IF raw_value IS NULL OR raw_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN raw_value::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.has_active_tenant_membership(requested_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships AS membership
    JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
    WHERE membership.tenant_id = requested_tenant
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND tenant.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION private.request_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_active_tenant_membership(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.request_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_active_tenant_membership(UUID) TO authenticated, service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ingest_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member tenant read" ON public.tenants;
CREATE POLICY "Member tenant read" ON public.tenants FOR SELECT TO authenticated
  USING (private.has_active_tenant_membership(id));
DROP POLICY IF EXISTS "Own membership read" ON public.tenant_memberships;
CREATE POLICY "Own membership read" ON public.tenant_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Tenant ingest metadata read" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata read" ON public.tenant_ingest_keys FOR SELECT TO authenticated
  USING (private.has_active_tenant_membership(tenant_id));

GRANT SELECT ON public.tenants, public.tenant_memberships, public.tenant_ingest_keys TO authenticated;
GRANT ALL ON public.tenants, public.tenant_memberships, public.tenant_ingest_keys, public.platform_audit_log TO service_role;

-- Direct authenticated data access is narrowed to one explicit requested tenant.
-- Existing server API routes still use service_role and are unaffected until the
-- tenant-context card deliberately moves them to authenticated clients.
DO $$
DECLARE
  table_name TEXT;
  policy_row RECORD;
  operational_tables CONSTANT TEXT[] := ARRAY[
    'action_queue','activities','admin_notifications','admin_settings',
    'agent_run_events','agent_runs','ai_conversations','ai_messages','audit_log',
    'calendar_events','calendly_webhook_receipts','campaign_members','campaign_steps','campaigns',
    'chat_leads','clients','companies','contact_import_batches','contact_import_events',
    'contact_import_rows','contact_submissions','contacts','content_calendar','conversations',
    'drive_documents','email_sequence_logs','email_sequences','email_template_versions','email_templates',
    'integration_connections','job_runs','messages','opportunities','opportunity_stage_events',
    'partner_applications','plan_views','proposal_events','proposals','recovery_candidates',
    'recovery_outcomes','recovery_playbooks','resource_downloads','roi_calculations','sent_emails',
    'solution_requests','source_runs','stage_events','subscribers','tasks','webhook_receipts',
    'website_events','website_grades'
  ];
BEGIN
  FOREACH table_name IN ARRAY operational_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies AS policy_source
      WHERE policy_source.schemaname = 'public'
        AND policy_source.tablename = table_name
        AND NOT ('service_role' = ANY (roles))
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS "Tenant member access" ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY "Tenant member access" ON public.%I FOR ALL TO authenticated USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)) WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

COMMENT ON TABLE public.tenants IS 'Shared-database tenant registry. Config is validated by the application before use.';
COMMENT ON TABLE public.tenant_memberships IS 'Founder-managed tenant admin memberships; status changes take effect through RLS immediately.';
COMMENT ON TABLE public.tenant_ingest_keys IS 'Hashed, rotatable public intake credentials. Raw credentials are shown once and never stored.';
COMMENT ON TABLE public.platform_audit_log IS 'Founder-only audit history for tenant and membership lifecycle changes.';
COMMENT ON FUNCTION private.request_tenant_id() IS 'Fail-closed tenant selector read from the PostgREST x-tenant-id request header.';
COMMENT ON FUNCTION private.has_active_tenant_membership(UUID) IS 'Immediate tenant authorization check against active membership and tenant state.';
