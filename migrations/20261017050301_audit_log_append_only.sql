-- Protect the public.audit_log integrity boundary for client API roles.
--
-- Scope of the guarantee: anon, authenticated, and any role that inherits them
-- at any depth can no longer UPDATE, DELETE or TRUNCATE audit content. They keep
-- the canonical INSERT/read paths and the existing tenant and private-owner
-- policies, which are unchanged.
--
-- Enforcement is fail-closed: only a trusted writer may mutate the ledger. The
-- trusted set is service_role, a superuser, the table owner, and any role that
-- inherits service_role. Everything else is refused. The trusted check runs
-- before any recursive pg_has_role membership test because a superuser tests as
-- a member of every role.
--
-- Explicitly outside the guarantee: privileged server infrastructure
-- (service_role) and the table owner retain governed retention/recovery, and a
-- SECURITY DEFINER function owned by the table owner runs with owner rights.
-- This slice stops client-role tampering; it does not make the ledger immutable
-- against a privileged or misconfigured server-side writer.
--
-- Ownership and tenant immutability stay with command_ownership_guard: a client
-- UPDATE that changes either column is returned unchanged here so the existing
-- guard still raises its canonical refusal regardless of trigger firing order.
-- Canonical INSERT is untouched.
BEGIN;
CREATE OR REPLACE FUNCTION private.guard_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  is_trusted boolean;
BEGIN
  is_trusted := current_user = 'service_role'
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper)
    OR current_user = pg_catalog.pg_get_userbyid(
         (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID))
    OR pg_catalog.pg_has_role(current_user, 'service_role', 'MEMBER');
  IF is_trusted THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'audit_log is append-only; truncate refused for client API roles'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_log is append-only; delete refused for client API roles'
      USING ERRCODE = '42501';
  END IF;
  -- UPDATE. Ownership/tenant immutability remains owned by command_ownership_guard.
  IF NEW.platform_owner_user_id IS DISTINCT FROM OLD.platform_owner_user_id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only; update refused for client API roles'
    USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION private.guard_audit_log_append_only() FROM PUBLIC;

DROP TRIGGER IF EXISTS audit_log_append_only_guard ON public.audit_log;
CREATE TRIGGER audit_log_append_only_guard
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION private.guard_audit_log_append_only();

DROP TRIGGER IF EXISTS audit_log_append_only_truncate_guard ON public.audit_log;
CREATE TRIGGER audit_log_append_only_truncate_guard
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION private.guard_audit_log_append_only();

COMMENT ON FUNCTION private.guard_audit_log_append_only() IS
  'Fail-closed append-only guard for public.audit_log: only service_role, a superuser, the table owner or a role inheriting service_role may UPDATE/DELETE/TRUNCATE; anon/authenticated (at any inheritance depth) are refused.';
COMMIT;
