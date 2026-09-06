-- =============================================================================
-- Feature Board atomic claim: lease columns + claim_feature_request RPC.
--
-- The Feature Board (feature_requests) is the coding-agent coordination
-- mechanism for this codebase, but claiming a card today is a manual social
-- protocol (docs/contributing/AGENT-TICKET-RUNBOOK.md): edit `owner` in the
-- manifest file, run `npm run seed:features -- --apply`. `owner` is a plain
-- nullable TEXT column with no lease, no expiry, no concurrency check — two
-- agents racing a claim silently clobber each other, last write wins.
--
-- This migration retrofits the same atomic claim pattern already proven for
-- work_items (migrations/20260902-work-items.sql claim_work_item): advisory
-- lock + FOR UPDATE SKIP LOCKED + lease expiry + stale-claim recovery. One
-- deliberate deviation: feature_requests is platform-global (no tenant_id
-- column), so there is no tenant-scoped advisory lock component and no RLS
-- tenant policy to add — this table's existing RLS (service-role only,
-- migrations/20260816-feature-board.sql) already fits.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_feature_requests_stale_leases
  ON public.feature_requests (lease_expires_at)
  WHERE status = 'in_progress' AND lease_expires_at IS NOT NULL;

-- =============================================================================
-- Claim RPC: atomically claim a Feature Board card for execution.
--
--   1. Recover any stale claims past their lease_expires_at (-> 'blocked',
--      not 'pending' — a stalled card should surface to a human, not
--      silently re-enter the pool and get picked up again unexamined).
--   2. Enforce the WIP limit (max concurrent in_progress cards) at the
--      database, replacing the JS-only array-length check in
--      scripts/feature-backlog-data.mjs's validateFeatureBacklog(), which is
--      trivially bypassable by anyone editing the manifest directly.
--   3. Resolve the target card: by id/seed_key if given, else the
--      highest-priority eligible backlog/planned card, FOR UPDATE SKIP LOCKED.
--   4. Acquire an advisory lock scoped to the card id.
--   5. Claim: status='in_progress', owner/lease_owner=p_lease_owner,
--      lease_expires_at=now()+duration, claimed_at=now().
--   6. Return { feature_request_id, claimed, existing_status, recovered_stale }.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_feature_request(
  p_seed_key TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_lease_owner TEXT DEFAULT NULL,
  p_lease_duration_ms INTEGER DEFAULT 1800000,
  p_wip_limit INTEGER DEFAULT 6
) RETURNS TABLE (
  feature_request_id UUID,
  claimed BOOLEAN,
  existing_status TEXT,
  recovered_stale BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.feature_requests%ROWTYPE;
  v_stale public.feature_requests%ROWTYPE;
  v_recovered_stale BOOLEAN := false;
  v_in_progress_count INTEGER;
BEGIN
  IF p_lease_owner IS NULL OR btrim(p_lease_owner) = '' THEN
    RAISE EXCEPTION 'lease_owner is required';
  END IF;

  IF p_lease_duration_ms < 60000 THEN
    RAISE EXCEPTION 'lease duration must be at least 60 seconds';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1: Recover stale claims (any card, not scoped to the requested one —
  -- a stale lease anywhere on the board should surface before a new claim).
  -- -------------------------------------------------------------------------
  FOR v_stale IN
    SELECT * FROM public.feature_requests
    WHERE status = 'in_progress'
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < now()
      AND archived_at IS NULL
    ORDER BY lease_expires_at
  LOOP
    UPDATE public.feature_requests
    SET status = 'blocked',
        notes = COALESCE(notes, '') || E'\n\nStale claim recovered ' || now()::text
                || ': lease by ' || COALESCE(v_stale.lease_owner, 'unknown')
                || ' expired without completion or release.',
        lease_owner = NULL,
        lease_expires_at = NULL
    WHERE id = v_stale.id AND status = v_stale.status;
    v_recovered_stale := true;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Step 2: WIP gate.
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO v_in_progress_count
  FROM public.feature_requests
  WHERE status = 'in_progress'
    AND archived_at IS NULL
    AND (lease_expires_at IS NULL OR lease_expires_at > now());

  IF v_in_progress_count >= p_wip_limit THEN
    RETURN QUERY SELECT NULL::UUID, false, 'wip_limit_reached'::TEXT, v_recovered_stale;
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3: Resolve the target card.
  -- -------------------------------------------------------------------------
  IF p_id IS NOT NULL OR p_seed_key IS NOT NULL THEN
    SELECT * INTO v_target FROM public.feature_requests
    WHERE (p_id IS NOT NULL AND id = p_id)
       OR (p_seed_key IS NOT NULL AND seed_key = p_seed_key)
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN QUERY SELECT p_id, false, 'not_found'::TEXT, v_recovered_stale;
      RETURN;
    END IF;

    IF v_target.archived_at IS NOT NULL THEN
      RETURN QUERY SELECT v_target.id, false, 'archived'::TEXT, v_recovered_stale;
      RETURN;
    END IF;

    IF v_target.status NOT IN ('backlog', 'planned') THEN
      RETURN QUERY SELECT v_target.id, false, v_target.status, v_recovered_stale;
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended('feature-request:' || v_target.id::text, 0)
    );
  ELSE
    SELECT * INTO v_target FROM public.feature_requests
    WHERE status IN ('backlog', 'planned')
      AND archived_at IS NULL
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 3
      END,
      sort_order ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::UUID, false, 'none_available'::TEXT, v_recovered_stale;
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended('feature-request:' || v_target.id::text, 0)
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 4: Claim the card.
  -- -------------------------------------------------------------------------
  UPDATE public.feature_requests
  SET status = 'in_progress',
      owner = p_lease_owner,
      lease_owner = p_lease_owner,
      lease_expires_at = now() + (p_lease_duration_ms || ' milliseconds')::interval,
      claimed_at = now()
  WHERE id = v_target.id
    AND status IN ('backlog', 'planned')
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    -- Race: someone else claimed it between our SELECT and UPDATE.
    RETURN QUERY SELECT v_target.id, false, 'race_lost'::TEXT, v_recovered_stale;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_target.id, true, 'in_progress'::TEXT, v_recovered_stale;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) IS
  'Atomically claims one eligible Feature Board card for a coding agent. Recovers stale leases to blocked, enforces the in-progress WIP limit, acquires an advisory lock, and transitions the card to in_progress. Returns whether the claim succeeded.';
