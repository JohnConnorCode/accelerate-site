-- =============================================================================
-- Atomic platform tenant lifecycle operations.
--
-- Auth invitations remain an external Supabase Auth effect. The membership
-- binding that follows an invitation is replay-safe and atomic with its audit
-- receipt. An invitation that succeeds while this RPC fails grants no tenant
-- access and can be reconciled safely on retry.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.platform_create_tenant(
  p_slug TEXT,
  p_name TEXT,
  p_actor_user_id UUID,
  p_actor_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  created_tenant public.tenants%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_email IS NULL OR btrim(p_actor_email) = '' THEN
    RAISE EXCEPTION 'Platform actor identity is required';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid tenant slug';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid tenant name';
  END IF;

  INSERT INTO public.tenants (slug, name, status, config, created_by)
  VALUES (p_slug, btrim(p_name), 'provisioning', '{}'::jsonb, p_actor_user_id)
  RETURNING * INTO created_tenant;

  INSERT INTO public.tenant_memberships (
    tenant_id, user_id, invited_email, role, status, invited_by, activated_at
  ) VALUES (
    created_tenant.id,
    p_actor_user_id,
    lower(COALESCE(NULLIF(btrim(p_actor_email), ''), 'platform-admin')),
    'admin',
    'active',
    p_actor_user_id,
    now()
  );

  INSERT INTO public.platform_audit_log (
    actor_user_id, actor_email, action, tenant_id, target_type, target_id,
    metadata
  ) VALUES (
    p_actor_user_id, lower(p_actor_email), 'tenant.created',
    created_tenant.id, 'tenant', created_tenant.id::text,
    jsonb_build_object('slug', created_tenant.slug)
  );

  RETURN to_jsonb(created_tenant);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_upsert_tenant_membership(
  p_tenant_id UUID,
  p_user_id UUID,
  p_invited_email TEXT,
  p_membership_status TEXT,
  p_actor_user_id UUID,
  p_actor_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_row public.tenants%ROWTYPE;
  membership_row public.tenant_memberships%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_email IS NULL OR btrim(p_actor_email) = '' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Platform actor identity and membership user are required';
  END IF;
  IF p_membership_status NOT IN ('invited', 'active') THEN
    RAISE EXCEPTION 'Invalid membership status';
  END IF;
  IF p_invited_email IS NULL OR btrim(p_invited_email) = '' THEN
    RAISE EXCEPTION 'Invited email is required';
  END IF;

  SELECT * INTO tenant_row
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  IF tenant_row.status NOT IN ('provisioning', 'active') THEN
    RAISE EXCEPTION 'Invitations are disabled while tenant is %', tenant_row.status;
  END IF;

  SELECT * INTO membership_row
  FROM public.tenant_memberships
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  FOR UPDATE;
  IF FOUND
    AND membership_row.status = p_membership_status
    AND lower(membership_row.invited_email) = lower(btrim(p_invited_email))
  THEN
    RETURN to_jsonb(membership_row);
  END IF;

  INSERT INTO public.tenant_memberships (
    tenant_id, user_id, invited_email, role, status, invited_by,
    activated_at, revoked_at, updated_at
  ) VALUES (
    p_tenant_id, p_user_id, lower(btrim(p_invited_email)), 'admin',
    p_membership_status, p_actor_user_id,
    CASE WHEN p_membership_status = 'active' THEN now() ELSE NULL END,
    NULL, now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    invited_email = EXCLUDED.invited_email,
    role = 'admin',
    status = EXCLUDED.status,
    invited_by = EXCLUDED.invited_by,
    activated_at = CASE
      WHEN EXCLUDED.status = 'active'
        THEN COALESCE(public.tenant_memberships.activated_at, now())
      ELSE NULL
    END,
    revoked_at = NULL,
    updated_at = now()
  RETURNING * INTO membership_row;

  INSERT INTO public.platform_audit_log (
    actor_user_id, actor_email, action, tenant_id, target_type, target_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    lower(p_actor_email),
    CASE WHEN p_membership_status = 'active'
      THEN 'tenant.membership_granted'
      ELSE 'tenant.membership_invited'
    END,
    p_tenant_id,
    'tenant_membership',
    membership_row.id::text,
    jsonb_build_object('invited_email', lower(btrim(p_invited_email)))
  );

  RETURN to_jsonb(membership_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_status(
  p_tenant_id UUID,
  p_status TEXT,
  p_actor_user_id UUID,
  p_actor_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_row public.tenants%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_email IS NULL OR btrim(p_actor_email) = '' THEN
    RAISE EXCEPTION 'Platform actor identity is required';
  END IF;
  IF p_status NOT IN ('active', 'suspended', 'archived') THEN
    RAISE EXCEPTION 'Invalid tenant status';
  END IF;

  SELECT * INTO tenant_row
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  IF tenant_row.id = public.accelerate_default_tenant_id() AND p_status <> 'active' THEN
    RAISE EXCEPTION 'The bootstrap tenant cannot be suspended or archived';
  END IF;
  IF tenant_row.status = 'archived' AND p_status <> 'archived' THEN
    RAISE EXCEPTION 'Archived tenants cannot be reactivated';
  END IF;
  IF tenant_row.status = p_status THEN RETURN to_jsonb(tenant_row); END IF;

  UPDATE public.tenants
  SET status = p_status, updated_at = now()
  WHERE id = p_tenant_id
  RETURNING * INTO tenant_row;

  INSERT INTO public.platform_audit_log (
    actor_user_id, actor_email, action, tenant_id, target_type, target_id
  ) VALUES (
    p_actor_user_id, lower(p_actor_email), 'tenant.' || p_status,
    tenant_row.id, 'tenant', tenant_row.id::text
  );

  RETURN to_jsonb(tenant_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_revoke_tenant_membership(
  p_membership_id UUID,
  p_actor_user_id UUID,
  p_actor_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  membership_row public.tenant_memberships%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_email IS NULL OR btrim(p_actor_email) = '' THEN
    RAISE EXCEPTION 'Platform actor identity is required';
  END IF;

  SELECT * INTO membership_row
  FROM public.tenant_memberships
  WHERE id = p_membership_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
  IF membership_row.user_id = p_actor_user_id THEN
    RAISE EXCEPTION 'The platform owner membership cannot be revoked';
  END IF;
  IF membership_row.status = 'revoked' THEN RETURN to_jsonb(membership_row); END IF;

  UPDATE public.tenant_memberships
  SET status = 'revoked', revoked_at = now(), updated_at = now()
  WHERE id = p_membership_id
  RETURNING * INTO membership_row;

  INSERT INTO public.platform_audit_log (
    actor_user_id, actor_email, action, tenant_id, target_type, target_id,
    metadata
  ) VALUES (
    p_actor_user_id, lower(p_actor_email), 'tenant.membership_revoked',
    membership_row.tenant_id, 'tenant_membership', membership_row.id::text,
    jsonb_build_object('invited_email', membership_row.invited_email)
  );

  RETURN to_jsonb(membership_row);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_create_tenant(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_upsert_tenant_membership(UUID, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_set_tenant_status(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_revoke_tenant_membership(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_tenant(TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_upsert_tenant_membership(UUID, UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_revoke_tenant_membership(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.platform_create_tenant(TEXT, TEXT, UUID, TEXT) IS 'Atomically creates a provisioning tenant, founder membership, and platform audit receipt.';
COMMENT ON FUNCTION public.platform_upsert_tenant_membership(UUID, UUID, TEXT, TEXT, UUID, TEXT) IS 'Replay-safe tenant admin binding with active-tenant guard and audit receipt.';
COMMENT ON FUNCTION public.platform_set_tenant_status(UUID, TEXT, UUID, TEXT) IS 'Atomic, idempotent tenant lifecycle transition with bootstrap and archive guards.';
COMMENT ON FUNCTION public.platform_revoke_tenant_membership(UUID, UUID, TEXT) IS 'Atomic, idempotent tenant membership revocation with founder self-protection and audit receipt.';
