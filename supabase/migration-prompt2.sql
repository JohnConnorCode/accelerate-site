-- ========================================
-- PROMPT 2: Learning Hub, Admin, Chat, Email
-- ========================================

-- Add lead management columns to solution_requests
ALTER TABLE solution_requests
  ADD COLUMN IF NOT EXISTS lead_status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

-- Create content_calendar table
CREATE TABLE IF NOT EXISTS content_calendar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'outline', 'draft', 'review', 'published')),
  category text,
  target_keywords text[],
  pillar text,
  funnel_stage text CHECK (funnel_stage IN ('awareness', 'consideration', 'decision')),
  target_publish_date date,
  actual_publish_date date,
  author text DEFAULT 'Accelerate Team',
  notes text,
  seo_title text,
  seo_description text,
  word_count_target integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_leads table
CREATE TABLE IF NOT EXISTS chat_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  email text,
  conversation jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_category ON content_calendar(category);
CREATE INDEX IF NOT EXISTS idx_chat_leads_email ON chat_leads(email);
CREATE INDEX IF NOT EXISTS idx_solution_requests_lead_status ON solution_requests(lead_status);

-- Updated_at trigger for content_calendar
CREATE OR REPLACE FUNCTION update_content_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_calendar_updated_at ON content_calendar;
CREATE TRIGGER content_calendar_updated_at
  BEFORE UPDATE ON content_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_content_calendar_updated_at();

-- RLS policies
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_leads ENABLE ROW LEVEL SECURITY;

-- Content calendar: authenticated users can read/write
CREATE POLICY "Authenticated users can manage content_calendar"
  ON content_calendar FOR ALL
  USING (true)
  WITH CHECK (true);

-- Chat leads: anonymous can insert, service role can read all
CREATE POLICY "Anyone can insert chat_leads"
  ON chat_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage chat_leads"
  ON chat_leads FOR ALL
  USING (true);

-- Pre-populate content_calendar with published articles
INSERT INTO content_calendar (title, slug, status, category, target_keywords, pillar, funnel_stage, actual_publish_date, author, word_count_target) VALUES
  ('How AI Receptionists Work', 'how-ai-receptionists-work', 'published', 'lead-generation', ARRAY['AI receptionist', 'AI phone answering'], 'Lead Gen', 'awareness', '2026-02-15', 'Accelerate Team', 1800),
  ('Automate Lead Follow-Up', 'automate-lead-follow-up', 'published', 'lead-generation', ARRAY['automated lead follow-up', 'lead nurture'], 'Lead Gen', 'consideration', '2026-02-12', 'Accelerate Team', 1800),
  ('Website That Generates Leads', 'website-that-generates-leads', 'published', 'lead-generation', ARRAY['lead generation website', 'website converts'], 'Lead Gen', 'awareness', '2026-02-10', 'Accelerate Team', 1800),
  ('Local SEO 2026', 'local-seo-2026', 'published', 'local-seo', ARRAY['local SEO small business 2026'], 'Lead Gen', 'awareness', '2026-02-08', 'Accelerate Team', 1800),
  ('Small Business Automation Starter Kit', 'small-business-automation-starter-kit', 'published', 'automation', ARRAY['small business automation', 'automate tasks'], 'Automation', 'awareness', '2026-02-05', 'Accelerate Team', 1500),
  ('Zapier vs Make vs n8n', 'zapier-vs-make-vs-n8n', 'published', 'automation', ARRAY['Zapier vs Make', 'automation platform'], 'Automation', 'consideration', '2026-02-03', 'Accelerate Team', 1600),
  ('AI Email Writing', 'ai-email-writing', 'published', 'automation', ARRAY['AI email writing', 'ChatGPT for emails'], 'Automation', 'awareness', '2026-01-30', 'Accelerate Team', 1500),
  ('Best AI Tools Small Business 2026', 'best-ai-tools-small-business-2026', 'published', 'ai-tools', ARRAY['best AI tools small business 2026'], 'AI Tools', 'awareness', '2026-01-28', 'Accelerate Team', 1800),
  ('ChatGPT vs Claude vs Gemini', 'chatgpt-vs-claude-vs-gemini', 'published', 'ai-tools', ARRAY['ChatGPT vs Claude', 'AI assistant business'], 'AI Tools', 'consideration', '2026-01-25', 'Accelerate Team', 1700),
  ('Build AI Chatbot No Code', 'build-ai-chatbot-no-code', 'published', 'ai-tools', ARRAY['AI chatbot website', 'no-code chatbot'], 'AI Tools', 'consideration', '2026-01-22', 'Accelerate Team', 1500),
  ('AI for Contractors', 'ai-for-contractors', 'published', 'industry', ARRAY['AI for contractors', 'home services automation'], 'Industry', 'awareness', '2026-01-20', 'Accelerate Team', 1600),
  ('AI for Law Firms', 'ai-for-law-firms', 'published', 'industry', ARRAY['AI for law firms', 'solo attorney AI'], 'Industry', 'awareness', '2026-01-18', 'Accelerate Team', 1600),
  ('AI for Real Estate Agents', 'ai-for-real-estate-agents', 'published', 'industry', ARRAY['AI real estate', 'real estate lead follow-up'], 'Industry', 'awareness', '2026-01-15', 'Accelerate Team', 1600),
  ('AI for Small Business Starter Guide', 'ai-for-small-business-starter-guide', 'published', 'foundational', ARRAY['AI for small business', 'AI guide 2026'], 'Foundational', 'awareness', '2026-01-12', 'Accelerate Team', 1800),
  ('Chicago Small Businesses AI 2026', 'chicago-small-businesses-ai-2026', 'published', 'local-seo', ARRAY['AI small business Chicago'], 'Local SEO', 'awareness', '2026-01-10', 'Accelerate Team', 1600)
