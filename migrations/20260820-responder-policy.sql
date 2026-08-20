-- Seed the autonomous inbound responder's two operator controls.
--
-- The responder emails a prospect with no human in the loop, so it fails closed:
-- absent settings mean off, and it stays off until the founder both enables it
-- and approves the exact policy version the code is running.
--
-- These rows exist so the controls appear in Admin > Settings at all. The
-- settings API renders whatever is in this table, so an unseeded key is a
-- control the founder cannot reach.
--
-- Both keys are deliberately lowercase. `getSetting` lets `process.env[key]`
-- win unconditionally, so a key that collides with an environment variable name
-- could never be flipped from the admin. Lowercase makes a collision both
-- unlikely and obvious.
--
-- `value` is NOT NULL, hence the strings rather than nulls.
--
-- Additive and idempotent: ON CONFLICT DO NOTHING so re-running never silently
-- re-enables a responder the founder has since switched off, or re-approves a
-- policy version they have since retired.

INSERT INTO public.admin_settings (key, value, is_secret, description)
VALUES (
  'auto_responder_enabled',
  'false',
  false,
  'Kill switch for the automatic first reply to new website inquiries. "true" or "false". Read at the moment of sending, so switching it off halts replies immediately. Turning it on is not enough on its own: auto_responder_approved_version must also match the policy version the code is running.'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_settings (key, value, is_secret, description)
VALUES (
  'auto_responder_approved_version',
  '',
  false,
  'The responder policy version you have reviewed and approved, e.g. inbound-responder.v1. The responder refuses to send unless this exactly matches its current version, so any material change to its envelope, guardrails, or wording suspends automatic replies until you approve the new version here.'
)
ON CONFLICT (key) DO NOTHING;
