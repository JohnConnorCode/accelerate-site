-- Form builder plugin state. Definitions are tenant-owned drafts until
-- published; submissions are immutable guest evidence reviewed in the admin.
CREATE TABLE IF NOT EXISTS public.form_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 120),
 description text NOT NULL DEFAULT '' CHECK(char_length(description) <= 2000),
 schema jsonb NOT NULL DEFAULT '{"elements":[]}'::jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 share_token text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 UNIQUE(tenant_id,id), UNIQUE(share_token)
);
CREATE TABLE IF NOT EXISTS public.form_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 form_id uuid NOT NULL, response jsonb NOT NULL DEFAULT '{}'::jsonb,
 contact_name text, contact_email text,
 status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','accepted','rejected')),
 reviewer_email text, reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,form_id) REFERENCES public.form_definitions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.form_submission_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), request_id uuid NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,request_id)
);
CREATE INDEX IF NOT EXISTS form_submissions_form_idx ON public.form_submissions(tenant_id,form_id,created_at DESC);
CREATE INDEX IF NOT EXISTS form_definitions_tenant_idx ON public.form_definitions(tenant_id,updated_at DESC);
-- RLS on: anonymous and authenticated app users reach these rows only
-- through the tenant-scoped policies below. service_role bypasses RLS and
-- performs all writes through the tenant-bound domain service, the same
-- shape as contact_submissions.
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['form_definitions','form_submissions','form_submission_commands'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('DROP POLICY IF EXISTS form_builder_tenant_read ON public.%I',n);
  EXECUTE format('CREATE POLICY form_builder_tenant_read ON public.%I FOR SELECT TO authenticated,service_role USING (tenant_id=private.authorized_request_tenant_id())',n);
 END LOOP;
END $$;
