-- Correct the initial claim implementation's lock ordering. Never hold a row
-- lock while waiting for the contact advisory lock: a stop holds that advisory
-- lock before updating memberships, so the inverse ordering could deadlock.

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

REVOKE ALL ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) TO service_role;
