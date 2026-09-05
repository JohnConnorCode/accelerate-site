-- =============================================================================
-- Agent memory + budgets: the four tables memory.ts / budgets.ts have always
-- queried, and which have never existed in any environment.
--
-- Until this migration, every call site in src/lib/revenue-os/work-executor.ts
-- caught the resulting "relation does not exist" error and silently returned
-- [] / undefined ("best-effort"), so the learned-policy gate never blocked
-- anything, the budget gate never fired, and stored agent memory was never
-- persisted. A companion code change removes that swallow and fixes two
-- latent bugs this migration's design works around (see below).
--
-- Apply after migrations/20260902-coworkers.sql (agent_memory, learned_policies,
-- budget_limits, budget_usage all FK coworkers.id).
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

-- =============================================================================
-- 1. agent_memory — category 4 of the memory architecture (northstar §23).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  coworker_id       TEXT REFERENCES public.coworkers(id) ON DELETE SET NULL,
  agent_run_id      UUID,
  category          TEXT NOT NULL
                    CHECK (category IN ('prior_work','prior_research','scheduled_check','unresolved_question')),
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  entity_type       TEXT,
  entity_id         UUID,
  relevance_horizon TEXT NOT NULL DEFAULT 'daily'
                    CHECK (relevance_horizon IN ('session','daily','weekly','permanent')),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_memory_tenant_id_id
  ON public.agent_memory (tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_retrieval
  ON public.agent_memory (tenant_id, coworker_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_entity
  ON public.agent_memory (tenant_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_memory_expiry
  ON public.agent_memory (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.agent_memory;
CREATE POLICY "Service role full access" ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.agent_memory;
CREATE POLICY "Tenant member access" ON public.agent_memory
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

-- =============================================================================
-- 2. learned_policies — category 5 of the memory architecture (northstar §23).
--
-- superseded_by is UUID, not TEXT. The shipped memory.ts recordLearnedPolicy()
-- writes the literal string "pending" into this column as a placeholder then
-- back-fills it — that only works if the column is TEXT, and it is racy
-- across every action_key in the tenant (a second concurrent call's
-- back-fill UPDATE would match the first call's still-"pending" row too).
-- This migration keeps the column UUID; the companion code change to
-- memory.ts inserts the new row first, then does one UPDATE ... WHERE
-- action_key = ... AND superseded_at IS NULL AND id <> <new id>.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.learned_policies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  action_key         TEXT NOT NULL,
  rule               TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  source             TEXT NOT NULL
                     CHECK (source IN ('human_decision','founder_override','incident_remediation','policy_review')),
  coworker_id        TEXT REFERENCES public.coworkers(id) ON DELETE SET NULL,
  scope_entity_type  TEXT,
  scope_entity_id    UUID,
  superseded_by      UUID REFERENCES public.learned_policies(id) ON DELETE SET NULL,
  superseded_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_policies_tenant_id_id
  ON public.learned_policies (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_policies_active_global
  ON public.learned_policies (tenant_id, action_key)
  WHERE scope_entity_type IS NULL AND scope_entity_id IS NULL AND superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_policies_active_scoped
  ON public.learned_policies (tenant_id, action_key, scope_entity_type, scope_entity_id)
  WHERE scope_entity_type IS NOT NULL AND scope_entity_id IS NOT NULL AND superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_learned_policies_active_lookup
  ON public.learned_policies (tenant_id, action_key)
  WHERE superseded_at IS NULL;

ALTER TABLE public.learned_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.learned_policies;
CREATE POLICY "Service role full access" ON public.learned_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.learned_policies;
CREATE POLICY "Tenant member access" ON public.learned_policies
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

-- =============================================================================
-- 3. budget_limits / 4. budget_usage
--
-- coworker_id is TEXT NOT NULL DEFAULT '*' (not nullable). setBudgetLimit()
-- and recordBudgetUsage() upsert with onConflict "coworker_id,budget_kind"
-- and "coworker_id,budget_kind,period_key" respectively — PostgREST's
-- on_conflict parameter needs a real (non-partial) unique index on exactly
-- those columns. A nullable coworker_id would need two partial indexes
-- (NULL <> NULL breaks a single composite unique constraint), and
-- PostgREST cannot pick between them from one on_conflict value. Using the
-- sentinel '*' for "tenant-global" keeps one real unique index and matches
-- the client's upsert target exactly. Companion code change: budgets.ts
-- `.is("coworker_id", null)` -> `.eq("coworker_id", "*")`, and every
-- `coworkerId ?? null` -> `coworkerId ?? "*"`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budget_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  coworker_id   TEXT NOT NULL DEFAULT '*',
  budget_kind   TEXT NOT NULL
               CHECK (budget_kind IN ('model_spend','vendor_api_calls','emails_sent','research_depth','retry_count','runtime_seconds')),
  limit_value   NUMERIC NOT NULL CHECK (limit_value >= 0),
  period        TEXT NOT NULL DEFAULT 'daily'
               CHECK (period IN ('daily','weekly','monthly','per_work_item')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_limits_tenant_id_id
  ON public.budget_limits (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_limits_upsert_target
  ON public.budget_limits (tenant_id, coworker_id, budget_kind);

ALTER TABLE public.budget_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.budget_limits;
CREATE POLICY "Service role full access" ON public.budget_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.budget_limits;
CREATE POLICY "Tenant member access" ON public.budget_limits
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

CREATE TABLE IF NOT EXISTS public.budget_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  coworker_id   TEXT NOT NULL DEFAULT '*',
  budget_kind   TEXT NOT NULL
               CHECK (budget_kind IN ('model_spend','vendor_api_calls','emails_sent','research_depth','retry_count','runtime_seconds')),
  used_value    NUMERIC NOT NULL DEFAULT 0 CHECK (used_value >= 0),
  period_key    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_usage_tenant_id_id
  ON public.budget_usage (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_usage_upsert_target
  ON public.budget_usage (tenant_id, coworker_id, budget_kind, period_key);
CREATE INDEX IF NOT EXISTS idx_budget_usage_period
  ON public.budget_usage (tenant_id, period_key);

ALTER TABLE public.budget_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.budget_usage;
CREATE POLICY "Service role full access" ON public.budget_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.budget_usage;
CREATE POLICY "Tenant member access" ON public.budget_usage
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

CREATE OR REPLACE FUNCTION budget_usage_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS budget_usage_touch_updated_at ON public.budget_usage;
CREATE TRIGGER budget_usage_touch_updated_at
  BEFORE UPDATE ON public.budget_usage
  FOR EACH ROW EXECUTE FUNCTION budget_usage_touch_updated_at();

-- =============================================================================
-- increment_budget_usage: atomic upsert-and-add. The shipped budgets.ts calls
-- this RPC first and falls back to a raw client-side upsert only if the RPC
-- is missing (pg error 42883). That fallback OVERWRITES used_value with the
-- delta instead of incrementing it — it silently resets budgets under any
-- concurrent execution. Shipping this RPC (and only this RPC — the fallback
-- path is removed in the companion code change) is load-bearing, not optional.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_budget_usage(
  p_coworker_id TEXT,
  p_budget_kind TEXT,
  p_period_key TEXT,
  p_value NUMERIC
) RETURNS public.budget_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_coworker_id TEXT;
  v_row public.budget_usage%ROWTYPE;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();
  v_coworker_id := COALESCE(NULLIF(btrim(p_coworker_id), ''), '*');

  IF p_budget_kind IS NULL OR btrim(p_budget_kind) = '' THEN
    RAISE EXCEPTION 'budget_kind is required';
  END IF;
  IF p_period_key IS NULL OR btrim(p_period_key) = '' THEN
    RAISE EXCEPTION 'period_key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_tenant_id::text || ':budget-usage:' || v_coworker_id || ':' || p_budget_kind || ':' || p_period_key, 0)
  );

  INSERT INTO public.budget_usage (tenant_id, coworker_id, budget_kind, used_value, period_key)
  VALUES (v_tenant_id, v_coworker_id, p_budget_kind, p_value, p_period_key)
  ON CONFLICT (tenant_id, coworker_id, budget_kind, period_key) DO UPDATE
    SET used_value = public.budget_usage.used_value + EXCLUDED.used_value,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_budget_usage(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_budget_usage(TEXT, TEXT, TEXT, NUMERIC) TO service_role;

COMMENT ON FUNCTION public.increment_budget_usage(TEXT, TEXT, TEXT, NUMERIC) IS
  'Atomically increments (or creates) a budget_usage row. NULL/empty coworker_id normalizes to the "*" tenant-global sentinel.';
