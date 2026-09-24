-- Architect sources are read and written by the founder's tenant-bound client
-- (authenticated + RLS), like ai_conversations and ai_messages. The table was
-- created service-role only, so every copilot turn failed with
-- "permission denied for table ai_conversation_sources".
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_sources TO authenticated;

DROP POLICY IF EXISTS "Tenant member access" ON public.ai_conversation_sources;
CREATE POLICY "Tenant member access" ON public.ai_conversation_sources
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
