-- Resend delivery telemetry belongs in the canonical message ledger. Provider
-- event ids are recorded first, which makes webhook retries and dashboard
-- replays safe before any contact or campaign mutation is attempted.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON public.messages(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_provider_received ON public.webhook_receipts(provider, received_at DESC);
