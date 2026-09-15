-- Repair tenant isolation after legacy policies were left alongside the
-- shared-database tenancy policy. The broad authenticated policies below grant
-- access to every tenant row when RLS combines policies with OR.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_notifications',
        'admin_settings',
        'clients',
        'opportunities',
        'opportunity_stage_events',
        'proposals',
        'sent_emails',
        'tasks'
      )
      AND 'authenticated' = ANY (roles)
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END $$;

-- Intake-key metadata is tenant-owned too. Membership alone would expose
-- every tenant's key metadata to a user who belongs to one tenant.
DROP POLICY IF EXISTS "Tenant ingest metadata read" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata read" ON public.tenant_ingest_keys
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

DROP POLICY IF EXISTS "Tenant ingest metadata create" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata create" ON public.tenant_ingest_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

DROP POLICY IF EXISTS "Tenant ingest metadata rotate" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata rotate" ON public.tenant_ingest_keys
  FOR UPDATE TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );
