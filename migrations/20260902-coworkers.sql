-- =============================================================================
-- Coworker Model: coworkers table.
--
-- Implements the northstar Phase B5 primitive (docs/NORTHSTAR.md §19-20):
-- explicit worker identities with manifests over the shared runtime.
-- Coworkers are first-class configuration objects, not separate LLMs.
--
-- A coworker defines:
--   - identity (name, role, description)
--   - capabilities it requires
--   - autonomy policies it operates under
--   - work-item kinds it handles
--   - the model/tool pack it uses
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coworkers (
  id                TEXT PRIMARY KEY,         -- e.g. "sales", "onboarding", "support"
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  name              TEXT NOT NULL,            -- display name: "Sales Coworker"
  role              TEXT NOT NULL,            -- role description: "Qualifies leads and follows up on proposals"
  description       TEXT,                     -- extended description
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','disabled')),
  model             TEXT,                     -- preferred model override (null = use default)
  tool_pack         TEXT NOT NULL DEFAULT 'core'
                    CHECK (tool_pack IN ('core','pipeline','outreach')),
  required_capabilities TEXT[] NOT NULL DEFAULT '{}', -- capability_keys this coworker needs
  work_kinds        TEXT[] NOT NULL DEFAULT '{}',     -- work-item kinds this coworker handles
  autonomy_overrides JSONB NOT NULL DEFAULT '{}',     -- per-action autonomy overrides
  config            JSONB NOT NULL DEFAULT '{}',      -- coworker-specific configuration
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-composite index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coworkers_tenant_id_id
  ON public.coworkers (tenant_id, id);

-- Find active coworkers.
CREATE INDEX IF NOT EXISTS idx_coworkers_active
  ON public.coworkers (tenant_id, status)
  WHERE status = 'active';

-- Find coworkers that handle a specific work kind.
CREATE INDEX IF NOT EXISTS idx_coworkers_work_kinds
  ON public.coworkers USING GIN (tenant_id, work_kinds);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.coworkers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.coworkers
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );
