-- A resolved service-role tenant context identifies the workspace but is not a
-- lease on its lifecycle state. Recheck active status inside every operational
-- security-definer RPC so a stale context cannot claim new work after the
-- founder suspends or archives the tenant.

CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()
RETURNS UUID
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested UUID := private.request_tenant_id();
  tenant_status TEXT;
BEGIN
  IF requested IS NULL THEN
    RAISE EXCEPTION 'explicit tenant context is required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO tenant_status
  FROM public.tenants
  WHERE id = requested;
  IF tenant_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'tenant execution is unavailable' USING ERRCODE = '42501';
  END IF;

  IF auth.role() = 'service_role' OR private.has_active_tenant_membership(requested) THEN
    RETURN requested;
  END IF;
  RAISE EXCEPTION 'tenant access forbidden' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.authorized_request_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.authorized_request_tenant_id() TO authenticated, service_role;

COMMENT ON FUNCTION private.authorized_request_tenant_id() IS 'Validates explicit tenant context, active tenant lifecycle state, and authenticated membership before operational RPC execution.';
