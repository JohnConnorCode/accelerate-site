-- ========================================
-- UTM ATTRIBUTION TRACKING
-- Adds utm_source, utm_medium, utm_campaign to all lead capture tables
-- Run after: business-operating-system.sql
-- ========================================

-- solution_requests (plan builder)
ALTER TABLE solution_requests ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE solution_requests ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE solution_requests ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- contact_submissions
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- chat_leads
ALTER TABLE chat_leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE chat_leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE chat_leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- website_grades
ALTER TABLE website_grades ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE website_grades ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE website_grades ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- resource_downloads
ALTER TABLE resource_downloads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE resource_downloads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE resource_downloads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- partner_applications
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- subscribers
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- roi_calculations (used by Phase 3 ROI email capture)
ALTER TABLE roi_calculations ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE roi_calculations ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE roi_calculations ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
