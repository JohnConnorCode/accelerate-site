-- =============================================================================
-- Brain source authority registry (brain-source-authority card).
--
-- Maps each connected system to the truth domains it owns, with an explicit
-- authority tier, owner, last-verified date and applies-to scope. Authority is
-- configured, never inferred from volume or recency. Unregistered sources fail
-- closed to low authority.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.source_authority_registry (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  system_key               TEXT NOT NULL,
  display_name             TEXT NOT NULL,
  truth_domains            TEXT[] NOT NULL,
  authority_tier           TEXT NOT NULL
                           CHECK (authority_tier IN ('official','approved','working','low')),
  owner_email              TEXT NOT NULL,
  last_verified_at         TIMESTAMPTZ NOT NULL,
  verification_lapse_days  INTEGER NOT NULL DEFAULT 90
                           CHECK (verification_lapse_days >= 1 AND verification_lapse_days <= 3650),
  applies_to               JSONB,
  request_key              TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(truth_domains) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_authority_tenant_system
  ON public.source_authority_registry (tenant_id, system_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_authority_tenant_request
  ON public.source_authority_registry (tenant_id, request_key);
CREATE INDEX IF NOT EXISTS idx_source_authority_tenant_tier
  ON public.source_authority_registry (tenant_id, authority_tier, system_key);

ALTER TABLE public.source_authority_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.source_authority_registry;
CREATE POLICY "Service role full access" ON public.source_authority_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.source_authority_registry;
CREATE POLICY "Tenant member access" ON public.source_authority_registry
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
