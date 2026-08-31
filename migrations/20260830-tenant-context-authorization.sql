-- Tenant-aware RPC cutover. Every security-definer operational function binds
-- its work to the explicit PostgREST tenant header and rechecks membership for
-- authenticated callers. Service-role callers still require that header.

CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()
RETURNS UUID
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested UUID := private.request_tenant_id();
BEGIN
  IF requested IS NULL THEN
    RAISE EXCEPTION 'explicit tenant context is required' USING ERRCODE = '42501';
  END IF;
  IF auth.role() = 'service_role' OR private.has_active_tenant_membership(requested) THEN
    RETURN requested;
  END IF;
  RAISE EXCEPTION 'tenant access forbidden' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.authorized_request_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.authorized_request_tenant_id() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.claim_revenue_job_run(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_revenue_job_run(TEXT, TEXT, INTERVAL);
CREATE FUNCTION public.claim_revenue_job_run(
  p_job_key TEXT,
  p_claim_key TEXT DEFAULT NULL,
  p_stale_after INTERVAL DEFAULT INTERVAL '30 minutes'
) RETURNS TABLE (run_id UUID, claimed BOOLEAN, existing_status TEXT, recovered_stale BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_tenant UUID := private.authorized_request_tenant_id();
  v_existing public.job_runs%ROWTYPE;
  v_recovered UUID;
BEGIN
  IF p_job_key IS NULL OR btrim(p_job_key) = '' THEN RAISE EXCEPTION 'job key is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_tenant::text || ':revenue-os-job:' || p_job_key, 0));
  UPDATE public.job_runs SET status = 'failed', finished_at = now(), error = COALESCE(error, 'Run abandoned before reporting a terminal state and was recovered by a later claim')
  WHERE tenant_id = requested_tenant AND job_key = p_job_key AND status = 'running' AND claimed_at < now() - p_stale_after
  RETURNING id INTO v_recovered;
  SELECT * INTO v_existing FROM public.job_runs
  WHERE tenant_id = requested_tenant AND job_key = p_job_key AND status = 'running'
  ORDER BY claimed_at DESC LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT v_existing.id, false, v_existing.status, false; RETURN; END IF;
  IF p_claim_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.job_runs
    WHERE tenant_id = requested_tenant AND claim_key = p_claim_key ORDER BY claimed_at DESC LIMIT 1;
    IF FOUND THEN RETURN QUERY SELECT v_existing.id, false, v_existing.status, false; RETURN; END IF;
  END IF;
  INSERT INTO public.job_runs (tenant_id, job_key, claim_key, status, idempotency_key, recovered_from)
  VALUES (requested_tenant, p_job_key, p_claim_key, 'running', p_claim_key, v_recovered)
  RETURNING * INTO v_existing;
  RETURN QUERY SELECT v_existing.id, true, v_existing.status, (v_recovered IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_revenue_job_run(TEXT, TEXT, INTERVAL) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_campaign_member_send(p_member_id UUID, p_claim_key TEXT)
RETURNS TABLE (member_id UUID, claimed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_tenant UUID := private.authorized_request_tenant_id();
  v_contact_id UUID;
BEGIN
  SELECT contact_id INTO v_contact_id FROM public.campaign_members WHERE tenant_id = requested_tenant AND id = p_member_id;
  IF v_contact_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_tenant::text || ':' || v_contact_id::text, 0));
  RETURN QUERY UPDATE public.campaign_members AS member
  SET status = 'sending', send_claimed_at = now(), send_claim_key = p_claim_key, updated_at = now()
  FROM public.contacts AS contact, public.campaigns AS campaign
  WHERE member.tenant_id = requested_tenant AND member.id = p_member_id
    AND contact.tenant_id = requested_tenant AND contact.id = member.contact_id
    AND campaign.tenant_id = requested_tenant AND campaign.id = member.campaign_id
    AND contact.communication_status = 'active' AND campaign.status = 'active'
    AND campaign.version = campaign.approved_version AND member.status IN ('queued','active')
    AND member.next_send_at IS NOT NULL AND member.next_send_at <= now()
  RETURNING member.id, true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.stop_campaign_memberships(p_contact_id UUID, p_campaign_id UUID, p_reason TEXT)
RETURNS TABLE (member_id UUID, campaign_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_tenant UUID := private.authorized_request_tenant_id();
  v_status TEXT;
BEGIN
  v_status := CASE WHEN p_reason = 'public_unsubscribe' THEN 'unsubscribed' WHEN p_reason IN ('resend_bounced', 'resend_suppressed') THEN 'bounced' ELSE 'stopped' END;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_tenant::text || ':' || p_contact_id::text, 0));
  RETURN QUERY UPDATE public.campaign_members AS member
  SET status = v_status, stop_reason = p_reason, next_send_at = NULL, updated_at = now()
  WHERE member.tenant_id = requested_tenant AND member.contact_id = p_contact_id
    AND (p_campaign_id IS NULL OR member.campaign_id = p_campaign_id)
    AND member.status IN ('queued', 'active', 'sending')
  RETURNING member.id, member.campaign_id;
END;
$$;
REVOKE ALL ON FUNCTION public.stop_campaign_memberships(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_campaign_memberships(UUID, UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_contact_import_batch(p_batch_id UUID, p_actor_email TEXT)
RETURNS SETOF public.contact_import_batches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE requested_tenant UUID := private.authorized_request_tenant_id();
BEGIN
  RETURN QUERY UPDATE public.contact_import_batches SET status = 'executing', execution_claimed_at = now(), error = NULL, updated_at = now()
  WHERE tenant_id = requested_tenant AND id = p_batch_id AND status IN ('approved','partial','failed')
    AND approval_digest IS NOT NULL AND approval_digest = review_digest AND approved_by IS NOT NULL
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_contact_import_batch(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_contact_import_batch(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publish_email_template(p_template_key TEXT, p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_tenant UUID := private.authorized_request_tenant_id();
  v_draft UUID;
BEGIN
  SELECT id INTO v_draft FROM public.email_template_versions
  WHERE tenant_id = requested_tenant AND template_key = p_template_key AND state = 'draft'
  ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_draft IS NULL THEN RAISE EXCEPTION 'No draft is available to publish'; END IF;
  UPDATE public.email_template_versions SET state = 'archived', updated_at = now()
  WHERE tenant_id = requested_tenant AND template_key = p_template_key AND state = 'published';
  UPDATE public.email_template_versions SET state = 'published', published_at = now(), updated_at = now(), created_by = COALESCE(p_actor, created_by)
  WHERE tenant_id = requested_tenant AND id = v_draft;
  UPDATE public.email_templates SET current_published_version = v_draft, updated_at = now()
  WHERE tenant_id = requested_tenant AND template_key = p_template_key;
  RETURN v_draft;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_email_template(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_email_template(TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION private.authorized_request_tenant_id() IS 'Validates explicit request tenant context for authenticated and service-role RPC callers.';
