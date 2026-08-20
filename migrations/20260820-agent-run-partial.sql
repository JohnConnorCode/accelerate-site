-- Allow an agent run to end as `partial`, and let a stuck run be recovered.
--
-- The loop threw when it exhausted its tool turns, so the founder lost the
-- whole answer, the run was recorded as an outright failure, and any actions
-- staged on earlier turns stayed in the approval queue with no conversation
-- explaining them. Returning what was gathered is the honest outcome, and the
-- engineering contract's failure-semantics table already names that state
-- `partial`. The CHECK did not allow it, so writing it would have been rejected
-- and the run would have sat in `running` forever.
--
-- Runs also had no recovery path at all. A Vercel timeout mid-loop left the row
-- `running` with finished_at null permanently, and unlike job_runs there was
-- not even an index making the problem visible. `cancelled` already exists in
-- the constraint and is the right terminal state for a run nobody is waiting on
-- any more.
--
-- Additive and idempotent.

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;
ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('running', 'completed', 'partial', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_agent_runs_active
  ON public.agent_runs (started_at) WHERE status = 'running';

COMMENT ON COLUMN public.agent_runs.status IS
  'running while in flight; completed on a final answer; partial when the loop stopped early and returned what it had; failed on error; cancelled when an abandoned run was reaped.';

-- Close any run abandoned before this migration so the ledger is not carrying
-- rows that will never reach a terminal state.
UPDATE public.agent_runs
   SET status = 'cancelled',
       finished_at = now(),
       error = COALESCE(error, 'Run abandoned before reporting a result and was closed during recovery')
 WHERE status = 'running'
   AND started_at < now() - INTERVAL '30 minutes';
