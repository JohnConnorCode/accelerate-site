-- Money-first outreach safety: durable send idempotency and public suppression.
-- Safe to run repeatedly.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unsubscribe_token ON contacts(unsubscribe_token);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_key ON messages(idempotency_key) WHERE idempotency_key IS NOT NULL;
