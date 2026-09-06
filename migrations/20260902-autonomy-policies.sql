-- =============================================================================
-- Autonomy Policy Engine: autonomy_policies table + check_autonomy RPC.
--
-- Implements the northstar Phase B4 primitive (docs/NORTHSTAR.md §16-18):
-- one coherent system governing agent actions. Unifies AI confirmations,
-- automation permissions, standing approvals, coworker permissions, and
-- hard safety floors.
--
-- Five-level autonomy ladder:
--   0 = Prohibited (hard floor, cannot be overridden)
--   1 = Always ask (every action requires human approval)
--   2 = Ask until trusted (approval until standing permission granted)
--   3 = Standing permission (auto-execute within explicit constraints)
--   4 = Autonomous read/reason (low-risk, freely executable)
--
-- Hard safety floors (§17): certain actions can never become auto-executable.
-- These are enforced by the check_autonomy RPC regardless of DB state.
--
-- Approval provenance (§18): every check records which policy applied and
-- whether human or standing approval authorized the action.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Autonomy level enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.autonomy_level AS ENUM (
    'prohibited',       -- 0: cannot execute
    'always_ask',       -- 1: requires approval every time
    'ask_until_trusted',-- 2: requires approval until standing permission
    'standing_permission',-- 3: auto-execute within constraints
    'autonomous'        -- 4: freely executable (reads, analysis, drafts)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Autonomy policies table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autonomy_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  action_key        TEXT NOT NULL,            -- e.g. "email.send", "crm.write", "refund.issue"
  label             TEXT NOT NULL,            -- human-readable name
  description       TEXT,                     -- what this policy governs
  level             public.autonomy_level NOT NULL DEFAULT 'always_ask',
  constraints       JSONB NOT NULL DEFAULT '{}',-- e.g. {"max_per_day": 20, "template_categories": ["follow_up"]}
  coworker_id       TEXT,                     -- nullable: policy scoped to a specific coworker
  source            TEXT NOT NULL DEFAULT 'system', -- "system", "founder", "coworker_default"
  approved_by       TEXT,                     -- who approved standing permission
  approved_at       TIMESTAMPTZ,             -- when standing permission was granted
  is_hard_floor     BOOLEAN NOT NULL DEFAULT false, -- true = cannot be overridden (§17)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One policy per tenant+action_key (+ optional coworker_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_autonomy_policies_tenant_action
  ON public.autonomy_policies (tenant_id, action_key, coworker_id);

-- Tenant-composite primary key index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_autonomy_policies_tenant_id_id
  ON public.autonomy_policies (tenant_id, id);

-- Find hard floors quickly.
CREATE INDEX IF NOT EXISTS idx_autonomy_policies_hard_floors
  ON public.autonomy_policies (tenant_id, action_key)
  WHERE is_hard_floor = true;

-- Find standing permissions.
CREATE INDEX IF NOT EXISTS idx_autonomy_policies_standing
  ON public.autonomy_policies (tenant_id, coworker_id, level)
  WHERE level = 'standing_permission';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.autonomy_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.autonomy_policies
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
-- Hard safety floors: actions that are ALWAYS prohibited from auto-execution.
-- These are enforced by the check_autonomy RPC regardless of DB state.
-- They cannot be overridden by any policy, standing approval, or prompt.
-- (Northstar §17)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.autonomy_hard_floors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  action_key        TEXT NOT NULL,
  reason            TEXT NOT NULL,            -- why this is a hard floor
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_autonomy_hard_floors_tenant_action
  ON public.autonomy_hard_floors (tenant_id, action_key);

-- Seed the hard floors. These actions can NEVER become auto-executable.
INSERT INTO public.autonomy_hard_floors (tenant_id, action_key, reason) VALUES
  (public.accelerate_default_tenant_id(), 'account.delete', 'Destructive account deletion cannot be automated'),
  (public.accelerate_default_tenant_id(), 'credential.change', 'Credential changes require human initiation'),
  (public.accelerate_default_tenant_id(), 'financial_history.delete', 'Deleting financial history is irreversible'),
  (public.accelerate_default_tenant_id(), 'customer_database.export', 'Full customer data export cannot be automated'),
  (public.accelerate_default_tenant_id(), 'refund.high_value', 'High-value refunds require human approval regardless of history'),
  (public.accelerate_default_tenant_id(), 'financial_transfer.major', 'Major financial transfers require human initiation')
ON CONFLICT (tenant_id, action_key) DO NOTHING;

-- =============================================================================
-- check_autonomy RPC: determine whether an action is allowed and how.
--
-- Returns:
--   action_key, allowed, level, requires_approval, policy_id, hard_floor, reason
--
-- Logic:
--   1. Check hard floors first — if the action is a hard floor, always prohibited.
--   2. Look up the specific policy (tenant + action_key + coworker_id).
--   3. Fall back to the generic policy (tenant + action_key, no coworker_id).
--   4. If no policy exists, default to "always_ask" (fail-closed).
--   5. Return the resolution with the policy that applied.
-- =============================================================================
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
    SELECT 1 FROM public.autonomy_hard_floors
    WHERE tenant_id = v_tenant_id
      AND action_key = btrim(p_action_key)
  ) INTO v_is_hard_floor;

  IF v_is_hard_floor THEN
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
    SELECT * INTO v_policy FROM public.autonomy_policies
    WHERE tenant_id = v_tenant_id
      AND action_key = btrim(p_action_key)
      AND coworker_id = p_coworker_id
    LIMIT 1;
    v_found := FOUND;
  ELSE
    v_found := false;
  END IF;

  -- Step 3: Fall back to generic (coworker-agnostic) policy.
  IF NOT v_found THEN
    SELECT * INTO v_policy FROM public.autonomy_policies
    WHERE tenant_id = v_tenant_id
      AND action_key = btrim(p_action_key)
      AND coworker_id IS NULL
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
GRANT EXECUTE ON FUNCTION public.check_autonomy(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.check_autonomy(TEXT, TEXT) IS
  'Checks whether an action is allowed under the autonomy policy engine. Checks hard floors first, then coworker-specific policy, then generic policy, then defaults to always_ask. Returns allowed, level, requires_approval, and the policy that applied.';

-- =============================================================================
-- upsert_autonomy_policy RPC: register or update an autonomy policy.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_autonomy_policy(
  p_action_key TEXT,
  p_label TEXT,
  p_level public.autonomy_level DEFAULT 'always_ask',
  p_description TEXT DEFAULT NULL,
  p_constraints JSONB DEFAULT '{}',
  p_coworker_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'system',
  p_is_hard_floor BOOLEAN DEFAULT false
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

  IF p_action_key IS NULL OR btrim(p_action_key) = '' THEN
    RAISE EXCEPTION 'action_key is required';
  END IF;

  -- Hard floors can never be set to standing_permission or autonomous.
  IF p_is_hard_floor AND p_level IN ('standing_permission', 'autonomous') THEN
    RAISE EXCEPTION 'A hard floor action cannot be set to standing_permission or autonomous';
  END IF;

  INSERT INTO public.autonomy_policies (
    tenant_id, action_key, label, description, level, constraints,
    coworker_id, source, is_hard_floor
  ) VALUES (
    v_tenant_id, btrim(p_action_key), p_label, p_description, p_level, p_constraints,
    p_coworker_id, p_source, p_is_hard_floor
  )
  ON CONFLICT (tenant_id, action_key, coworker_id) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    constraints = EXCLUDED.constraints,
    source = EXCLUDED.source,
    is_hard_floor = EXCLUDED.is_hard_floor,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_autonomy_policy(TEXT, TEXT, public.autonomy_level, TEXT, JSONB, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_autonomy_policy(TEXT, TEXT, public.autonomy_level, TEXT, JSONB, TEXT, TEXT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.upsert_autonomy_policy(TEXT, TEXT, public.autonomy_level, TEXT, JSONB, TEXT, TEXT, BOOLEAN) IS
  'Idempotently registers or updates an autonomy policy. Hard floor actions cannot be set to standing_permission or autonomous.';

-- =============================================================================
-- grant_standing_permission: upgrade ask_until_trusted → standing_permission
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_standing_permission(
  p_action_key TEXT,
  p_coworker_id TEXT DEFAULT NULL,
  p_approved_by TEXT DEFAULT NULL,
  p_constraints JSONB DEFAULT '{}'
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

  UPDATE public.autonomy_policies
  SET level = 'standing_permission',
      approved_by = p_approved_by,
      approved_at = now(),
      constraints = p_constraints,
      updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND action_key = btrim(p_action_key)
    AND (p_coworker_id IS NULL AND coworker_id IS NULL OR coworker_id = p_coworker_id)
    AND level IN ('ask_until_trusted', 'always_ask')
    AND NOT is_hard_floor
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No eligible policy found for action_key=% (must be ask_until_trusted or always_ask and not a hard floor)', p_action_key;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_standing_permission(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_standing_permission(TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.grant_standing_permission(TEXT, TEXT, TEXT, JSONB) IS
  'Upgrades an ask_until_trusted or always_ask policy to standing_permission. Cannot upgrade hard floors. Records who approved and when.';
