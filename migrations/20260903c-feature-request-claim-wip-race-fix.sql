-- =============================================================================
-- claim_feature_request follow-up: close a real WIP-limit race.
--
-- Found live, not hypothetically: the board hit 7 in_progress cards against
-- a WIP limit of 6. The per-card advisory lock (added when claiming a
-- specific target) only serializes two claims racing for the SAME card; the
-- WIP-count SELECT that runs before it had no lock at all, so two concurrent
-- claim_feature_request calls for DIFFERENT cards could both read the same
-- (stale, pre-commit) count, both see it under the limit, and both succeed —
-- a classic time-of-check-to-time-of-use race, and exactly the shape of bug
-- multiple concurrent agents calling `agent:next` would trigger.
--
-- Fix: acquire one fixed-key advisory lock at the very top of the function,
-- before the stale-claim recovery sweep even runs (that sweep also changes
-- what the WIP count will read). Every claim attempt — regardless of which
-- card it targets — now serializes through this one section. Claim volume
-- is low (agents claiming work, not a high-throughput path), so full
-- serialization here is the correct trade, not a bottleneck.
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

  -- Serialize the whole claim decision (stale recovery + WIP count + target
  -- resolution) across every concurrent caller, not just callers racing for
  -- the same card. Held for the rest of this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('feature-request-wip-gate', 0));

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

  SELECT count(*) INTO v_in_progress_count
  FROM public.feature_requests
  WHERE status = 'in_progress'
    AND archived_at IS NULL
    AND (lease_expires_at IS NULL OR lease_expires_at > now());

  IF v_in_progress_count >= p_wip_limit THEN
    RETURN QUERY SELECT NULL::UUID, false, 'wip_limit_reached'::TEXT, v_recovered_stale;
    RETURN;
  END IF;

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
  ELSE
    -- Auto-pick: restrict to milestone:now|next (dependency-ready + in the
    -- current planning horizon), not just status + priority. The wip-gate
    -- lock above already serializes this against every other claim, so
    -- FOR UPDATE SKIP LOCKED here is belt-and-suspenders, not load-bearing.
    SELECT * INTO v_target FROM public.feature_requests
    WHERE status IN ('backlog', 'planned')
      AND archived_at IS NULL
      AND ('milestone:now' = ANY(labels) OR 'milestone:next' = ANY(labels))
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
  END IF;

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
    RETURN QUERY SELECT v_target.id, false, 'race_lost'::TEXT, v_recovered_stale;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_target.id, true, 'in_progress'::TEXT, v_recovered_stale;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER) IS
  'Atomically claims one eligible Feature Board card for a coding agent. The whole claim decision (stale-lease recovery, WIP-limit count, target resolution) is serialized behind one fixed advisory lock, so concurrent claims for different cards cannot both read a stale WIP count and both succeed. Auto-pick (no explicit id/seed_key) is restricted to milestone:now|next. Returns whether the claim succeeded.';
