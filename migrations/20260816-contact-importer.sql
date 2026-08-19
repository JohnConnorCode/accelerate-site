-- =============================================================================
-- Approval-gated AI contact importer
-- Run after migrations/20260816-revenue-os.sql. Safe to re-run.
-- Analysis is read/proposal work. Only an approved, digest-bound batch may claim
-- execution. Source rows and receipts are service-role only.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contact_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN (
    'analyzing','ready','approved','executing','completed','partial','failed','cancelled'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN ('csv','tsv','json','text')),
  original_filename TEXT,
  source_digest TEXT NOT NULL,
  source_excerpt TEXT,
  source_row_count INTEGER NOT NULL DEFAULT 0 CHECK (source_row_count >= 0),
  proposed_row_count INTEGER NOT NULL DEFAULT 0 CHECK (proposed_row_count >= 0),
  selected_row_count INTEGER NOT NULL DEFAULT 0 CHECK (selected_row_count >= 0),
  review_digest TEXT,
  approval_digest TEXT,
  ai_provider TEXT NOT NULL DEFAULT 'openrouter' CHECK (ai_provider = 'openrouter'),
  ai_model TEXT,
  ai_request_id TEXT,
  ai_usage JSONB NOT NULL DEFAULT '{}',
  instructions TEXT,
  summary JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  execution_claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_import_batches_recent
  ON contact_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_import_batches_status
  ON contact_import_batches(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS contact_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES contact_import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed','needs_review','skipped','importing','imported','failed'
  )),
  action TEXT NOT NULL DEFAULT 'create' CHECK (action IN ('create','update','skip')),
  included BOOLEAN NOT NULL DEFAULT true,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  raw_data JSONB NOT NULL DEFAULT '{}',
  proposed_data JSONB NOT NULL DEFAULT '{}',
  reviewed_data JSONB NOT NULL DEFAULT '{}',
  warnings TEXT[] NOT NULL DEFAULT '{}',
  errors TEXT[] NOT NULL DEFAULT '{}',
  match_reason TEXT,
  matched_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  matched_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  imported_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  imported_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  result_summary JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_contact_import_rows_batch
  ON contact_import_rows(batch_id, row_index);
CREATE INDEX IF NOT EXISTS idx_contact_import_rows_retry
  ON contact_import_rows(batch_id, status) WHERE included = true;

CREATE TABLE IF NOT EXISTS contact_import_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES contact_import_batches(id) ON DELETE CASCADE,
  row_id UUID REFERENCES contact_import_rows(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'analyzed','review_saved','approved','execution_started','row_imported',
    'row_skipped','row_failed','completed','partial','failed','cancelled'
  )),
  actor_email TEXT,
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_import_events_batch
  ON contact_import_events(batch_id, created_at DESC);

ALTER TABLE contact_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_import_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON contact_import_batches;
CREATE POLICY "Service role full access" ON contact_import_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON contact_import_rows;
CREATE POLICY "Service role full access" ON contact_import_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON contact_import_events;
CREATE POLICY "Service role full access" ON contact_import_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS contact_import_batches_touch_updated_at ON contact_import_batches;
CREATE TRIGGER contact_import_batches_touch_updated_at
  BEFORE UPDATE ON contact_import_batches
  FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();
DROP TRIGGER IF EXISTS contact_import_rows_touch_updated_at ON contact_import_rows;
CREATE TRIGGER contact_import_rows_touch_updated_at
  BEFORE UPDATE ON contact_import_rows
  FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();

-- Exactly one concurrent executor may claim an approved/retryable batch. The
-- approval stays valid only while the reviewed snapshot digest is unchanged.
CREATE OR REPLACE FUNCTION claim_contact_import_batch(
  p_batch_id UUID,
  p_actor_email TEXT
) RETURNS SETOF contact_import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE contact_import_batches
  SET status = 'executing',
      execution_claimed_at = now(),
      error = NULL,
      updated_at = now()
  WHERE id = p_batch_id
    AND status IN ('approved','partial','failed')
    AND approval_digest IS NOT NULL
    AND approval_digest = review_digest
    AND approved_by IS NOT NULL
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION claim_contact_import_batch(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_contact_import_batch(UUID, TEXT) TO service_role;

COMMENT ON TABLE contact_import_batches IS
  'Approval-gated import plans. An approval digest binds execution to the exact reviewed rows.';
COMMENT ON TABLE contact_import_rows IS
  'AI-proposed and founder-reviewed contact rows with deterministic match and terminal import receipts.';
