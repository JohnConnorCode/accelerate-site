-- =============================================================================
-- Durable Work Engine: work_items table, claim RPC, and operational indexes.
--
-- Implements the northstar Phase B1 primitive (docs/NORTHSTAR.md §6):
-- work is represented durably, not as cron→prompt→hope. Every autonomous
-- action becomes a WorkItem that survives browser closure, deployment,
-- process restart, model failure, and agent failure.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.work_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  coworker_id       TEXT,                    -- nullable until Coworker model lands (Phase C)
  kind              TEXT NOT NULL,            -- e.g. "qualify_lead", "follow_up_proposal", "review_overdue"
  objective         TEXT NOT NULL,            -- human-readable what needs to happen
  entity_type       TEXT,                     -- "contact", "opportunity", "company", etc.
  entity_id         UUID,                    -- canonical record ID
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('urgent','high','medium','low')),
  reason            TEXT NOT NULL,            -- WHY this work exists — every item must explain itself
  source            TEXT NOT NULL,            -- what created this work item (trigger, agent, human)
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','claimed','in_progress','waiting','completed','failed','cancelled')),
  dedupe_key        TEXT,                     -- prevents equivalent open work items
  due_at            TIMESTAMPTZ,
  next_check_at     TIMESTAMPTZ,             -- self-scheduled future check
  next_check_reason TEXT,                     -- why the next check exists (required when next_check_at set)
  lease_owner       TEXT,                     -- who claimed this
  lease_expires_at  TIMESTAMPTZ,             -- stale claim boundary
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,
  outcome           TEXT,                     -- completion/failure description
  error             TEXT,                     -- last error message
  agent_run_id      UUID,                    -- link to agent_runs trace
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at        TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

