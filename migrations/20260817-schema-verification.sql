-- Immutable receipts for read-only Revenue OS schema-contract verification.
-- This migration never changes business tables and is safe to re-run.

CREATE TABLE IF NOT EXISTS public.schema_verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'unapplied_migration', 'drift', 'connectivity_failure')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_code TEXT,
  failure_detail TEXT,
  checked_by TEXT NOT NULL DEFAULT 'system',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_verification_runs_latest
  ON public.schema_verification_runs (checked_at DESC);

ALTER TABLE public.schema_verification_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.schema_verification_runs;
CREATE POLICY "Service role full access" ON public.schema_verification_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.schema_verification_runs IS
  'Immutable, read-only schema-contract verification receipts. A success means metadata was checked; it does not prove provider health.';
