-- First-party, privacy-minimised website measurement for Revenue OS.
-- No analytics vendor account, API key, IP address, user agent, or PII is stored.
-- Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS website_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  visitor_id UUID NOT NULL,
  event_name TEXT NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 80),
  path TEXT NOT NULL CHECK (char_length(path) BETWEEN 1 AND 300),
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_events_created_name
  ON website_events(created_at DESC, event_name);
CREATE INDEX IF NOT EXISTS idx_website_events_path_created
  ON website_events(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_events_source_created
  ON website_events(utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

ALTER TABLE website_events ENABLE ROW LEVEL SECURITY;
-- Event collection is deliberately server-only. The public endpoint validates
-- and writes using the service role; browser clients never receive table access.
REVOKE ALL ON TABLE website_events FROM anon, authenticated;
