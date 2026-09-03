-- =============================================================================
-- Capability Graph: workspace_capabilities table + resolve RPC.
--
-- Implements the northstar Phase B2 primitive (docs/NORTHSTAR.md §9):
-- one machine-readable source for workspace capabilities. A coworker should
-- know its capabilities before beginning work, not discover missing
-- integrations by repeatedly failing calls.
--
-- Extends the existing integration-registry (code-defined) with a DB-backed
-- resolution layer that records whether a capability is available, its policy
-- (e.g. approval_required), and when it was last verified.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_capabilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  capability_key    TEXT NOT NULL,            -- e.g. "crm.read", "gmail.send", "calendar.write"
  label             TEXT NOT NULL,            -- human-readable name
  category          TEXT NOT NULL DEFAULT 'integration'
                    CHECK (category IN ('integration','runtime','plugin','system')),
  direction         TEXT NOT NULL DEFAULT 'read'
                    CHECK (direction IN ('read','write','bidirectional')),
  impact            TEXT NOT NULL DEFAULT 'read'
                    CHECK (impact IN ('read','internal_write','external_action')),
  available         BOOLEAN NOT NULL DEFAULT false,
  policy            TEXT,                     -- "automatic", "approval_required", "prohibited"
  source            TEXT NOT NULL,            -- "integration_registry", "plugin", "manual", "system"
  integration_id    TEXT,                     -- links to integration-registry definition id
  verified_at       TIMESTAMPTZ,             -- last time capability was behaviorally verified
  status_reason     TEXT,                     -- why available/unavailable
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One capability key per tenant. Upsert on (tenant_id, capability_key).
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_capabilities_tenant_key
  ON public.workspace_capabilities (tenant_id, capability_key);

-- Tenant-composite primary key index (standard pattern).
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_capabilities_tenant_id_id
  ON public.workspace_capabilities (tenant_id, id);

-- Fast lookup: what capabilities are available for a tenant?
CREATE INDEX IF NOT EXISTS idx_workspace_capabilities_available
  ON public.workspace_capabilities (tenant_id, available, category)
  WHERE available = true;

-- Find capabilities by integration for sync from integration-registry.
CREATE INDEX IF NOT EXISTS idx_workspace_capabilities_integration
  ON public.workspace_capabilities (tenant_id, integration_id)
  WHERE integration_id IS NOT NULL;

-- =============================================================================
-- Row-level security
-- =============================================================================
ALTER TABLE public.workspace_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.workspace_capabilities
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

-- =============================================================================
-- Resolve capability: check whether a specific capability is available.
--
-- Returns:
--   capability_key, available, policy, status_reason, verified_at
--
-- This is the function coworkers call before starting work that requires a
-- capability. It is a simple read — no advisory lock needed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_workspace_capability(
  p_capability_key TEXT
) RETURNS TABLE (
  capability_key TEXT,
  available BOOLEAN,
  policy TEXT,
  status_reason TEXT,
  verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_capability_key IS NULL OR btrim(p_capability_key) = '' THEN
    RAISE EXCEPTION 'capability_key is required';
  END IF;

  RETURN QUERY
    SELECT
      wc.capability_key,
      wc.available,
      wc.policy,
      wc.status_reason,
      wc.verified_at
    FROM public.workspace_capabilities wc
    WHERE wc.tenant_id = v_tenant_id
      AND wc.capability_key = btrim(p_capability_key)
    LIMIT 1;

  IF NOT FOUND THEN
    -- Capability not registered: report unavailable with reason.
    RETURN QUERY
      SELECT
        btrim(p_capability_key),
        false,
        NULL::TEXT,
        'Capability not registered in this workspace',
        NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_workspace_capability(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_capability(TEXT) TO service_role;

COMMENT ON FUNCTION public.resolve_workspace_capability(TEXT) IS
  'Resolves whether a capability is available for the current tenant. Returns availability, policy, and last verification time. Used by coworkers to check capabilities before starting work.';

-- =============================================================================
-- Upsert capability: register or update a workspace capability.
--
-- Used by the sync process that reads the integration-registry and writes
-- the resolved state into the capability graph.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_workspace_capability(
  p_capability_key TEXT,
  p_label TEXT,
  p_category TEXT DEFAULT 'integration',
  p_direction TEXT DEFAULT 'read',
  p_impact TEXT DEFAULT 'read',
  p_available BOOLEAN DEFAULT false,
  p_policy TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'integration_registry',
  p_integration_id TEXT DEFAULT NULL,
  p_status_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_id UUID;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_capability_key IS NULL OR btrim(p_capability_key) = '' THEN
    RAISE EXCEPTION 'capability_key is required';
  END IF;

  INSERT INTO public.workspace_capabilities (
    tenant_id, capability_key, label, category, direction, impact,
    available, policy, source, integration_id, status_reason, verified_at
  ) VALUES (
    v_tenant_id, btrim(p_capability_key), p_label, p_category, p_direction, p_impact,
    p_available, p_policy, p_source, p_integration_id, p_status_reason,
    CASE WHEN p_available THEN now() ELSE NULL END
  )
  ON CONFLICT (tenant_id, capability_key) DO UPDATE SET
    label = EXCLUDED.label,
    category = EXCLUDED.category,
    direction = EXCLUDED.direction,
    impact = EXCLUDED.impact,
    available = EXCLUDED.available,
    policy = EXCLUDED.policy,
    source = EXCLUDED.source,
    integration_id = EXCLUDED.integration_id,
    status_reason = EXCLUDED.status_reason,
    verified_at = CASE WHEN EXCLUDED.available THEN now() ELSE workspace_capabilities.verified_at END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_workspace_capability(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_workspace_capability(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.upsert_workspace_capability(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) IS
  'Idempotently registers or updates a workspace capability. Used by integration-registry sync and plugin registration.';
