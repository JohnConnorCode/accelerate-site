-- Tenant-owned public intake credentials and provider credential metadata.

ALTER TABLE public.tenant_ingest_keys
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 60
  CHECK (rate_limit_per_minute BETWEEN 1 AND 1000);

DROP POLICY IF EXISTS "Tenant ingest metadata create" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata create" ON public.tenant_ingest_keys FOR INSERT TO authenticated
  WITH CHECK (private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant ingest metadata rotate" ON public.tenant_ingest_keys;
CREATE POLICY "Tenant ingest metadata rotate" ON public.tenant_ingest_keys FOR UPDATE TO authenticated
  USING (private.has_active_tenant_membership(tenant_id))
  WITH CHECK (private.has_active_tenant_membership(tenant_id));
GRANT SELECT, INSERT, UPDATE ON public.tenant_ingest_keys TO authenticated;

ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS encrypted_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  ADD COLUMN IF NOT EXISTS environment_fallback_allowed BOOLEAN NOT NULL DEFAULT false;
UPDATE public.integration_connections
SET environment_fallback_allowed = true
WHERE tenant_id = public.accelerate_default_tenant_id();

-- Event replay identity is tenant-local. Application clients now rewrite the
-- legacy conflict target to (tenant_id,event_id) before this global constraint
-- is removed.
ALTER TABLE public.website_events DROP CONSTRAINT IF EXISTS website_events_event_id_key;

COMMENT ON COLUMN public.integration_connections.encrypted_credentials IS 'Versioned encrypted provider values only; plaintext credentials are forbidden.';
COMMENT ON COLUMN public.integration_connections.environment_fallback_allowed IS 'Temporary migration seam permitted only for the Accelerate tenant.';
COMMENT ON COLUMN public.tenant_ingest_keys.rate_limit_per_minute IS 'Per-key public intake ceiling enforced before tenant mutation.';