-- One open dedupe key per tenant (same pattern as action_queue / tasks).
-- Completed/cancelled/failed items release their dedupe slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_open_dedupe
  ON public.work_items (tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('pending','claimed','in_progress','waiting');

-- At-most-one active item per kind+entity for singleton work patterns
-- (e.g. only one "follow_up_proposal" per opportunity at a time).
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_active_kind_entity
  ON public.work_items (tenant_id, kind, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
    AND status IN ('pending','claimed','in_progress','waiting');

-- Claim next available work: pending items or waiting items past their next_check_at.
CREATE INDEX IF NOT EXISTS idx_work_items_claimable
  ON public.work_items (tenant_id, kind, priority, next_check_at)
  WHERE status IN ('pending','waiting');

-- Tenant-composite primary key index (standard pattern from shared-database-tenancy).
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_tenant_id_id
  ON public.work_items (tenant_id, id);

-- Find work by entity for the agent activity surface.
CREATE INDEX IF NOT EXISTS idx_work_items_entity
  ON public.work_items (tenant_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- Stale claim recovery scan.
CREATE INDEX IF NOT EXISTS idx_work_items_stale_leases
  ON public.work_items (tenant_id, lease_expires_at)
  WHERE status IN ('claimed','in_progress') AND lease_expires_at IS NOT NULL;

-- =============================================================================
-- Row-level security: same policy as every operational table.
-- =============================================================================
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.work_items
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
-- Claim RPC: atomically claim a work item for execution.
--
-- Follows the claim_revenue_job_run gold-standard pattern:
--   1. Resolve tenant from request context (fail-closed)
--   2. Acquire advisory lock scoped to tenant_id:work_item_id
--   3. Recover any stale claims past their lease_expires_at
--   4. If a specific item is requested, claim it if eligible
--   5. Otherwise claim the highest-priority eligible item of the given kind
--   6. Increment attempt_count, set lease fields, transition to 'claimed'
--   7. Return { work_item_id, claimed, existing_status, recovered_stale }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_work_item(
  p_kind TEXT,
  p_work_item_id UUID DEFAULT NULL,
  p_lease_owner TEXT DEFAULT NULL,
  p_lease_duration_ms INTEGER DEFAULT 1800000
) RETURNS TABLE (
  work_item_id UUID,
  claimed BOOLEAN,
  existing_status TEXT,
  recovered_stale BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_target public.work_items%ROWTYPE;
  v_stale public.work_items%ROWTYPE;
  v_recovered_stale BOOLEAN := false;
BEGIN
  -- Fail-closed tenant resolution.
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_kind IS NULL OR btrim(p_kind) = '' THEN
    RAISE EXCEPTION 'kind is required';
  END IF;

  IF p_lease_duration_ms < 60000 THEN
    RAISE EXCEPTION 'lease duration must be at least 60 seconds';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1: Recover stale claims for this tenant and kind.
  -- -------------------------------------------------------------------------
  FOR v_stale IN
    SELECT * FROM public.work_items
    WHERE tenant_id = v_tenant_id
      AND kind = p_kind
      AND status IN ('claimed', 'in_progress')
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < now()
    ORDER BY lease_expires_at
  LOOP
    IF v_stale.attempt_count >= v_stale.max_attempts THEN
      UPDATE public.work_items
      SET status = 'failed',
          error = 'Stale claim expired past max attempts',
          finished_at = now()
      WHERE id = v_stale.id AND status = v_stale.status;
    ELSE
      UPDATE public.work_items
      SET status = 'pending',
          lease_owner = NULL,
          lease_expires_at = NULL
      WHERE id = v_stale.id AND status = v_stale.status;
    END IF;
    v_recovered_stale := true;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Step 2: Find the target item.
  -- -------------------------------------------------------------------------
  IF p_work_item_id IS NOT NULL THEN
    -- Claim a specific item by ID.
    SELECT * INTO v_target FROM public.work_items
    WHERE id = p_work_item_id AND tenant_id = v_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN QUERY SELECT p_work_item_id, false, 'not_found'::TEXT, v_recovered_stale;
      RETURN;
    END IF;

    IF v_target.status NOT IN ('pending', 'waiting') THEN
      RETURN QUERY SELECT v_target.id, false, v_target.status, v_recovered_stale;
      RETURN;
    END IF;

    IF v_target.status = 'waiting' AND v_target.next_check_at IS NOT NULL AND v_target.next_check_at > now() THEN
      RETURN QUERY SELECT v_target.id, false, v_target.status, v_recovered_stale;
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_tenant_id::text || ':work-item:' || v_target.id::text, 0)
    );
  ELSE
    -- Claim the highest-priority eligible item of this kind.
    -- Priority order: urgent > high > medium > low, then earliest next_check_at.
    SELECT * INTO v_target FROM public.work_items
    WHERE tenant_id = v_tenant_id
      AND kind = p_kind
      AND status IN ('pending', 'waiting')
      AND (next_check_at IS NULL OR next_check_at <= now())
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 3
      END,
      next_check_at ASC NULLS LAST,
      created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN QUERY SELECT v_target.id, false, 'none_available'::TEXT, v_recovered_stale;
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_tenant_id::text || ':work-item:' || v_target.id::text, 0)
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Claim the item.
  -- -------------------------------------------------------------------------
  UPDATE public.work_items
  SET status = 'claimed',
      lease_owner = COALESCE(p_lease_owner, 'anonymous'),
      lease_expires_at = now() + (p_lease_duration_ms || ' milliseconds')::interval,
      attempt_count = attempt_count + 1,
      claimed_at = now(),
      next_check_at = NULL,
      next_check_reason = NULL
  WHERE id = v_target.id
    AND tenant_id = v_tenant_id
    AND status IN ('pending', 'waiting');

  IF NOT FOUND THEN
    -- Race: someone else claimed it between our SELECT and UPDATE.
    RETURN QUERY SELECT v_target.id, false, 'race_lost'::TEXT, v_recovered_stale;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_target.id, true, 'claimed'::TEXT, v_recovered_stale;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_work_item(TEXT, UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_work_item(TEXT, UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_work_item(TEXT, UUID, TEXT, INTEGER) IS
  'Atomically claims one eligible work item for execution. Recovers stale leases, acquires an advisory lock, increments attempt_count, and transitions the item to claimed. Returns whether the claim succeeded.';

-- =============================================================================
-- Validation constraint: next_check_reason is required when next_check_at is set.
-- Enforces the northstar principle that every scheduled future action must
-- carry a reason. No unexplained "check again in 14 days".
-- =============================================================================
ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_next_check_reason_required
  CHECK (
    next_check_at IS NULL
    OR (next_check_at IS NOT NULL AND next_check_reason IS NOT NULL AND btrim(next_check_reason) <> '')
  );

-- =============================================================================
-- Validation constraint: reason is never null or empty.
-- =============================================================================
ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_reason_required
  CHECK (btrim(reason) <> '');
