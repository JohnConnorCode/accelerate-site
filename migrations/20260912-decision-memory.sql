-- =============================================================================
-- Decision Memory (decision-memory card).
--
-- Decisions record what was decided, why, by whom, when, supporting
-- evidence, what they supersede, and what they imply. Superseded decisions
-- stay readable as history with forward links. Implications are offered,
-- never applied automatically.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.decisions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  title              TEXT NOT NULL,
  decision           TEXT NOT NULL,
  why                TEXT NOT NULL DEFAULT '',
  owner_email        TEXT,
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence           JSONB,
  supersedes_id      UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  superseded_by      UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  superseded_at      TIMESTAMPTZ,
  implications       JSONB,
  dedupe_key         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decisions_tenant_id_id
  ON public.decisions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_decisions_dedupe
  ON public.decisions (tenant_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_decisions_active
  ON public.decisions (tenant_id, created_at DESC) WHERE superseded_at IS NULL;

DROP POLICY IF EXISTS "Service role full access" ON public.decisions;
CREATE POLICY "Service role full access" ON public.decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.decisions;
CREATE POLICY "Tenant member access" ON public.decisions
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
