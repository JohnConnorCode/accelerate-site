-- Additive policy enforcement: interactive callers retain membership/context
-- validation through private.authorized_request_tenant_id(). No new write grant.
BEGIN;
CREATE OR REPLACE FUNCTION public.check_autonomy(
  p_action_key TEXT,
  p_coworker_id TEXT DEFAULT NULL
) RETURNS TABLE (
  action_key TEXT,
  allowed BOOLEAN,
  level public.autonomy_level,
  requires_approval BOOLEAN,
  policy_id UUID,
  hard_floor BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_hard_floor BOOLEAN;
  v_policy public.autonomy_policies%ROWTYPE;
  v_found BOOLEAN;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_action_key IS NULL OR btrim(p_action_key) = '' THEN
    RAISE EXCEPTION 'action_key is required';
  END IF;

  -- Step 1: Hard floor check — absolute prohibition regardless of policy.
  SELECT EXISTS (
    SELECT 1 FROM public.autonomy_hard_floors AS f
    WHERE f.tenant_id = v_tenant_id
      AND f.action_key = btrim(p_action_key)
    UNION ALL
    SELECT 1 FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id AND p.action_key = btrim(p_action_key)
      AND p.is_hard_floor AND (p.coworker_id IS NULL OR p.coworker_id = p_coworker_id)
  ) INTO v_is_hard_floor;

  IF v_is_hard_floor OR btrim(p_action_key) = ANY(ARRAY['account.delete','credential.change','financial_history.delete','customer_database.export','refund.high_value','financial_transfer.major']) THEN
    RETURN QUERY
      SELECT
        btrim(p_action_key),
        false,
        'prohibited'::public.autonomy_level,
        true,
        NULL::UUID,
        true,
        'This action is a hard safety floor and cannot be automated (§17)';
    RETURN;
  END IF;

  -- Step 2: Look up coworker-specific policy first.
  IF p_coworker_id IS NOT NULL THEN
    SELECT p.* INTO v_policy FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id
      AND p.action_key = btrim(p_action_key)
      AND p.coworker_id = p_coworker_id
    -- NULL coworker keys historically allowed duplicate generic policies.
    -- Preserve their rows while choosing the strictest effective rule.
    ORDER BY CASE
      WHEN p.level = 'prohibited' THEN 0
      WHEN p.level = 'always_ask' THEN 1
      WHEN p.level = 'ask_until_trusted' THEN 2
      WHEN p.level = 'standing_permission' AND (p.approved_by IS NULL OR p.approved_at IS NULL OR COALESCE(p.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN 1
      WHEN p.level = 'standing_permission' THEN 3
      ELSE 4 END, p.updated_at DESC, p.id
    LIMIT 1;
    v_found := FOUND;
  ELSE
    v_found := false;
  END IF;

  -- Step 3: Fall back to generic (coworker-agnostic) policy.
  IF NOT v_found THEN
    SELECT p.* INTO v_policy FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id
      AND p.action_key = btrim(p_action_key)
      AND p.coworker_id IS NULL
    -- NULL coworker keys historically allowed duplicate generic policies.
    -- Preserve their rows while choosing the strictest effective rule.
    ORDER BY CASE
      WHEN p.level = 'prohibited' THEN 0
      WHEN p.level = 'always_ask' THEN 1
      WHEN p.level = 'ask_until_trusted' THEN 2
      WHEN p.level = 'standing_permission' AND (p.approved_by IS NULL OR p.approved_at IS NULL OR COALESCE(p.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN 1
      WHEN p.level = 'standing_permission' THEN 3
      ELSE 4 END, p.updated_at DESC, p.id
    LIMIT 1;
    v_found := FOUND;
  END IF;

  -- Step 4: No policy → default to always_ask (fail-closed).
  IF NOT v_found THEN
    RETURN QUERY
      SELECT
        btrim(p_action_key),
        false,
        'always_ask'::public.autonomy_level,
        true,
        NULL::UUID,
        false,
        'No policy registered; defaulting to always_ask (fail-closed)';
    RETURN;
  END IF;

  -- A manifest declaration is not human approval. Unknown constraint shapes
  -- cannot become standing permission until an executor understands them.
  IF v_policy.level = 'standing_permission' AND
    (v_policy.approved_by IS NULL OR v_policy.approved_at IS NULL OR COALESCE(v_policy.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN
    RETURN QUERY SELECT btrim(p_action_key), false, 'always_ask'::public.autonomy_level,
      true, v_policy.id, false, 'Standing permission requires human approval and supported constraints'::text;
    RETURN;
  END IF;

  -- Step 5: Resolve based on the policy level.
  RETURN QUERY
    SELECT
      btrim(p_action_key),
      v_policy.level IN ('standing_permission', 'autonomous'),
      v_policy.level,
      v_policy.level IN ('prohibited', 'always_ask', 'ask_until_trusted'),
      v_policy.id,
      false,
      CASE v_policy.level
        WHEN 'prohibited' THEN 'Action is prohibited by policy'
        WHEN 'always_ask' THEN 'Action requires approval every time'
        WHEN 'ask_until_trusted' THEN 'Action requires approval until standing permission is granted'
        WHEN 'standing_permission' THEN 'Standing permission granted within constraints'
        WHEN 'autonomous' THEN 'Action is freely executable (low-risk)'
      END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_autonomy(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_autonomy(TEXT, TEXT) TO service_role, authenticated;


COMMIT;
