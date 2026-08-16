-- Roofing campaign opportunity and booking attribution
-- Run after migrations/business-operating-system.sql and migrations/utm-tracking.sql.

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company_website TEXT NOT NULL,
  role TEXT NOT NULL,
  revenue_band TEXT NOT NULL,
  primary_leak TEXT NOT NULL,
  qualified BOOLEAN NOT NULL DEFAULT false,
  qualification_reason TEXT,
  qualifier_token TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL DEFAULT 'nurture' CHECK (
    stage IN ('nurture', 'qualified', 'calendar_viewed', 'booked', 'showed', 'no_show', 'proposal', 'won', 'lost')
  ),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_page TEXT,
  message_variant TEXT,
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,
  scheduled_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  showed_at TIMESTAMPTZ,
  estimated_value NUMERIC DEFAULT 0,
  won_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_scheduled_at ON opportunities(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_campaign ON opportunities(utm_source, utm_campaign);

CREATE TABLE IF NOT EXISTS opportunity_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_stage_events_opportunity
  ON opportunity_stage_events(opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calendly_webhook_receipts (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_webhook_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role opportunities" ON opportunities;
DROP POLICY IF EXISTS "Authenticated opportunities" ON opportunities;
DROP POLICY IF EXISTS "Service role opportunity events" ON opportunity_stage_events;
DROP POLICY IF EXISTS "Authenticated opportunity events" ON opportunity_stage_events;
DROP POLICY IF EXISTS "Service role calendly receipts" ON calendly_webhook_receipts;

CREATE POLICY "Service role opportunities" ON opportunities
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated opportunities" ON opportunities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role opportunity events" ON opportunity_stage_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated opportunity events" ON opportunity_stage_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role calendly receipts" ON calendly_webhook_receipts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE email_sequences DROP CONSTRAINT IF EXISTS email_sequences_sequence_type_check;
ALTER TABLE email_sequences ADD CONSTRAINT email_sequences_sequence_type_check
  CHECK (sequence_type IN (
    'plan_nurture', 'resource_welcome', 'grader_followup',
    'booking_nurture', 'roofing_nurture', 'manual_audit_followup'
  ));

CREATE OR REPLACE FUNCTION set_opportunity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_opportunity_updated_at();
