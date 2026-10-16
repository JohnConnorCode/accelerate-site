BEGIN;
CREATE TABLE IF NOT EXISTS public.ticket_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=100),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 headline text NOT NULL CHECK (length(btrim(headline)) BETWEEN 1 AND 180),
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 3000),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 80),
 venue_name text NOT NULL CHECK (length(btrim(venue_name)) BETWEEN 1 AND 160),
 venue_address text NOT NULL CHECK (length(btrim(venue_address)) BETWEEN 1 AND 300),
 price_cents integer NOT NULL CHECK (price_cents BETWEEN 100 AND 10000000),
 capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
 refund_cutoff timestamptz NOT NULL,
 refund_policy text NOT NULL CHECK (length(btrim(refund_policy)) BETWEEN 1 AND 1500),
 support_description text NOT NULL CHECK (length(btrim(support_description)) BETWEEN 1 AND 1000),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed')),
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,slug),
 CHECK (ends_at>starts_at AND refund_cutoff<=starts_at)
);
CREATE TABLE IF NOT EXISTS public.ticket_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 event_id uuid NOT NULL, request_id uuid NOT NULL,
 request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 40),
 unit_price_cents integer NOT NULL CHECK (unit_price_cents>0),
 total_cents integer NOT NULL CHECK (total_cents=quantity*unit_price_cents),
 refund_cents integer NOT NULL DEFAULT 0 CHECK (refund_cents BETWEEN 0 AND total_cents),
 buyer_name text NOT NULL CHECK (length(btrim(buyer_name)) BETWEEN 1 AND 160),
 buyer_email text NOT NULL CHECK (length(buyer_email) BETWEEN 3 AND 254),
 company text NOT NULL DEFAULT '' CHECK (length(company)<=160),
 business_need text NOT NULL DEFAULT '' CHECK (length(business_need)<=1500),
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','checkout','paid','expired','refunded')),
 event_snapshot jsonb NOT NULL, attribution jsonb NOT NULL DEFAULT '{}',
 stripe_account_id text NOT NULL CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 livemode boolean NOT NULL, stripe_session_id text, stripe_checkout_url text,
 payment_intent_id text, expires_at timestamptz NOT NULL,
 paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','attention')),
 email_error text CHECK (length(email_error)<=500),
 FOREIGN KEY(tenant_id,event_id) REFERENCES public.ticket_events(tenant_id,id),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_id), UNIQUE(tenant_id,stripe_session_id),
 UNIQUE(tenant_id,payment_intent_id)
);
CREATE INDEX IF NOT EXISTS ticket_orders_inventory ON public.ticket_orders(tenant_id,event_id,state);
CREATE TABLE IF NOT EXISTS public.ticket_order_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 order_id uuid NOT NULL, external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 300),
 observation jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES public.ticket_orders(tenant_id,id),
 UNIQUE(tenant_id,external_id)
);
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_order_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant member ticket reads" ON public.ticket_events;
CREATE POLICY "Tenant member ticket reads" ON public.ticket_events FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member ticket reads" ON public.ticket_orders;
CREATE POLICY "Tenant member ticket reads" ON public.ticket_orders FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member ticket reads" ON public.ticket_order_receipts;
CREATE POLICY "Tenant member ticket reads" ON public.ticket_order_receipts FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
REVOKE ALL ON public.ticket_events,public.ticket_orders,public.ticket_order_receipts FROM anon,authenticated;
GRANT SELECT ON public.ticket_events,public.ticket_orders,public.ticket_order_receipts TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ticket_events,public.ticket_orders TO service_role;
REVOKE ALL ON public.ticket_order_receipts FROM service_role;
GRANT SELECT,INSERT ON public.ticket_order_receipts TO service_role;

