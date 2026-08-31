-- One platform invitation request may be retried at the HTTP/provider boundary,
-- but it must produce at most one immutable audit receipt per terminal outcome.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_audit_tenant_invitation_request
  ON public.platform_audit_log (
    tenant_id,
    action,
    (metadata ->> 'request_id')
  )
  WHERE action IN ('tenant.invitation.sent', 'tenant.invitation.failed')
    AND metadata ->> 'request_id' IS NOT NULL;
