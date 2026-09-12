-- =============================================================================
-- Brain source authority (brain-source-authority card).
--
-- Registry mapping each connected system to the truth domains it owns, with
-- authority tier, owner, last verification and applies-to scope. Retrieval
-- orders and tags context by tier; conflicts flag instead of resolving
-- silently; stale entries surface instead of serving as current.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.source_authorities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  source_key         TEXT NOT NULL,
  truth_domains      TEXT[] NOT NULL DEFAULT '{}',
  authority          TEXT NOT NULL DEFAULT 'working'
                     CHECK (authority IN ('official','approved','working','historical')),
  owner_email        TEXT,
  last_verified_at   TIMESTAMPTZ,
  applies_to         JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_authorities_tenant_id_id
  ON public.source_authorities (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_authorities_registry_key
  ON public.source_authorities (tenant_id, source_key);
CREATE INDEX IF NOT EXISTS idx_source_authorities_domains
  ON public.source_authorities USING GIN (truth_domains);

DROP POLICY IF EXISTS "Service role full access" ON public.source_authorities;
CREATE POLICY "Service role full access" ON public.source_authorities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.source_authorities;
CREATE POLICY "Tenant member access" ON public.source_authorities
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
