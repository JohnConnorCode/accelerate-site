-- Coworker setup seeds missing requirements without replacing observed
-- connection state or permissions. Explicit sync and policy writes stay intact.
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


CREATE OR REPLACE FUNCTION public.upsert_autonomy_policy(
  p_action_key text, p_label text, p_level public.autonomy_level DEFAULT 'always_ask',
  p_description text DEFAULT NULL, p_constraints jsonb DEFAULT '{}',
  p_coworker_id text DEFAULT NULL, p_source text DEFAULT 'system',
  p_is_hard_floor boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := private.authorized_request_tenant_id();
  k text := btrim(p_action_key);
  result uuid;
  before_rows jsonb;
  material_change boolean;
  floor_applies boolean;
BEGIN
  IF k IS NULL OR k = '' OR p_label IS NULL OR btrim(p_label) = '' THEN
    RAISE EXCEPTION 'action_key and label are required';
  END IF;
  IF p_level IS NULL OR p_constraints IS NULL OR jsonb_typeof(p_constraints) <> 'object'
    OR p_is_hard_floor IS NULL OR p_source IS NULL OR btrim(p_source) = ''
    OR (p_coworker_id IS NOT NULL AND btrim(p_coworker_id) = '') THEN
    RAISE EXCEPTION 'Invalid policy level, constraints, source or coworker scope';
  END IF;
  -- A repeatable-read snapshot taken before the lock could miss a prior insert.
  -- The normal RPC transport uses READ COMMITTED; refuse weaker convergence.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Policy writes require READ COMMITTED isolation';
  END IF;
  -- The action lock also serializes generic hard-floor changes with coworker grants.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('autonomy-policy',t,k)::text,0));
  IF p_coworker_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.coworkers WHERE tenant_id = t AND id = p_coworker_id
  ) THEN
    RAISE EXCEPTION 'violates foreign key: coworker % does not belong to tenant', p_coworker_id;
  END IF;
  PERFORM 1 FROM public.autonomy_policies p
    WHERE p.tenant_id=t AND p.action_key=k AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id
    ORDER BY p.created_at,p.id FOR UPDATE;
  before_rows := private.autonomy_policy_scope_snapshot(t,k,p_coworker_id);
  SELECT p.id INTO result FROM public.autonomy_policies p
    WHERE p.tenant_id=t AND p.action_key=k AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id
    ORDER BY p.created_at,p.id LIMIT 1;
  -- Setup declares missing requirements; only an explicit policy write changes
  -- an existing human grant, restriction, hard floor or its approval receipt.
  IF result IS NOT NULL AND p_source = 'coworker_bootstrap' THEN
    RETURN result;
  END IF;
  IF NOT p_is_hard_floor AND EXISTS (
    SELECT 1 FROM public.autonomy_policies p WHERE p.tenant_id=t AND p.action_key=k
      AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id AND p.is_hard_floor
  ) THEN
    RAISE EXCEPTION 'An existing hard floor cannot be downgraded';
  END IF;
  SELECT hard_floor INTO floor_applies FROM public.check_autonomy(k,p_coworker_id);
  IF (p_is_hard_floor OR floor_applies) AND p_level IN ('standing_permission','autonomous') THEN
    RAISE EXCEPTION 'A hard floor cannot receive standing or autonomous permission';
  END IF;
  IF result IS NULL THEN
    INSERT INTO public.autonomy_policies(tenant_id,action_key,label,description,level,constraints,coworker_id,source,is_hard_floor)
      VALUES(t,k,p_label,p_description,p_level,p_constraints,p_coworker_id,p_source,p_is_hard_floor)
      RETURNING id INTO result;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.autonomy_policies p WHERE p.tenant_id=t AND p.action_key=k
        AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id
        AND (p.level IS DISTINCT FROM p_level OR p.constraints IS DISTINCT FROM p_constraints
          OR p.source IS DISTINCT FROM p_source OR p.is_hard_floor IS DISTINCT FROM p_is_hard_floor)
    ) INTO material_change;
    UPDATE public.autonomy_policies p SET label=p_label,description=p_description,
      level=p_level,constraints=p_constraints,source=p_source,is_hard_floor=p_is_hard_floor,
      approved_by=CASE WHEN material_change THEN NULL ELSE p.approved_by END,
      approved_at=CASE WHEN material_change THEN NULL ELSE p.approved_at END,
      updated_at=now()
    WHERE p.tenant_id=t AND p.action_key=k AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id;
  END IF;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
    VALUES(t,NULL,'autonomy_policy.scope_registered','autonomy_policy',result::text,'automation',
      before_rows,private.autonomy_policy_scope_snapshot(t,k,p_coworker_id),
      jsonb_build_object('action_key',k,'coworker_id',p_coworker_id,'request_user_id',auth.uid(),
        'approval_cleared',COALESCE(material_change,false)));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_autonomy_policy(text,text,public.autonomy_level,text,jsonb,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_autonomy_policy(text,text,public.autonomy_level,text,jsonb,text,text,boolean) TO service_role;

COMMIT;
