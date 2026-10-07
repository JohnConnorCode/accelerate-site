-- Additive privacy on existing command ledgers. Shared rows remain NULL.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
DO $$
DECLARE ledger text;
BEGIN
  FOREACH ledger IN ARRAY ARRAY['action_queue','audit_log','agent_runs','agent_run_events','ai_conversations','ai_messages'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS platform_owner_user_id uuid REFERENCES auth.users(id)', ledger);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', ledger);
    EXECUTE format('DROP POLICY IF EXISTS "Private command owner" ON public.%I', ledger);
    EXECUTE format('CREATE POLICY "Private command owner" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (platform_owner_user_id IS NULL OR platform_owner_user_id = (SELECT auth.uid())) WITH CHECK (platform_owner_user_id IS NULL OR platform_owner_user_id = (SELECT auth.uid()))', ledger);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, platform_owner_user_id) WHERE platform_owner_user_id IS NOT NULL', 'idx_' || ledger || '_private_owner', ledger);
  END LOOP;
END $$;

-- Invoker lookups obey the existing tenant and new owner policies. A hidden
-- parent must refuse, never turn a private child into a shared row.
CREATE OR REPLACE FUNCTION private.guard_command_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE parent_owner uuid; parent_tenant uuid; linked_owner uuid; linked_tenant uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.platform_owner_user_id IS DISTINCT FROM OLD.platform_owner_user_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
    RAISE EXCEPTION 'Command ownership and workspace are immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'agent_run_events' THEN
    SELECT r.platform_owner_user_id, r.tenant_id INTO parent_owner, parent_tenant FROM public.agent_runs r WHERE r.id = NEW.run_id;
    IF NOT FOUND OR parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Command parent is unavailable in this workspace' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'ai_messages' THEN
    SELECT c.platform_owner_user_id, c.tenant_id INTO parent_owner, parent_tenant FROM public.ai_conversations c WHERE c.id = NEW.conversation_id;
    IF NOT FOUND OR parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Command parent is unavailable in this workspace' USING ERRCODE = '42501';
    END IF;
    IF NEW.run_id IS NOT NULL THEN
      SELECT r.platform_owner_user_id, r.tenant_id INTO linked_owner, linked_tenant FROM public.agent_runs r WHERE r.id = NEW.run_id;
      IF NOT FOUND OR linked_tenant IS DISTINCT FROM NEW.tenant_id OR linked_owner IS DISTINCT FROM parent_owner THEN
        RAISE EXCEPTION 'Command message and run must have the same owner and workspace' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'agent_runs' THEN
    IF NEW.conversation_id IS NULL THEN RETURN NEW; END IF;
    SELECT c.platform_owner_user_id, c.tenant_id INTO parent_owner, parent_tenant FROM public.ai_conversations c WHERE c.id = NEW.conversation_id;
    IF NOT FOUND OR parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Command parent is unavailable in this workspace' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'audit_log' THEN
    IF NEW.entity_type IS DISTINCT FROM 'action_queue' OR NEW.entity_id IS NULL OR NEW.entity_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RETURN NEW; END IF;
    SELECT q.platform_owner_user_id, q.tenant_id INTO parent_owner, parent_tenant FROM public.action_queue q WHERE q.id = NEW.entity_id::uuid;
    -- Older triage audits use a WorkItem ID rather than an action ID.
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Command audit target is unavailable in this workspace' USING ERRCODE = '42501';
    END IF;
    IF parent_owner IS NULL THEN RETURN NEW; END IF;
  ELSE
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.platform_owner_user_id IS NULL THEN
    NEW.platform_owner_user_id := parent_owner;
  END IF;
  IF NEW.platform_owner_user_id IS DISTINCT FROM parent_owner THEN
    RAISE EXCEPTION 'Command child must retain its parent owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_command_ownership() FROM PUBLIC;
DO $$
DECLARE ledger text;
BEGIN
  FOREACH ledger IN ARRAY ARRAY['action_queue','audit_log','agent_runs','agent_run_events','ai_conversations','ai_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS command_ownership_guard ON public.%I', ledger);
    EXECUTE format('CREATE TRIGGER command_ownership_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_command_ownership()', ledger);
  END LOOP;
END $$;

-- A service-role worker cannot claim private approvals. The shared executor
-- also checks fresh Auth and ADMIN_EMAIL before an owner approves any effect.
CREATE OR REPLACE FUNCTION private.guard_private_command_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.platform_owner_user_id IS NOT NULL AND NEW.status = 'executing' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.platform_owner_user_id IS DISTINCT FROM auth.uid() OR NEW.approved_by IS NULL OR NEW.approved_at IS NULL OR
       (NEW.expires_at IS NOT NULL AND NEW.expires_at <= now()) OR
       NOT EXISTS (SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id = m.tenant_id
         WHERE m.tenant_id = NEW.tenant_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'admin' AND t.status = 'active') THEN
      RAISE EXCEPTION 'Private commands require current owner approval' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_private_command_claim() FROM PUBLIC;
DROP TRIGGER IF EXISTS private_command_claim_guard ON public.action_queue;
CREATE TRIGGER private_command_claim_guard BEFORE UPDATE ON public.action_queue FOR EACH ROW EXECUTE FUNCTION private.guard_private_command_claim();
COMMIT;
