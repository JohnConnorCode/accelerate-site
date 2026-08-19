-- Claim an individual campaign send before rendering local receipts or calling
-- the provider. A second worker sees no claimable member and safely skips it.

ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS send_claimed_at TIMESTAMPTZ;
ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS send_claim_key TEXT;
ALTER TABLE public.campaign_members DROP CONSTRAINT IF EXISTS campaign_members_status_check;
ALTER TABLE public.campaign_members ADD CONSTRAINT campaign_members_status_check CHECK (
  status IN ('queued','active','sending','replied','booked','converted','bounced','unsubscribed','stopped','completed')
);

CREATE OR REPLACE FUNCTION public.claim_campaign_member_send(
  p_member_id UUID,
  p_claim_key TEXT
) RETURNS TABLE (member_id UUID, claimed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.campaign_members
  SET status = 'sending', send_claimed_at = now(), send_claim_key = p_claim_key, updated_at = now()
  WHERE id = p_member_id
    AND status IN ('queued','active')
    AND next_send_at IS NOT NULL
    AND next_send_at <= now()
  RETURNING id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_member_send(UUID, TEXT) TO service_role;
