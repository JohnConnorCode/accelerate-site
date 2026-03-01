-- ========================================
-- PROMPT 3: Admin Power-Up Migration
-- ========================================

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_secret BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: only authenticated users can read/write
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Seed with known configuration keys
INSERT INTO admin_settings (key, value, is_secret, description) VALUES
  ('ANTHROPIC_API_KEY', '', true, 'Anthropic Claude API key for AI features'),
  ('RESEND_API_KEY', '', true, 'Resend API key for email delivery'),
  ('RESEND_FROM_EMAIL', 'Accelerate <hello@acceleratewith.us>', false, 'Sender email address for outgoing emails'),
  ('ADMIN_EMAIL', 'hello@acceleratewith.us', false, 'Admin notification email address'),
  ('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', '', false, 'Plausible analytics domain'),
  ('CRON_SECRET', '', true, 'Secret token for cron job authentication'),
  ('SITE_URL', 'https://acceleratewith.us', false, 'Public site URL'),
  ('BUSINESS_NAME', 'Accelerate', false, 'Business display name')
ON CONFLICT (key) DO NOTHING;
