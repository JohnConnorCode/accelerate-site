-- Persist Architect business-model extraction on the existing conversation row.
-- This is a reading of session evidence, not a schema or configuration write.
BEGIN;
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS business_model jsonb;
COMMENT ON COLUMN public.ai_conversations.business_model IS
  'Structured Architect understanding: facts, inferences, conflicts and ranked questions. Never applies schema.';
COMMIT;
