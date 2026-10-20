BEGIN;

-- Embedded Stripe sessions have no hosted checkout URL. Keep their session
-- reference, expiry, tenant authorization, and immutable receipt in the same owner.
CREATE OR REPLACE FUNCTION public.record_event_checkout(
 p_order_id uuid,p_session_id text,p_checkout_url text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; o public.ticket_orders;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_session_id IS NULL OR p_session_id !~ '^cs_[A-Za-z0-9_]+$'
  OR (p_checkout_url IS NOT NULL AND p_checkout_url !~ '^https://checkout\.stripe\.com/')
  OR p_expires_at IS NULL
  THEN RAISE EXCEPTION 'Invalid Stripe checkout receipt'; END IF;
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.stripe_session_id IS NOT NULL AND
  (o.stripe_session_id<>p_session_id OR o.stripe_checkout_url IS DISTINCT FROM p_checkout_url)
  THEN RAISE EXCEPTION 'Order already has a different checkout'; END IF;
 UPDATE public.ticket_orders SET stripe_session_id=p_session_id,stripe_checkout_url=p_checkout_url,
  expires_at=p_expires_at,state=CASE WHEN state='reserved' THEN 'checkout' ELSE state END
  WHERE tenant_id=t AND id=p_order_id RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

COMMIT;
