-- Persistent founder-only AI conversations and richer run linkage.
-- Additive and idempotent. Application code remains unavailable until this
-- migration is deliberately applied; no request path mutates schema.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_actor_recent
  ON public.ai_conversations (actor_email, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  client_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_client_replay
  ON public.ai_messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_order
  ON public.ai_messages (conversation_id, created_at, id);

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS tool_pack TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation
  ON public.agent_runs (conversation_id, started_at DESC)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_conversations FROM anon, authenticated;
REVOKE ALL ON public.ai_messages FROM anon, authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;

COMMENT ON TABLE public.ai_conversations IS
  'Founder-only AI command threads. Full transcript storage is intentionally separate from bounded agent run previews.';
COMMENT ON COLUMN public.ai_messages.metadata IS
  'Versioned, bounded UI metadata only. Provider payloads, secrets, and raw tool results do not belong here.';
