-- Older coworker setup left native CRM requirements as unverified provider
-- placeholders. Upgrade only untouched defaults when native setup is approved.
-- Saved restrictions, verification, provider state and explicit writes survive.
BEGIN;

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
  WHERE p_source NOT IN ('native', 'coworker_bootstrap')
    OR (p_source = 'native'
      AND EXCLUDED.capability_key IN ('crm.read', 'crm.write')
      AND workspace_capabilities.source = 'coworker_bootstrap'
      AND NOT workspace_capabilities.available
      AND workspace_capabilities.policy IS NULL
      AND workspace_capabilities.integration_id IS NULL
      AND workspace_capabilities.verified_at IS NULL
      AND workspace_capabilities.status_reason IS NULL)
  RETURNING id INTO v_id;

  -- A seed that loses the unique-key conflict returns the retained identity.
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.workspace_capabilities
      WHERE tenant_id = v_tenant_id AND capability_key = btrim(p_capability_key);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_workspace_capability(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_workspace_capability(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO service_role;


COMMIT;
