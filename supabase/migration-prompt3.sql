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

DROP POLICY IF EXISTS "Authenticated users can read settings" ON admin_settings;
CREATE POLICY "Authenticated users can read settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert settings" ON admin_settings;
CREATE POLICY "Authenticated users can insert settings"
  ON admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update settings" ON admin_settings;
CREATE POLICY "Authenticated users can update settings"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Seed with known configuration keys
-- Seed values below are BOOTSTRAP_* token placeholders (see
-- scripts/lib/bootstrap-identity.mjs), resolved from environment variables
-- when applied through npm run db:migrate / db:migrate:all. Unset, they
-- default to the reference Accelerate deployment's own values.
INSERT INTO admin_settings (key, value, is_secret, description) VALUES
  ('RESEND_API_KEY', '', true, 'Resend API key for email delivery'),
  ('RESEND_FROM_EMAIL', '__BOOTSTRAP_BRAND_NAME__ <__BOOTSTRAP_SETTINGS_FROM_EMAIL__>', false, 'Sender email address for outgoing emails'),
  ('ADMIN_EMAIL', '__BOOTSTRAP_SETTINGS_ADMIN_EMAIL__', false, 'Admin notification email address'),
  ('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', '', false, 'Plausible analytics domain'),
  ('CRON_SECRET', '', true, 'Secret token for cron job authentication'),
  ('SITE_URL', '__BOOTSTRAP_BRAND_SITE_URL_BARE__', false, 'Public site URL'),
  ('BUSINESS_NAME', '__BOOTSTRAP_BRAND_NAME__', false, 'Business display name')
ON CONFLICT DO NOTHING;
