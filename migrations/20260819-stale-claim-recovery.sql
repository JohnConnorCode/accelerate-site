-- A crashed job used to disable its cron permanently.
--
-- `idx_job_runs_one_active_per_job` allows one running row per job key, and
-- `claim_revenue_job_run` returned "not claimed" for any existing running row
-- with no age check. The only transitions out of `running` are finishJobRun and
-- failJobRun, both executed inside the process doing the work, so a Vercel
-- timeout, OOM, or redeploy left the row `running` forever. Every subsequent
-- cron then returned HTTP 200 with {skipped:true} and Vercel showed green,
-- while the job never ran again until somebody edited the database by hand.
--
-- Both Vercel Hobby cron slots are already used, so recovery cannot be its own
-- scheduled job. It belongs inside the claim itself, where the advisory lock
-- already serializes access.
--
-- A claim older than the stale window is closed as failed with an explicit
-- reason, and the caller is told a takeover happened so it can be alerted on
-- rather than silently absorbed.
--
-- Additive and idempotent. The function gains a return column, which is safe in
-- both deploy orders: older application code ignores the extra field, and newer
-- code treats a missing field as false.

ALTER TABLE public.job_runs ADD COLUMN IF NOT EXISTS recovered_from UUID;

DROP FUNCTION IF EXISTS public.claim_revenue_job_run(TEXT, TEXT);

CREATE FUNCTION public.claim_revenue_job_run(
  p_job_key TEXT,
  p_claim_key TEXT DEFAULT NULL,
  p_stale_after INTERVAL DEFAULT INTERVAL '30 minutes'
) RETURNS TABLE (run_id UUID, claimed BOOLEAN, existing_status TEXT, recovered_stale BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.job_runs%ROWTYPE;
  v_recovered UUID;
BEGIN
  IF p_job_key IS NULL OR btrim(p_job_key) = '' THEN
    RAISE EXCEPTION 'job key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('revenue-os-job:' || p_job_key, 0));

  -- Close out an abandoned claim before deciding whether this run may proceed.
  -- Bounded by age so a genuinely long-running job is never stolen from.
  UPDATE public.job_runs
     SET status = 'failed',
         finished_at = now(),
         error = COALESCE(error, 'Run abandoned before reporting a terminal state and was recovered by a later claim')
   WHERE job_key = p_job_key
     AND status = 'running'
     AND claimed_at < now() - p_stale_after
  RETURNING id INTO v_recovered;

  SELECT * INTO v_existing
  FROM public.job_runs
  WHERE job_key = p_job_key AND status = 'running'
  ORDER BY claimed_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, false, v_existing.status, false;
    RETURN;
  END IF;

  IF p_claim_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.job_runs
    WHERE claim_key = p_claim_key
    ORDER BY claimed_at DESC
    LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, false, v_existing.status, false;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.job_runs (job_key, claim_key, status, idempotency_key, recovered_from)
  VALUES (p_job_key, p_claim_key, 'running', p_claim_key, v_recovered)
  RETURNING * INTO v_existing;
  RETURN QUERY SELECT v_existing.id, true, v_existing.status, (v_recovered IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) TO service_role;

COMMENT ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) IS
  'Atomically claims one active Revenue OS job. Existing running or idempotent receipts are returned without starting duplicate work. A claim older than p_stale_after is closed as failed so an abandoned run cannot disable its job forever.';

COMMENT ON COLUMN public.job_runs.recovered_from IS
  'Set when this run took over from an abandoned claim; references the run that was closed as failed.';

-- Release any claim already abandoned before this migration, so the two live
-- crons are not still blocked by a run that crashed earlier.
UPDATE public.job_runs
   SET status = 'failed',
       finished_at = now(),
       error = COALESCE(error, 'Run abandoned before reporting a terminal state and was recovered during stale-claim migration')
 WHERE status = 'running'
   AND claimed_at < now() - INTERVAL '30 minutes';
