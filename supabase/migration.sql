-- Accelerate Solution Generator Database Schema
-- Run this in your Supabase SQL editor

-- Solution Requests table
CREATE TABLE IF NOT EXISTS solution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  industry TEXT NOT NULL,
  industry_other TEXT,
  business_name TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  intake_data JSONB NOT NULL,
  ai_plan JSONB,
  ai_model_used TEXT,
  estimated_value NUMERIC,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Plan Views tracking table
CREATE TABLE IF NOT EXISTS plan_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_request_id UUID REFERENCES solution_requests(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip_hash TEXT,
  referrer TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_solution_requests_share_token ON solution_requests(share_token);
CREATE INDEX IF NOT EXISTS idx_solution_requests_status ON solution_requests(status);
CREATE INDEX IF NOT EXISTS idx_solution_requests_created_at ON solution_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_views_solution_request_id ON plan_views(solution_request_id);

-- Enable Row Level Security
ALTER TABLE solution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_views ENABLE ROW LEVEL SECURITY;

-- Policies for solution_requests
DROP POLICY IF EXISTS "Allow anonymous inserts" ON solution_requests;
DROP POLICY IF EXISTS "Allow select by share_token" ON solution_requests;
DROP POLICY IF EXISTS "Service role full access" ON solution_requests;
DROP POLICY IF EXISTS "Allow anonymous insert views" ON plan_views;
DROP POLICY IF EXISTS "Service role full access views" ON plan_views;

-- Allow anonymous inserts (form submissions)
CREATE POLICY "Allow anonymous inserts" ON solution_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous selects by share_token (for shareable plan links)
CREATE POLICY "Allow select by share_token" ON solution_requests
  FOR SELECT TO anon
  USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON solution_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for plan_views
CREATE POLICY "Allow anonymous insert views" ON plan_views
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access views" ON plan_views
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solution_requests_updated_at ON solution_requests;
CREATE TRIGGER solution_requests_updated_at
  BEFORE UPDATE ON solution_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
