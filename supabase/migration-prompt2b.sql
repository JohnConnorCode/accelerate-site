-- Accelerate Prompt 2B - Trust Infrastructure & Growth Systems
-- Run this after the initial migration.sql

-- ============================================
-- Case Studies
-- ============================================
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  location TEXT NOT NULL,
  hero_image TEXT,
  logo_url TEXT,
  challenge TEXT NOT NULL,
  solution TEXT NOT NULL,
  results TEXT NOT NULL,
  testimonial_quote TEXT,
  testimonial_author TEXT,
  testimonial_title TEXT,
  metrics JSONB NOT NULL DEFAULT '[]',
  services TEXT[] NOT NULL DEFAULT '{}',
  timeline TEXT NOT NULL,
  featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_slug ON case_studies(slug);
CREATE INDEX IF NOT EXISTS idx_case_studies_industry ON case_studies(industry);
CREATE INDEX IF NOT EXISTS idx_case_studies_featured ON case_studies(featured) WHERE featured = true;

-- ============================================
-- Website Grades
-- ============================================
CREATE TABLE IF NOT EXISTS website_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  email TEXT,
  overall_score INTEGER NOT NULL,
  categories JSONB NOT NULL,
  ai_recommendations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_grades_email ON website_grades(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_grades_created_at ON website_grades(created_at DESC);

-- ============================================
-- ROI Calculations
-- ============================================
CREATE TABLE IF NOT EXISTS roi_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  industry TEXT,
  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_calculations_email ON roi_calculations(email) WHERE email IS NOT NULL;

-- ============================================
-- Resource Downloads (Lead Magnets)
-- ============================================
CREATE TABLE IF NOT EXISTS resource_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_downloads_email ON resource_downloads(email);
CREATE INDEX IF NOT EXISTS idx_resource_downloads_resource_id ON resource_downloads(resource_id);

-- ============================================
-- Email Sequences
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN ('plan_nurture', 'resource_welcome', 'grader_followup')),
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unsubscribed')),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  next_send_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_next_send ON email_sequences(next_send_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_email_sequences_email ON email_sequences(email);

CREATE TABLE IF NOT EXISTS email_sequence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_logs_sequence_id ON email_sequence_logs(sequence_id);

-- ============================================
-- Partner Applications
-- ============================================
CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  website TEXT,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('referral', 'agency', 'technology')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON partner_applications(email);

-- ============================================
-- Changelog Entries
-- ============================================
CREATE TABLE IF NOT EXISTS changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('feature', 'improvement', 'fix', 'announcement')),
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_published_at ON changelog_entries(published_at DESC);

-- ============================================
-- RLS Policies
-- ============================================

-- Case Studies: public read, service_role write
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read case studies" ON case_studies;
CREATE POLICY "Public read case studies" ON case_studies FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Service role case studies" ON case_studies;
CREATE POLICY "Service role case studies" ON case_studies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Website Grades: public insert + read own, service_role all
ALTER TABLE website_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert grades" ON website_grades;
CREATE POLICY "Public insert grades" ON website_grades FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Service role grades" ON website_grades;
CREATE POLICY "Service role grades" ON website_grades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ROI Calculations: public insert, service_role all
ALTER TABLE roi_calculations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert roi" ON roi_calculations;
CREATE POLICY "Public insert roi" ON roi_calculations FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Service role roi" ON roi_calculations;
CREATE POLICY "Service role roi" ON roi_calculations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Resource Downloads: public insert, service_role all
ALTER TABLE resource_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert downloads" ON resource_downloads;
CREATE POLICY "Public insert downloads" ON resource_downloads FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Service role downloads" ON resource_downloads;
CREATE POLICY "Service role downloads" ON resource_downloads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Email Sequences: service_role only
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role sequences" ON email_sequences;
CREATE POLICY "Service role sequences" ON email_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE email_sequence_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role sequence logs" ON email_sequence_logs;
CREATE POLICY "Service role sequence logs" ON email_sequence_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Partner Applications: public insert, service_role all
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert partners" ON partner_applications;
CREATE POLICY "Public insert partners" ON partner_applications FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Service role partners" ON partner_applications;
CREATE POLICY "Service role partners" ON partner_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Changelog: public read, service_role write
ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read changelog" ON changelog_entries;
CREATE POLICY "Public read changelog" ON changelog_entries FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Service role changelog" ON changelog_entries;
CREATE POLICY "Service role changelog" ON changelog_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at triggers for new tables
DROP TRIGGER IF EXISTS case_studies_updated_at ON case_studies;
CREATE TRIGGER case_studies_updated_at BEFORE UPDATE ON case_studies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS email_sequences_updated_at ON email_sequences;
CREATE TRIGGER email_sequences_updated_at BEFORE UPDATE ON email_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS partner_applications_updated_at ON partner_applications;
CREATE TRIGGER partner_applications_updated_at BEFORE UPDATE ON partner_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
