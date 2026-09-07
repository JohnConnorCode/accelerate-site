BEGIN;
-- PostgREST specifies conflict columns without an index predicate. The existing
-- partial external-ID indexes cannot arbitrate those upserts. PostgreSQL's
-- ordinary NULL-distinct uniqueness retains the same business identity while
-- making the tenant-composite targets inferable for sends and source syncs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_tenant_upsert
  ON public.conversations (tenant_id, channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_tenant_external_upsert
  ON public.messages (tenant_id, conversation_id, external_id);
COMMIT;
