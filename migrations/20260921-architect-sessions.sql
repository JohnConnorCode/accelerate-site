-- Architect sessions reuse ai_conversations. Additive evidence columns and
-- source rows; no second chat store. Source excerpts are inspectable evidence
-- and are never treated as executable instruction.
BEGIN;

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'command';
ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_purpose_check;
ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_purpose_check CHECK (purpose IN ('command', 'architect'));
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS connected_context jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS blueprint_draft_id uuid;
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_actor_purpose
  ON public.ai_conversations (actor_email, purpose, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_conversation_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  client_source_id text,
  kind text NOT NULL CHECK (kind IN ('upload', 'connected')),
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 180),
  content_type text NOT NULL CHECK (char_length(content_type) BETWEEN 1 AND 120),
  byte_size integer NOT NULL CHECK (byte_size >= 0 AND byte_size <= 10485760),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  excerpt text NOT NULL DEFAULT '' CHECK (octet_length(excerpt) <= 32768),
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversation_sources_replay
  ON public.ai_conversation_sources (tenant_id, conversation_id, client_source_id)
  WHERE client_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conversation_sources_conversation
  ON public.ai_conversation_sources (conversation_id, created_at, id);

ALTER TABLE public.ai_conversation_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_conversation_sources FROM anon, authenticated;
GRANT ALL ON public.ai_conversation_sources TO service_role;

COMMENT ON TABLE public.ai_conversation_sources IS
  'Inspectable Architect evidence attached to an existing AI conversation. Excerpts are never executable.';
COMMENT ON COLUMN public.ai_conversations.purpose IS
  'command is the existing AI workspace; architect is the Workspace Architect control plane on the same table.';
COMMENT ON COLUMN public.ai_conversations.connected_context IS
  'Explicit permission-bound source scopes. Entire-account values are refused by the service.';

COMMIT;
