BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.accelerate_default_tenant_id() REFERENCES public.tenants(id),
  session_token text NOT NULL UNIQUE CHECK (session_token ~ '^[A-Za-z0-9_-]{32,96}$'),
  report_token text UNIQUE CHECK (report_token IS NULL OR report_token ~ '^[A-Za-z0-9_-]{32,96}$'),
  version text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'previewed', 'unlocked', 'completed')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) <= 20000),
  profile jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(profile) = 'object' AND pg_column_size(profile) <= 8000),
  score integer CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  coverage integer NOT NULL DEFAULT 0 CHECK (coverage BETWEEN 0 AND 100),
  dimension_scores jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dimension_scores) = 'array'),
  name text CHECK (name IS NULL OR length(name) BETWEEN 1 AND 160),
  email text CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254),
  business_name text CHECK (business_name IS NULL OR length(business_name) BETWEEN 1 AND 160),
  consent_given boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer_host text,
  contact_id uuid,
  opportunity_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  previewed_at timestamptz,
  unlocked_at timestamptz,
  completed_at timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES public.contacts(tenant_id, id),
  FOREIGN KEY (tenant_id, opportunity_id) REFERENCES public.opportunities(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS ai_readiness_assessments_tenant_created
  ON public.ai_readiness_assessments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_readiness_assessments_email
  ON public.ai_readiness_assessments(tenant_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_readiness_assessments_campaign
  ON public.ai_readiness_assessments(tenant_id, utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_readiness_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.accelerate_default_tenant_id() REFERENCES public.tenants(id),
  assessment_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  report jsonb NOT NULL CHECK (jsonb_typeof(report) = 'object' AND pg_column_size(report) <= 60000),
  ai_status text NOT NULL DEFAULT 'rules' CHECK (ai_status IN ('rules', 'enriched', 'failed')),
  ai_request_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, assessment_id, revision),
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.ai_readiness_assessments(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS ai_readiness_reports_lookup
  ON public.ai_readiness_reports(tenant_id, assessment_id, revision DESC);

ALTER TABLE public.ai_readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_readiness_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_readiness_assessment_admin_read ON public.ai_readiness_assessments;
CREATE POLICY ai_readiness_assessment_admin_read ON public.ai_readiness_assessments
  FOR SELECT TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

DROP POLICY IF EXISTS ai_readiness_report_admin_read ON public.ai_readiness_reports;
CREATE POLICY ai_readiness_report_admin_read ON public.ai_readiness_reports
  FOR SELECT TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

GRANT SELECT ON public.ai_readiness_assessments, public.ai_readiness_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_readiness_assessments TO service_role;
GRANT SELECT, INSERT ON public.ai_readiness_reports TO service_role;

COMMIT;