CREATE OR REPLACE VIEW public.ticket_event_availability WITH(security_invoker=true) AS
 SELECT e.*,coalesce(o.paid,0)::integer AS paid_tickets,
 coalesce(o.reserved,0)::integer AS reserved_tickets,
 greatest(0,e.capacity-coalesce(o.paid,0)-coalesce(o.reserved,0))::integer AS available_tickets,
 coalesce(o.gross,0)::bigint AS gross_cents,coalesce(o.refunds,0)::bigint AS refunded_cents
 FROM public.ticket_events e LEFT JOIN LATERAL (
  SELECT sum(quantity) FILTER(WHERE state='paid') AS paid,
   sum(quantity) FILTER(WHERE state IN ('reserved','checkout')) AS reserved,
   sum(total_cents) FILTER(WHERE paid_at IS NOT NULL) AS gross,sum(refund_cents) AS refunds
  FROM public.ticket_orders WHERE tenant_id=e.tenant_id AND event_id=e.id AND livemode
 ) o ON true;
REVOKE ALL ON public.ticket_event_availability FROM anon,authenticated;
GRANT SELECT ON public.ticket_event_availability TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.save_ticket_event(
 p_event_id uuid,p_revision integer,p_definition jsonb,p_request_id uuid,p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; previous public.ticket_events; saved public.ticket_events;
 draft public.ticket_events; used integer; receipt jsonb;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=t AND config->'modules'->>'event-ticketing'='true') THEN RAISE EXCEPTION 'Event ticketing is disabled'; END IF;
 IF p_event_id IS NULL OR p_request_id IS NULL OR p_revision IS NULL OR p_revision<0
  OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320
  OR p_definition IS NULL OR jsonb_typeof(p_definition)<>'object' OR octet_length(p_definition::text)>16000
  THEN RAISE EXCEPTION 'Invalid event command'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text||p_request_id::text,0));
 SELECT metadata INTO receipt FROM public.audit_log WHERE tenant_id=t AND action='ticket_event.saved'
  AND metadata->>'event_request_id'=p_request_id::text LIMIT 1;
 IF FOUND THEN
  IF receipt->'definition' IS DISTINCT FROM p_definition OR receipt->>'event_id'<>p_event_id::text
   THEN RAISE EXCEPTION 'Event request key was already used'; END IF;
  RETURN receipt->'result';
 END IF;
 SELECT * INTO draft FROM jsonb_populate_record(NULL::public.ticket_events,p_definition);
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=draft.timezone)
  THEN RAISE EXCEPTION 'Invalid event time zone'; END IF;
 SELECT * INTO previous FROM public.ticket_events WHERE tenant_id=t AND id=p_event_id FOR UPDATE;
 IF FOUND THEN
  IF previous.revision<>p_revision THEN RAISE EXCEPTION 'Event changed; reload before saving'; END IF;
  SELECT greatest(coalesce(sum(quantity) FILTER(WHERE livemode),0),coalesce(sum(quantity) FILTER(WHERE NOT livemode),0)) INTO used FROM public.ticket_orders WHERE tenant_id=t AND event_id=p_event_id
   AND state IN ('reserved','checkout','paid');
  IF draft.capacity<used THEN RAISE EXCEPTION 'Capacity cannot be below paid and reserved tickets'; END IF;
  UPDATE public.ticket_events SET slug=draft.slug,title=draft.title,headline=draft.headline,
   description=draft.description,starts_at=draft.starts_at,ends_at=draft.ends_at,timezone=draft.timezone,
   venue_name=draft.venue_name,venue_address=draft.venue_address,price_cents=draft.price_cents,
   capacity=draft.capacity,refund_cutoff=draft.refund_cutoff,refund_policy=draft.refund_policy,
   support_description=draft.support_description,status=draft.status,revision=revision+1,updated_at=clock_timestamp()
   WHERE tenant_id=t AND id=p_event_id RETURNING * INTO saved;
 ELSE
  IF p_revision<>0 THEN RAISE EXCEPTION 'Event not found'; END IF;
  INSERT INTO public.ticket_events(id,tenant_id,slug,title,headline,description,starts_at,ends_at,timezone,
   venue_name,venue_address,price_cents,capacity,refund_cutoff,refund_policy,support_description,status)
   VALUES(p_event_id,t,draft.slug,draft.title,draft.headline,draft.description,draft.starts_at,draft.ends_at,
   draft.timezone,draft.venue_name,draft.venue_address,draft.price_cents,draft.capacity,draft.refund_cutoff,
   draft.refund_policy,draft.support_description,draft.status) RETURNING * INTO saved;
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'ticket_event.saved','ticket_event',p_event_id::text,'admin',
   jsonb_build_object('event_request_id',p_request_id,'event_id',p_event_id,'definition',p_definition,'result',to_jsonb(saved)));
 RETURN to_jsonb(saved);
