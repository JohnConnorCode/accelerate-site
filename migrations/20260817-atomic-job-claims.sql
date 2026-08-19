-- One active Revenue OS job per logical key. Claiming is serialized in the
-- database so concurrent cron/manual invocations cannot both start work.
-- Safe to run repeatedly; this never retries or changes existing receipts.

ALTER TABLE public.job_runs ADD COLUMN IF NOT EXISTS claim_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_claim_key
  ON public.job_runs (claim_key) WHERE claim_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_one_active_per_job
  ON public.job_runs (job_key) WHERE status = 'running';

CREATE OR REPLACE FUNCTION public.claim_revenue_job_run(
  p_job_key TEXT,
  p_claim_key TEXT DEFAULT NULL
) RETURNS TABLE (run_id UUID, claimed BOOLEAN, existing_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.job_runs%ROWTYPE;
BEGIN
  IF p_job_key IS NULL OR btrim(p_job_key) = '' THEN
    RAISE EXCEPTION 'job key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('revenue-os-job:' || p_job_key, 0));

  SELECT * INTO v_existing
  FROM public.job_runs
  WHERE job_key = p_job_key AND status = 'running'
  ORDER BY claimed_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, false, v_existing.status;
    RETURN;
  END IF;

  IF p_claim_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.job_runs
    WHERE claim_key = p_claim_key
    ORDER BY claimed_at DESC
    LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, false, v_existing.status;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.job_runs (job_key, claim_key, status, idempotency_key)
  VALUES (p_job_key, p_claim_key, 'running', p_claim_key)
  RETURNING * INTO v_existing;
  RETURN QUERY SELECT v_existing.id, true, v_existing.status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT) IS
  'Atomically claims one active Revenue OS job. Existing running or idempotent receipts are returned without starting duplicate work.';
