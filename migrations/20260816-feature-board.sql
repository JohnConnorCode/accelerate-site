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

-- This table intentionally starts empty. Accelerate's own 154-card roadmap
-- lives in scripts/feature-backlog-data.mjs (source of truth) and is applied
-- only to Accelerate's own reference deployment via
-- `npm run seed:features -- --apply` (see docs/REVENUE-OS-SETUP.md). A
-- fresh self-hosted install should not inherit Accelerate's product roadmap
-- as its own Feature Board; use this table for your own backlog instead.
-- (An earlier version of this migration inserted 12 stale, differently
-- worded copies of Accelerate roadmap cards here; that duplicated and
-- drifted from the manifest, so it was removed rather than kept in sync by
-- hand in two places.)
