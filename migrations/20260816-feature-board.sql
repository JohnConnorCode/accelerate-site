-- Internal product roadmap and feature delivery board.
-- Apply after migrations/20260816-revenue-os.sql.

CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog','planned','in_progress','blocked','shipped')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('urgent','high','medium','low')),
  labels TEXT[] NOT NULL DEFAULT '{}',
  sort_order NUMERIC NOT NULL DEFAULT 1000,
  owner TEXT,
  target_date DATE,
  acceptance_criteria TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_board
  ON feature_requests(status, sort_order) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feature_requests_priority
  ON feature_requests(priority) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feature_requests_labels
  ON feature_requests USING GIN(labels);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON feature_requests;
CREATE POLICY "Service role full access" ON feature_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION feature_requests_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS feature_requests_touch_updated_at ON feature_requests;
CREATE TRIGGER feature_requests_touch_updated_at
  BEFORE UPDATE ON feature_requests
  FOR EACH ROW EXECUTE FUNCTION feature_requests_touch_updated_at();

-- One transaction for every drag. The server route calls this only after
-- validating the complete payload and authenticating the founder.
CREATE OR REPLACE FUNCTION reorder_feature_requests(updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE affected INTEGER;
BEGIN
  WITH requested AS (
    SELECT id, status, sort_order
    FROM jsonb_to_recordset(updates) AS x(id UUID, status TEXT, sort_order NUMERIC)
    WHERE status IN ('backlog','planned','in_progress','blocked','shipped')
  )
  UPDATE feature_requests AS feature
  SET status = requested.status,
      sort_order = requested.sort_order,
      updated_at = now()
  FROM requested
  WHERE feature.id = requested.id AND feature.archived_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION reorder_feature_requests(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_feature_requests(JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reorder_feature_requests(JSONB) TO service_role;

-- Seed the known Revenue OS follow-up work. Stable keys keep reruns safe while
-- leaving titles, details, and ordering editable in the board after creation.
INSERT INTO feature_requests
  (seed_key, title, description, status, priority, labels, sort_order, acceptance_criteria, source)
VALUES
  ('revenue-os-production-migration', 'Apply and verify the Revenue OS migrations', 'Run the canonical Revenue OS migration followed by this Feature Board migration in production, then refresh every Setup Center check.', 'planned', 'urgent', ARRAY['database','launch'], 1000, 'Both migrations apply without errors; Setup Center reports both schemas ready; legacy opportunity data remains present.', 'revenue-os-plan'),
  ('production-browser-qa', 'Run production admin QA on desktop and mobile', 'Verify Today, Pipeline, Conversations, Campaigns, Proposals, Setup Center, and this board using the founder account.', 'planned', 'urgent', ARRAY['qa','launch'], 2000, 'Critical paths pass at desktop and mobile widths with no console errors or inaccessible controls.', 'revenue-os-plan'),
  ('campaign-unsubscribe', 'Complete campaign unsubscribe handling', 'Add a public unsubscribe endpoint, List-Unsubscribe headers, durable suppression state, and an operator-visible receipt.', 'backlog', 'urgent', ARRAY['campaigns','compliance'], 1000, 'One click suppresses the contact, queued steps stop, future campaigns exclude them, and the action is audited.', 'revenue-os-plan'),
  ('google-oauth-first-sync', 'Configure Google OAuth and run first Workspace sync', 'Enable Gmail, Calendar, and Drive APIs; add encrypted OAuth credentials; connect the founder account; and verify source receipts.', 'backlog', 'high', ARRAY['google','integration'], 2000, 'Gmail and Calendar sync successfully; only approved Drive folders are indexed; failures appear in Setup Center.', 'revenue-os-plan'),
  ('resend-webhooks', 'Add Resend delivery webhooks and suppression receipts', 'Process delivered, bounced, complained, opened, and clicked events idempotently and connect hard failures to campaign stop controls.', 'backlog', 'high', ARRAY['email','webhooks'], 3000, 'Webhook signatures are verified, receipts are idempotent, bounces and complaints suppress future sends, and activity is visible.', 'revenue-os-plan'),
  ('gmail-incremental-sync', 'Harden Gmail incremental synchronization', 'Persist history cursors, renew watches, recover expired cursors, and expose partial failures without duplicating messages.', 'backlog', 'high', ARRAY['gmail','reliability'], 4000, 'Repeated syncs are idempotent; expired history recovers safely; watch renewal and terminal receipts are observable.', 'revenue-os-plan'),
  ('canonical-attribution', 'Consolidate analytics on canonical source-to-revenue data', 'Make revenue reporting use contacts, companies, opportunities, stage events, and campaign attribution as its single source.', 'backlog', 'high', ARRAY['analytics','revenue'], 5000, 'Admin totals reconcile from first touch through won revenue and legacy dashboards no longer disagree.', 'revenue-os-plan'),
  ('revenue-os-tests', 'Add Revenue OS unit and browser coverage', 'Cover identity resolution, stage rules, campaign stops, action approvals, OAuth failure states, and the Feature Board reorder contract.', 'backlog', 'high', ARRAY['qa','reliability'], 6000, 'Automated tests protect all material write boundaries and run cleanly in CI and locally.', 'revenue-os-plan'),
  ('calendar-confirmation-flow', 'Add confirmation-gated calendar actions', 'Let the Revenue copilot propose creating or rescheduling a meeting while requiring the founder to approve the exact attendees and time.', 'backlog', 'medium', ARRAY['calendar','ai'], 7000, 'No event is written before confirmation; approved changes are idempotent and appear in the audit ledger.', 'revenue-os-plan'),
  ('drive-content-indexing', 'Extract and index approved Drive documents', 'Fetch text from selected documents, track content hashes, and ground research and proposal drafts in current approved material.', 'backlog', 'medium', ARRAY['drive','ai'], 8000, 'Only allowlisted folders are read, unchanged documents are skipped, and citations identify the source document.', 'revenue-os-plan'),
  ('admin-settings-consolidation', 'Consolidate admin settings and connection ownership', 'Remove duplicate controls, keep secrets environment-only, and route operational connection management through Setup Center.', 'backlog', 'medium', ARRAY['admin','setup'], 9000, 'Every setting has one authoritative surface and Setup Center links directly to it.', 'revenue-os-plan'),
  ('production-burn-in', 'Complete a 14-day automation health burn-in', 'Monitor campaign and Workspace jobs, provider receipts, retries, and audit history before increasing automation volume.', 'backlog', 'medium', ARRAY['operations','launch'], 10000, 'Fourteen consecutive days show terminal receipts, no silent failures, and documented recovery for any degraded run.', 'revenue-os-plan')
ON CONFLICT (seed_key) DO NOTHING;