ON CONFLICT DO NOTHING;

-- Pre-populate 20 idea-status entries
INSERT INTO content_calendar (title, status, category, target_keywords, pillar, funnel_stage, author, word_count_target) VALUES
  ('AI for Dentists and Dental Practices', 'idea', 'industry', ARRAY['AI for dentists', 'dental practice automation'], 'Industry', 'awareness', 'Accelerate Team', 1500),
  ('How to Use AI for Social Media Marketing', 'idea', 'automation', ARRAY['AI social media', 'social media automation'], 'Automation', 'awareness', 'Accelerate Team', 1500),
  ('CRM Comparison: HubSpot vs GoHighLevel vs Salesforce', 'idea', 'ai-tools', ARRAY['CRM comparison', 'best CRM small business'], 'AI Tools', 'consideration', 'Accelerate Team', 1700),
  ('AI for Accounting and Bookkeeping', 'idea', 'automation', ARRAY['AI accounting', 'automated bookkeeping'], 'Automation', 'awareness', 'Accelerate Team', 1500),
  ('How to Write AI Prompts for Business', 'outline', 'foundational', ARRAY['AI prompts business', 'prompt engineering'], 'Foundational', 'awareness', 'Accelerate Team', 1400),
  ('Google Ads for Small Business: AI-Powered Strategies', 'idea', 'lead-generation', ARRAY['Google Ads AI', 'PPC small business'], 'Lead Gen', 'consideration', 'Accelerate Team', 1600),
  ('AI for Restaurants and Food Service', 'idea', 'industry', ARRAY['AI restaurants', 'restaurant automation'], 'Industry', 'awareness', 'Accelerate Team', 1500),
  ('Email Marketing Automation: Complete Guide', 'outline', 'automation', ARRAY['email marketing automation', 'email sequences'], 'Automation', 'consideration', 'Accelerate Team', 1800),
  ('How to Choose a Website Platform in 2026', 'idea', 'foundational', ARRAY['website platform comparison', 'WordPress vs Squarespace'], 'Foundational', 'awareness', 'Accelerate Team', 1500),
  ('AI for Insurance Agents', 'idea', 'industry', ARRAY['AI insurance agents', 'insurance automation'], 'Industry', 'awareness', 'Accelerate Team', 1500),
  ('Facebook and Instagram Ads with AI', 'idea', 'lead-generation', ARRAY['Facebook Ads AI', 'social media ads AI'], 'Lead Gen', 'consideration', 'Accelerate Team', 1500),
  ('Voice Search Optimization for Local Business', 'idea', 'local-seo', ARRAY['voice search SEO', 'voice search optimization'], 'Local SEO', 'awareness', 'Accelerate Team', 1400),
  ('AI for Healthcare and Medical Practices', 'idea', 'industry', ARRAY['AI healthcare', 'medical practice automation'], 'Industry', 'awareness', 'Accelerate Team', 1600),
  ('How to Build an Online Review Strategy', 'draft', 'lead-generation', ARRAY['online reviews strategy', 'get more reviews'], 'Lead Gen', 'awareness', 'Accelerate Team', 1500),
  ('Workflow Automation Case Studies', 'idea', 'automation', ARRAY['automation case studies', 'workflow automation ROI'], 'Automation', 'decision', 'Accelerate Team', 1500),
  ('AI-Powered Customer Service: Complete Guide', 'idea', 'ai-tools', ARRAY['AI customer service', 'AI support tools'], 'AI Tools', 'awareness', 'Accelerate Team', 1600),
  ('How Much Does a Business Website Cost in 2026?', 'idea', 'foundational', ARRAY['website cost 2026', 'business website pricing'], 'Foundational', 'awareness', 'Accelerate Team', 1400),
  ('SEO vs PPC: Where Should Small Businesses Invest?', 'idea', 'lead-generation', ARRAY['SEO vs PPC', 'search marketing budget'], 'Lead Gen', 'consideration', 'Accelerate Team', 1500),
  ('AI for Fitness Studios and Personal Trainers', 'idea', 'industry', ARRAY['AI fitness business', 'gym automation'], 'Industry', 'awareness', 'Accelerate Team', 1400),
  ('Chicago Digital Marketing Trends 2026', 'outline', 'local-seo', ARRAY['Chicago marketing trends', 'digital marketing Chicago'], 'Local SEO', 'awareness', 'Accelerate Team', 1500)
ON CONFLICT DO NOTHING;
