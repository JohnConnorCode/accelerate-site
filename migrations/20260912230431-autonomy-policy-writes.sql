-- Supported policy writes converge without deleting historical rows or changing
-- the effective read resolver. Existing IDs, created_at and audit rows survive.
BEGIN;

CREATE OR REPLACE FUNCTION private.autonomy_policy_scope_snapshot(t uuid, k text, c text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'level', p.level, 'source', p.source,
    'is_hard_floor', p.is_hard_floor,
    'constraints_fingerprint', md5(p.constraints::text),
    'approved_by', p.approved_by, 'approved_at', p.approved_at,
    'created_at', p.created_at
  ) ORDER BY p.created_at, p.id), '[]'::jsonb)
  FROM public.autonomy_policies p
  WHERE p.tenant_id = t AND p.action_key = k AND p.coworker_id IS NOT DISTINCT FROM c;
$$;
REVOKE ALL ON FUNCTION private.autonomy_policy_scope_snapshot(uuid,text,text) FROM PUBLIC, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.grant_standing_permission(
  p_action_key text,p_coworker_id text DEFAULT NULL,p_approved_by text DEFAULT NULL,p_constraints jsonb DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := private.authorized_request_tenant_id();
  k text := btrim(p_action_key);
  result uuid;
  before_rows jsonb;
  floor_applies boolean;
BEGIN
  IF k IS NULL OR k='' OR p_approved_by IS NULL OR btrim(p_approved_by)='' THEN
    RAISE EXCEPTION 'action_key and explicit human approver are required';
  END IF;
  IF p_constraints IS NULL OR jsonb_typeof(p_constraints)<>'object'
    OR (p_coworker_id IS NOT NULL AND btrim(p_coworker_id)='') THEN
    RAISE EXCEPTION 'Invalid constraints or coworker scope';
  END IF;
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
  SELECT p.id INTO result FROM public.autonomy_policies p
    WHERE p.tenant_id=t AND p.action_key=k AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id
    ORDER BY p.created_at,p.id LIMIT 1;
  SELECT hard_floor INTO floor_applies FROM public.check_autonomy(k,p_coworker_id);
  IF result IS NULL OR floor_applies OR EXISTS (
    SELECT 1 FROM public.autonomy_policies p WHERE p.tenant_id=t AND p.action_key=k
      AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id
      AND (p.is_hard_floor OR p.level NOT IN ('always_ask','ask_until_trusted','standing_permission'))
  ) THEN
    RAISE EXCEPTION 'No eligible policy scope: missing, prohibited, hard floor or autonomous';
  END IF;
  before_rows := private.autonomy_policy_scope_snapshot(t,k,p_coworker_id);
  UPDATE public.autonomy_policies p SET level='standing_permission',approved_by=btrim(p_approved_by),
    approved_at=now(),constraints=p_constraints,updated_at=now()
    WHERE p.tenant_id=t AND p.action_key=k AND p.coworker_id IS NOT DISTINCT FROM p_coworker_id;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
    VALUES(t,btrim(p_approved_by),'autonomy_policy.scope_approved','autonomy_policy',result::text,'admin',
      before_rows,private.autonomy_policy_scope_snapshot(t,k,p_coworker_id),
      jsonb_build_object('action_key',k,'coworker_id',p_coworker_id,'request_user_id',auth.uid()));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_standing_permission(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_standing_permission(text,text,text,jsonb) TO service_role;
COMMIT;
