/** Installation-only transaction around the canonical audited membership function.
 * Lock order matches the lifecycle host: tenant, then membership. No new write path.
 */
export function bootstrapOwnerMembershipSql(tenantId, ownerId, ownerEmail) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (
    !uuid.test(tenantId) ||
    !uuid.test(ownerId) ||
    typeof ownerEmail !== "string" ||
    ownerEmail.length > 320
  )
    throw new Error("Invalid bootstrap identity");
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  // Values stay outside the dollar-quoted block, including unusual valid email characters.
  return `BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
SELECT set_config('accelerate_setup.tenant_id',${literal(tenantId)},true);
SELECT set_config('accelerate_setup.owner_id',${literal(ownerId)},true);
SELECT set_config('accelerate_setup.owner_email',${literal(ownerEmail.toLowerCase())},true);
DO $bootstrap_owner$
DECLARE
  tenant_row public.tenants%ROWTYPE;
  member_row public.tenant_memberships%ROWTYPE;
  target_tenant uuid := current_setting('accelerate_setup.tenant_id')::uuid;
  target_owner uuid := current_setting('accelerate_setup.owner_id')::uuid;
  owner_email text := current_setting('accelerate_setup.owner_email');
BEGIN
  SELECT * INTO tenant_row FROM public.tenants WHERE id=target_tenant FOR UPDATE;
  IF NOT FOUND OR tenant_row.id <> public.accelerate_default_tenant_id()
    OR tenant_row.status <> 'active'
    OR lower(coalesce(tenant_row.config #>> '{founder,email}','')) <> owner_email
  THEN RAISE EXCEPTION 'Bootstrap workspace identity or status changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target_owner AND lower(email)=owner_email)
  THEN RAISE EXCEPTION 'Bootstrap owner identity changed'; END IF;
  SELECT * INTO member_row FROM public.tenant_memberships
    WHERE tenant_id=target_tenant AND user_id=target_owner FOR UPDATE;
  IF FOUND THEN
    IF member_row.status <> 'active' OR member_row.role <> 'admin'
      OR lower(member_row.invited_email) <> owner_email
    THEN RAISE EXCEPTION 'Existing bootstrap membership requires explicit review'; END IF;
  ELSE
    PERFORM public.platform_upsert_tenant_membership(target_tenant,target_owner,owner_email,'active',target_owner,owner_email);
  END IF;
END $bootstrap_owner$;
COMMIT;\n`;
}
