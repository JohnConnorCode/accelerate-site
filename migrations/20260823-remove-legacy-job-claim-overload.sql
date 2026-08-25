-- PostgREST cannot disambiguate the legacy two-argument claim function from
-- the current three-argument function because the latter supplies a default
-- for p_stale_after. Keep one canonical RPC signature so service-role callers
-- that omit the optional recovery window resolve deterministically.

DROP FUNCTION IF EXISTS public.claim_revenue_job_run(TEXT, TEXT);

REVOKE ALL ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) TO service_role;

COMMENT ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT,INTERVAL) IS
  'Atomically claims one Revenue OS job. The optional stale window defaults to 30 minutes; abandoned runs are failed and linked to their recovery claim.';
