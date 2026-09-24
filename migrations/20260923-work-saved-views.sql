-- Personal task groupings. Filters remain projections over canonical tasks.
CREATE TABLE IF NOT EXISTS public.work_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'workspace')),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 4096),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, owner_id, name)
);
ALTER TABLE public.work_saved_views
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_saved_views_visibility_check'
      AND conrelid = 'public.work_saved_views'::regclass
  ) THEN
    ALTER TABLE public.work_saved_views
      ADD CONSTRAINT work_saved_views_visibility_check CHECK (visibility IN ('private', 'workspace'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS work_saved_views_owner ON public.work_saved_views(tenant_id, owner_id, updated_at DESC);
ALTER TABLE public.work_saved_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_saved_views FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_saved_views TO authenticated;
GRANT ALL ON public.work_saved_views TO service_role;
DROP POLICY IF EXISTS work_saved_views_private ON public.work_saved_views;
CREATE POLICY work_saved_views_read ON public.work_saved_views FOR SELECT TO authenticated
USING (
  tenant_id = private.request_tenant_id()
  AND private.has_active_tenant_membership(tenant_id)
  AND (owner_id = (SELECT auth.uid()) OR visibility = 'workspace')
);
CREATE POLICY work_saved_views_insert ON public.work_saved_views FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = private.request_tenant_id()
  AND private.has_active_tenant_membership(tenant_id)
  AND owner_id = (SELECT auth.uid())
);
CREATE POLICY work_saved_views_update ON public.work_saved_views FOR UPDATE TO authenticated
USING (
  tenant_id = private.request_tenant_id()
  AND private.has_active_tenant_membership(tenant_id)
  AND owner_id = (SELECT auth.uid())
)
WITH CHECK (
  tenant_id = private.request_tenant_id()
  AND private.has_active_tenant_membership(tenant_id)
  AND owner_id = (SELECT auth.uid())
);
CREATE POLICY work_saved_views_delete ON public.work_saved_views FOR DELETE TO authenticated
USING (
  tenant_id = private.request_tenant_id()
  AND private.has_active_tenant_membership(tenant_id)
  AND owner_id = (SELECT auth.uid())
);
