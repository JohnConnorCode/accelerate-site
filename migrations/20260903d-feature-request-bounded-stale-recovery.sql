-- =============================================================================
-- claim_feature_request follow-up: bounded retry on stale-lease recovery,
-- instead of a one-strike drop to `blocked`.
--
-- 20260903-feature-request-claims.sql made a deliberate choice (its own
-- comment says so): any card whose lease expires without agent:complete or
-- agent:release goes straight to `blocked` so "a stalled card should surface
-- to a human, not silently re-enter the pool and get picked up again
-- unexamined." Audited live 2026-09-03/04: every lease expiry that day was a
-- coding-agent session ending mid-task (context limit, crash, interrupted
-- run) — not a card that is actually broken. One-strike-to-blocked treated
-- routine, transient failures the same as a genuinely stuck card, and
-- nothing surfaced the difference: `blocked` cards were invisible to
-- `agent:status` (fixed separately in scripts/agent-dispatch.ts) and
-- unclaimable by design, so real, unfinished work just stopped circulating
-- until a human happened to notice.
--
-- This is the same shape of problem AWS SQS (visibility timeout + redrive
-- policy), Kubernetes/etcd/ZooKeeper leader election (short TTL lease with
-- periodic renewal), and Celery/Temporal task queues all solve the same way:
-- a lease that lapses returns the item to the available pool automatically —
-- that IS the crash-recovery mechanism, not a failure state — and only
-- repeated, consecutive failures on the same item escalate to a dead-letter
-- / human-review queue (SQS's maxReceiveCount redrive policy is the direct
-- analogue). Applying that here:
--
--   - stale_recovery_count increments every time a lease on that card lapses.
--   - Below p_stale_retry_limit (default 3, mirrors typical DLQ
--     maxReceiveCount ranges): requeue to `planned` — immediately reclaimable
--     by `agent:next`, same as any other planned card. The claim system's
--     existing worktree/branch reuse (scripts/agent-dispatch.ts createWorktree:
--     reuses the path and branch if they already exist) means the next
--     claimant resumes from whatever the previous agent left uncommitted,
--     the git-backed checkpoint pattern used by multi-agent coding
--     orchestrators for exactly this recovery case.
--   - At or above the limit: status = 'blocked', same as before — now a
--     genuine escalation after repeated failure, not a hair-trigger.
--
-- Successfully shipping a card resets its count to 0 (src/lib/revenue-os/
-- feature-board-claims.ts completeFeatureCard) — a card that ships clean
-- after a rocky start shouldn't carry a stale grudge into any future reopen.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS stale_recovery_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_feature_request(
  p_seed_key TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_lease_owner TEXT DEFAULT NULL,
  p_lease_duration_ms INTEGER DEFAULT 1800000,
  p_wip_limit INTEGER DEFAULT 6,
  p_stale_retry_limit INTEGER DEFAULT 3
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
  v_new_recovery_count INTEGER;
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
    v_new_recovery_count := v_stale.stale_recovery_count + 1;

    IF v_new_recovery_count >= p_stale_retry_limit THEN
      UPDATE public.feature_requests
      SET status = 'blocked',
          stale_recovery_count = v_new_recovery_count,
          notes = COALESCE(notes, '') || E'\n\nStale claim recovered ' || now()::text
                  || ': lease by ' || COALESCE(v_stale.lease_owner, 'unknown')
                  || ' expired without completion or release. This is recovery #'
                  || v_new_recovery_count || ' (limit ' || p_stale_retry_limit
                  || ') — blocked for human review instead of auto-requeued.',
          lease_owner = NULL,
          lease_expires_at = NULL
      WHERE id = v_stale.id AND status = v_stale.status;
    ELSE
      UPDATE public.feature_requests
      SET status = 'planned',
          stale_recovery_count = v_new_recovery_count,
          notes = COALESCE(notes, '') || E'\n\nStale claim recovered ' || now()::text
                  || ': lease by ' || COALESCE(v_stale.lease_owner, 'unknown')
                  || ' expired without completion or release. Auto-requeued (attempt '
                  || v_new_recovery_count || '/' || p_stale_retry_limit
                  || ') — if a worktree exists at ../.agent-worktrees/<seed_key> with'
                  || ' uncommitted changes, resume from it rather than starting over.',
          lease_owner = NULL,
          lease_expires_at = NULL
      WHERE id = v_stale.id AND status = v_stale.status;
    END IF;
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

REVOKE ALL ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- The old 5-arg signature is a distinct overload as far as Postgres is
-- concerned; drop it so PostgREST (and any stale RPC cache) can't resolve to
-- it instead of the 6-arg version above.
DROP FUNCTION IF EXISTS public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER);

COMMENT ON FUNCTION public.claim_feature_request(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER) IS
  'Atomically claims one eligible Feature Board card for a coding agent. A lapsed lease auto-requeues the card to planned (bounded by p_stale_retry_limit consecutive recoveries, tracked in stale_recovery_count) rather than dropping straight to blocked, matching standard queue-visibility-timeout/DLQ practice; only repeated failures escalate to blocked for human review. The whole claim decision is serialized behind one fixed advisory lock so concurrent claims for different cards cannot both read a stale WIP count. Auto-pick (no explicit id/seed_key) is restricted to milestone:now|next.';
