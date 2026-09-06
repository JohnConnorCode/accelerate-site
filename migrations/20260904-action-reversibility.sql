-- Unified action executor, reversibility axis (Plugin Platform phase 1,
-- primitive 3: Actions).
--
-- Impact says how far an effect reaches; reversibility says whether core can
-- restore the prior state. They are separate declared axes and must never be
-- collapsed into one field. Every executed action records what would undo it
-- (compensation) and what justified it (evidence) so a compensator and an
-- auditor never have to reconstruct either after the fact.
--
-- ADDITIVE ONLY: three nullable-or-defaulted columns on action_queue. No
-- existing object is altered. Re-runnable.
ALTER TABLE public.action_queue
  ADD COLUMN IF NOT EXISTS reversibility TEXT
    CHECK (reversibility IS NULL OR reversibility IN ('reversible', 'compensable', 'irreversible'));
ALTER TABLE public.action_queue
  ADD COLUMN IF NOT EXISTS compensation JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.action_queue
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.action_queue.reversibility IS
  'Whether core can restore prior state automatically (reversible), a compensating action exists (compensable), or the effect leaves the system (irreversible). NULL on rows written before the executor stamped them.';
COMMENT ON COLUMN public.action_queue.compensation IS
  'Inverse data captured at execution time (prior values, created ids) that a compensator needs to undo the effect.';
COMMENT ON COLUMN public.action_queue.evidence IS
  'Evidence supplied with the proposal and recorded at execution: quotes, receipts, and resolved entities.';
