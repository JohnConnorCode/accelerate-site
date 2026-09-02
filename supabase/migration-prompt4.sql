-- Migration Prompt 4: Missing tables, constraint fixes, RLS policies
-- Run this after migration-prompt3.sql

-- 1. Contact submissions table (referenced by /api/contact but never created)
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage contact_submissions" ON contact_submissions;
CREATE POLICY "Service role can manage contact_submissions"
  ON contact_submissions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anonymous can insert contact_submissions" ON contact_submissions;
CREATE POLICY "Anonymous can insert contact_submissions"
  ON contact_submissions FOR INSERT
  WITH CHECK (true);

-- 2. Subscribers table (referenced by /api/subscribe but never created)
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'website',
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_subscribed_at ON subscribers(subscribed_at DESC);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage subscribers" ON subscribers;
CREATE POLICY "Service role can manage subscribers"
  ON subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anonymous can insert subscribers" ON subscribers;
CREATE POLICY "Anonymous can insert subscribers"
  ON subscribers FOR INSERT
  WITH CHECK (true);

-- 3. Fix email_sequences status constraint to allow 'paused'
ALTER TABLE email_sequences DROP CONSTRAINT IF EXISTS email_sequences_status_check;
ALTER TABLE email_sequences ADD CONSTRAINT email_sequences_status_check
  CHECK (status IN ('active', 'completed', 'unsubscribed', 'paused'));