END $$;

CREATE OR REPLACE FUNCTION public.reserve_event_order(
 p_slug text,p_request_id uuid,p_quantity integer,p_revision integer,p_buyer_name text,p_buyer_email text,
 p_digest text,p_attribution jsonb,p_stripe_account text,p_livemode boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; e public.ticket_events; o public.ticket_orders; used integer;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=t AND config->'modules'->>'event-ticketing'='true') THEN RAISE EXCEPTION 'Event ticketing is disabled'; END IF;
 SELECT * INTO e FROM public.ticket_events WHERE tenant_id=t AND slug=p_slug FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workshop not found'; END IF;
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND request_id=p_request_id;
 IF FOUND THEN
  IF o.event_id<>e.id OR o.request_digest<>p_digest THEN RAISE EXCEPTION 'Checkout request key was already used'; END IF;
  RETURN to_jsonb(o);
 END IF;
 IF e.status<>'published' OR e.starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'Ticket sales are closed'; END IF;
 IF p_revision IS NULL OR e.revision<>p_revision THEN RAISE EXCEPTION 'Event changed; review current details before paying'; END IF;
 IF p_quantity IS NULL OR p_quantity<1 OR p_quantity>40 OR p_request_id IS NULL
  OR p_buyer_email IS NULL OR p_buyer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR p_attribution IS NULL OR jsonb_typeof(p_attribution)<>'object' OR octet_length(p_attribution::text)>2000
  THEN RAISE EXCEPTION 'Invalid ticket order'; END IF;
 SELECT coalesce(sum(quantity),0) INTO used FROM public.ticket_orders WHERE tenant_id=t AND event_id=e.id
  AND livemode=p_livemode AND state IN ('reserved','checkout','paid');
 IF used+p_quantity>e.capacity THEN RAISE EXCEPTION 'Not enough tickets remain; choose a smaller quantity'; END IF;
 INSERT INTO public.ticket_orders(tenant_id,event_id,request_id,request_digest,quantity,unit_price_cents,
  total_cents,buyer_name,buyer_email,event_snapshot,attribution,stripe_account_id,livemode,expires_at)
 VALUES(t,e.id,p_request_id,p_digest,p_quantity,e.price_cents,p_quantity*e.price_cents,btrim(p_buyer_name),
  lower(p_buyer_email),to_jsonb(e),p_attribution,p_stripe_account,p_livemode,clock_timestamp()+interval '35 minutes')
 RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.record_event_checkout(
 p_order_id uuid,p_session_id text,p_checkout_url text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; o public.ticket_orders;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_session_id IS NULL OR p_session_id !~ '^cs_[A-Za-z0-9_]+' OR p_checkout_url IS NULL
  OR p_checkout_url !~ '^https://checkout\.stripe\.com/' OR p_expires_at IS NULL
  THEN RAISE EXCEPTION 'Invalid Stripe checkout receipt'; END IF;
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.stripe_session_id IS NOT NULL AND o.stripe_session_id<>p_session_id
  THEN RAISE EXCEPTION 'Order already has a different checkout'; END IF;
 UPDATE public.ticket_orders SET stripe_session_id=p_session_id,stripe_checkout_url=p_checkout_url,
  expires_at=p_expires_at,state=CASE WHEN state='reserved' THEN 'checkout' ELSE state END
  WHERE tenant_id=t AND id=p_order_id RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.observe_event_payment(
 p_order_id uuid,p_external_id text,p_observation jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; o public.ticket_orders; e uuid; new_state text; refunded integer; prior public.ticket_order_receipts;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT event_id INTO e FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id;
 IF e IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 PERFORM 1 FROM public.ticket_events WHERE tenant_id=t AND id=e FOR UPDATE;
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id FOR UPDATE;
 IF p_external_id IS NULL OR p_observation IS NULL OR jsonb_typeof(p_observation)<>'object'
  OR p_observation->>'session_id' IS NULL OR p_observation->>'session_id' !~ '^cs_[A-Za-z0-9_]+'
  OR p_observation->>'account_id' IS DISTINCT FROM o.stripe_account_id
  OR (p_observation->>'livemode')::boolean IS DISTINCT FROM o.livemode
  OR (p_observation->>'total_cents')::integer IS DISTINCT FROM o.total_cents
  OR (p_observation->>'quantity')::integer IS DISTINCT FROM o.quantity
  OR p_observation->>'currency' IS DISTINCT FROM 'usd'
  OR (o.stripe_session_id IS NOT NULL AND p_observation->>'session_id'<>o.stripe_session_id)
  THEN RAISE EXCEPTION 'Stripe observation does not match the order'; END IF;
 SELECT * INTO prior FROM public.ticket_order_receipts WHERE tenant_id=t AND external_id=p_external_id;
 IF FOUND THEN
  IF prior.order_id<>o.id THEN RAISE EXCEPTION 'Receipt belongs to another order'; END IF;
  RETURN to_jsonb(o);
 END IF;
 new_state:=p_observation->>'state';
 IF new_state NOT IN ('paid','expired') OR new_state IS NULL THEN RAISE EXCEPTION 'Invalid payment state'; END IF;
 refunded:=greatest(o.refund_cents,coalesce((p_observation->>'refund_cents')::integer,0));
 IF refunded<0 OR refunded>o.total_cents THEN RAISE EXCEPTION 'Invalid refund amount'; END IF;
 IF new_state='paid' AND (p_observation->>'payment_intent_id' IS NULL OR p_observation->>'payment_intent_id' !~ '^pi_[A-Za-z0-9]+$')
  THEN RAISE EXCEPTION 'Payment receipt has no payment intent'; END IF;
 IF new_state='paid' AND o.state='expired' THEN RAISE EXCEPTION 'Released order requires provider reconciliation'; END IF;
 IF o.state='refunded' OR refunded=o.total_cents THEN new_state:='refunded';
 ELSIF o.state='paid' THEN new_state:='paid'; END IF;
 UPDATE public.ticket_orders SET state=new_state,refund_cents=refunded,
  stripe_session_id=p_observation->>'session_id',
  payment_intent_id=coalesce(payment_intent_id,p_observation->>'payment_intent_id'),
  paid_at=CASE WHEN new_state IN ('paid','refunded') THEN coalesce(paid_at,clock_timestamp()) ELSE paid_at END
  WHERE tenant_id=t AND id=o.id RETURNING * INTO o;
 INSERT INTO public.ticket_order_receipts(tenant_id,order_id,external_id,observation) VALUES(t,o.id,p_external_id,p_observation);
 INSERT INTO public.audit_log(tenant_id,action,entity_type,entity_id,source,metadata)
  VALUES(t,'ticket_order.'||new_state,'ticket_order',o.id::text,'webhook',
   jsonb_build_object('quantity',o.quantity,'total_cents',o.total_cents,'refund_cents',o.refund_cents,'receipt',p_external_id));
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.release_uncreated_ticket_order(p_order_id uuid,p_provider_request_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; o public.ticket_orders; e uuid;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT event_id INTO e FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id;
 IF e IS NULL OR nullif(p_provider_request_id,'') IS NULL THEN RAISE EXCEPTION 'Provider absence receipt required'; END IF;
 PERFORM 1 FROM public.ticket_events WHERE tenant_id=t AND id=e FOR UPDATE;
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id FOR UPDATE;
 IF o.state='expired' THEN RETURN to_jsonb(o); END IF;
 IF o.state<>'reserved' OR o.stripe_session_id IS NOT NULL OR o.expires_at+interval '1 minute'>=clock_timestamp()
  THEN RAISE EXCEPTION 'Reservation still requires provider reconciliation'; END IF;
 UPDATE public.ticket_orders SET state='expired' WHERE tenant_id=t AND id=o.id RETURNING * INTO o;
 INSERT INTO public.ticket_order_receipts(tenant_id,order_id,external_id,observation)
  VALUES(t,o.id,'absence:'||o.id::text,jsonb_build_object('state','expired','provider_request_id',p_provider_request_id,'reason','Complete Stripe session listing contains no session for this expired order'));
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.record_ticket_confirmation(p_order_id uuid,p_status text,p_error text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; o public.ticket_orders;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT * INTO o FROM public.ticket_orders WHERE tenant_id=t AND id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('sent','attention') OR length(p_error)>500
  THEN RAISE EXCEPTION 'Invalid confirmation status'; END IF;
 IF p_status='sent' AND NOT EXISTS(SELECT 1 FROM public.messages WHERE tenant_id=t
  AND idempotency_key='event-ticket-confirmation:'||t::text||':'||o.id::text
  AND status='sent' AND provider_id IS NOT NULL)
  THEN RAISE EXCEPTION 'A recorded provider email receipt is required'; END IF;
 UPDATE public.ticket_orders SET email_status=p_status,email_error=CASE WHEN p_status='sent' THEN NULL ELSE p_error END
  WHERE tenant_id=t AND id=o.id RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

REVOKE ALL ON FUNCTION public.save_ticket_event(uuid,integer,jsonb,uuid,text),
 public.reserve_event_order(text,uuid,integer,integer,text,text,text,jsonb,text,boolean),
 public.record_event_checkout(uuid,text,text,timestamptz),public.observe_event_payment(uuid,text,jsonb),public.release_uncreated_ticket_order(uuid,text),public.record_ticket_confirmation(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_ticket_event(uuid,integer,jsonb,uuid,text),
 public.reserve_event_order(text,uuid,integer,integer,text,text,text,jsonb,text,boolean),
 public.record_event_checkout(uuid,text,text,timestamptz),public.observe_event_payment(uuid,text,jsonb),public.release_uncreated_ticket_order(uuid,text),public.record_ticket_confirmation(uuid,text,text)
 TO service_role;
CREATE INDEX IF NOT EXISTS ticket_event_request_receipt ON public.audit_log(tenant_id,(metadata->>'event_request_id'))
 WHERE action='ticket_event.saved';

INSERT INTO public.ticket_events(id,tenant_id,slug,title,headline,description,starts_at,ends_at,timezone,
 venue_name,venue_address,price_cents,capacity,refund_cutoff,refund_policy,support_description,status)
 SELECT 'acce1e8e-1111-4111-8111-202611110001',id,'ai-strategy-workshop-chicago-2026',
 'AI for Your Business: A Practical Strategy Workshop','Build an AI strategy you can put to work.',
 'Join John Connor and Matthew Rolnick for a practical workshop on using AI to grow revenue and get time back. See real business workflows in action, identify opportunities in your own company, and leave with clear priorities for getting started.',
 '2026-11-11 12:00:00-06','2026-11-11 13:30:00-06','America/Chicago','Ferris & Co.',
 '1 W Monroe Street, Chicago, IL 60603',5000,40,'2026-11-09 12:00:00-06',
 'Full refunds are available for requests received by noon Chicago time on November 9, 2026. Contact john@acceleratewith.us with your order reference. If Accelerate cancels the workshop, all tickets will be refunded in full.',
 'Want help putting your strategy into practice? Optional one-on-one implementation support is available after the workshop and is priced separately from admission.',
 'draft' FROM public.tenants WHERE id='acce1e8e-0000-4000-8000-000000000001'
 ON CONFLICT(tenant_id,slug) DO NOTHING;
UPDATE public.tenants SET config=jsonb_set(coalesce(config,'{}'::jsonb),'{modules}',
 coalesce(config->'modules','{}'::jsonb)||'{"event-ticketing":true}'::jsonb,true)
 WHERE id='acce1e8e-0000-4000-8000-000000000001' AND config->'modules'->'event-ticketing' IS NULL;
COMMIT;
