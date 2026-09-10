-- =============================================================================
-- Workspace Architect — Blueprint Foundation (WA-01, spec §8, §27).
--
-- A WorkspaceBlueprint is a versioned configuration proposal. AI proposes,
-- deterministic services validate, humans approve, and only then does a
-- compiler apply it through existing domain services. Versions are
-- append-only: saving always inserts a new version row, never overwrites.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_blueprints (
  tenant_id         UUID NOT NULL,
  id                UUID NOT NULL DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL DEFAULT 'Workspace Blueprint',
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','in_review','approved','applied','superseded')),
  latest_version    INTEGER NOT NULL DEFAULT 0 CHECK (latest_version >= 0),
  created_by        TEXT,
  source_agent_run_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.workspace_blueprint_versions (
  tenant_id           UUID NOT NULL,
  blueprint_id        UUID NOT NULL,
  version             INTEGER NOT NULL CHECK (version > 0),
  parent_version      INTEGER CHECK (parent_version IS NULL OR parent_version > 0),
  document            JSONB NOT NULL,
  change_summary      TEXT NOT NULL,
  created_by          TEXT,
  source_agent_run_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, blueprint_id, version),
  FOREIGN KEY (tenant_id, blueprint_id)
    REFERENCES public.workspace_blueprints (tenant_id, id),
  CHECK (parent_version IS NULL OR parent_version < version)
);

CREATE INDEX IF NOT EXISTS idx_workspace_blueprints_tenant_updated
  ON public.workspace_blueprints (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_blueprint_versions_history
  ON public.workspace_blueprint_versions (tenant_id, blueprint_id, version DESC);

-- =============================================================================
-- Row-level security: same policy as every operational table.
-- =============================================================================
ALTER TABLE public.workspace_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_blueprint_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant member access" ON public.workspace_blueprints;
CREATE POLICY "Tenant member access" ON public.workspace_blueprints
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

DROP POLICY IF EXISTS "Tenant member access" ON public.workspace_blueprint_versions;
CREATE POLICY "Tenant member access" ON public.workspace_blueprint_versions
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );
