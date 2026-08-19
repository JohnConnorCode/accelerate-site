-- Campaign stops and send claims serialize on the canonical contact. A stop that
-- claims the lock first makes every pending membership terminal before a later
-- send claim can win; a claim rechecks contact/campaign eligibility under lock.

CREATE OR REPLACE FUNCTION public.stop_campaign_memberships(
  p_contact_id UUID,
  p_campaign_id UUID,
  p_reason TEXT
) RETURNS TABLE (member_id UUID, campaign_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  v_status := CASE
    WHEN p_reason = 'public_unsubscribe' THEN 'unsubscribed'
    WHEN p_reason IN ('resend_bounced', 'resend_suppressed') THEN 'bounced'
    ELSE 'stopped'
  END;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contact_id::text, 0));
  RETURN QUERY
  UPDATE public.campaign_members AS member
  SET status = v_status, stop_reason = p_reason, next_send_at = NULL, updated_at = now()
  WHERE member.contact_id = p_contact_id
    AND (p_campaign_id IS NULL OR member.campaign_id = p_campaign_id)
    AND member.status IN ('queued', 'active', 'sending')
  RETURNING member.id, member.campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_campaign_member_send(
  p_member_id UUID,
  p_claim_key TEXT
) RETURNS TABLE (member_id UUID, claimed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  SELECT contact_id INTO v_contact_id FROM public.campaign_members WHERE id = p_member_id;
  IF v_contact_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_contact_id::text, 0));
  RETURN QUERY
  UPDATE public.campaign_members AS member
  SET status = 'sending', send_claimed_at = now(), send_claim_key = p_claim_key, updated_at = now()
  FROM public.contacts AS contact, public.campaigns AS campaign
  WHERE member.id = p_member_id
    AND contact.id = member.contact_id
    AND campaign.id = member.campaign_id
    AND contact.communication_status = 'active'
    AND campaign.status = 'active'
    AND campaign.version = campaign.approved_version
    AND member.status IN ('queued','active')
    AND member.next_send_at IS NOT NULL
    AND member.next_send_at <= now()
  RETURNING member.id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.stop_campaign_memberships(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_campaign_memberships(UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) TO service_role;
