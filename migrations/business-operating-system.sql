-- =============================================================================
-- Admin Dashboard → Full Business Operating System
-- Run these migrations in Supabase SQL editor in order
-- =============================================================================

-- Phase 1: Tasks & Follow-ups
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed')),
  related_type TEXT CHECK (related_type IN ('lead', 'contact', 'partner', 'client')),
  related_id UUID,
  related_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  snoozed_until DATE
);
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE status = 'pending';
CREATE INDEX idx_tasks_related ON tasks(related_type, related_id);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 2: Client Management
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES solution_requests(id),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  industry TEXT,
  status TEXT DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused', 'churned')),
  monthly_value NUMERIC DEFAULT 0,
  one_time_value NUMERIC DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  services JSONB DEFAULT '[]',
  onboarding_checklist JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_email ON clients(contact_email);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 3: Sent Email History
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT CHECK (related_type IN ('lead', 'contact', 'client')),
  related_id UUID,
  template_used TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sent_emails_to ON sent_emails(to_email);
CREATE INDEX idx_sent_emails_related ON sent_emails(related_type, related_id);
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON sent_emails FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON sent_emails FOR SELECT TO authenticated USING (true);

-- Phase 5: Proposals
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES solution_requests(id),
  client_name TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  total_one_time NUMERIC DEFAULT 0,
  total_monthly NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_proposals_lead ON proposals(lead_id);
CREATE INDEX idx_proposals_token ON proposals(share_token);
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON proposals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 7: Smart Notifications v2 — add priority column
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'info' CHECK (priority IN ('urgent', 'important', 'info'));
