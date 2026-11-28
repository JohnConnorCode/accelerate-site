-- Invoices owned by Accelerate. Stripe is used only as a payment rail
-- (one PaymentIntent per invoice). No Stripe Invoice, invoice item, coupon,
-- Billing object or post-payment invoice is ever created, so Stripe's
-- per-invoice Invoicing fee never applies.
BEGIN;

CREATE TABLE IF NOT EXISTS public.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 number text,
 contact_id uuid,
 kind text NOT NULL DEFAULT 'services' CHECK (kind IN ('services','general')),
 company_name text NOT NULL CHECK (length(btrim(company_name)) BETWEEN 1 AND 160),
 contact_name text NOT NULL CHECK (length(btrim(contact_name)) BETWEEN 1 AND 120),
 contact_email text NOT NULL CHECK (contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND length(contact_email)<=254),
 billing_line1 text NOT NULL DEFAULT '' CHECK (length(billing_line1)<=160),
 billing_line2 text NOT NULL DEFAULT '' CHECK (length(billing_line2)<=160),
 billing_city text NOT NULL DEFAULT '' CHECK (length(billing_city)<=100),
 billing_region text NOT NULL DEFAULT '' CHECK (length(billing_region)<=100),
 billing_postal text NOT NULL DEFAULT '' CHECK (length(billing_postal)<=20),
 billing_country text NOT NULL DEFAULT 'US' CHECK (billing_country='' OR billing_country ~ '^[A-Z]{2}$'),
 purchase_order text NOT NULL DEFAULT '' CHECK (length(purchase_order)<=100),
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 240),
 support_details text NOT NULL DEFAULT '' CHECK (length(support_details)<=240),
 service_period text NOT NULL DEFAULT '' CHECK (length(service_period)<=160),
 notes text NOT NULL DEFAULT '' CHECK (length(notes)<=500),
 tax_review text NOT NULL DEFAULT 'no_tax' CHECK (tax_review IN ('pending','no_tax','tax_included')),
 currency text NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd')),
 lines jsonb NOT NULL CHECK (jsonb_typeof(lines)='array' AND jsonb_array_length(lines) BETWEEN 1 AND 20),
 discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents>=0),
 discount_label text NOT NULL DEFAULT 'Agreed discount' CHECK (length(discount_label)<=40),
 amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 50 AND 99999999),
 invoice_date date,
 due_date date,
 due_days integer NOT NULL DEFAULT 15 CHECK (due_days BETWEEN 0 AND 365),
 payment_methods text[] NOT NULL DEFAULT ARRAY['us_bank_account','card']
  CHECK (cardinality(payment_methods) BETWEEN 1 AND 2 AND payment_methods <@ ARRAY['us_bank_account','card']),
 status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','open','processing','paid','paid_external','void')),
 stripe_account_id text CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 livemode boolean,
 stripe_payment_intent_id text CHECK (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
 stripe_charge_id text,
 amount_paid_cents bigint NOT NULL DEFAULT 0 CHECK (amount_paid_cents BETWEEN 0 AND amount_cents),
 refunded_cents bigint NOT NULL DEFAULT 0 CHECK (refunded_cents BETWEEN 0 AND amount_cents),
 link_token_hash text CHECK (link_token_hash ~ '^[a-f0-9]{64}$'),
 encrypted_link_token text,
 issued_at timestamptz, due_at timestamptz, paid_at timestamptz, voided_at timestamptz,
 external_payment_note text NOT NULL DEFAULT '' CHECK (length(external_payment_note)<=300),
 created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 254),
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,number), UNIQUE(tenant_id,stripe_payment_intent_id),
 UNIQUE(link_token_hash),
 CHECK (invoice_date IS NULL OR due_date IS NULL OR due_date>=invoice_date),
 CHECK (status IN ('draft','void') OR (number IS NOT NULL AND issued_at IS NOT NULL)),
 CHECK (status NOT IN ('open','processing','paid') OR (stripe_payment_intent_id IS NOT NULL AND stripe_account_id IS NOT NULL AND livemode IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS invoices_by_status ON public.invoices(tenant_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_by_contact ON public.invoices(tenant_id,contact_id);

CREATE TABLE IF NOT EXISTS public.invoice_payment_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 invoice_id uuid NOT NULL,
 external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 300),
 observation jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES public.invoices(tenant_id,id),
 UNIQUE(tenant_id,external_id)
);

CREATE TABLE IF NOT EXISTS public.invoice_number_counters (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 last_value integer NOT NULL DEFAULT 0 CHECK (last_value>=0)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant member invoice reads" ON public.invoices;
CREATE POLICY "Tenant member invoice reads" ON public.invoices FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member invoice reads" ON public.invoice_payment_receipts;
CREATE POLICY "Tenant member invoice reads" ON public.invoice_payment_receipts FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
REVOKE ALL ON public.invoices,public.invoice_payment_receipts,public.invoice_number_counters FROM anon,authenticated;
GRANT SELECT ON public.invoices,public.invoice_payment_receipts TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.invoices TO service_role;
REVOKE ALL ON public.invoice_payment_receipts,public.invoice_number_counters FROM service_role;
GRANT SELECT,INSERT ON public.invoice_payment_receipts TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.invoice_number_counters TO service_role;

-- Draft writes go through these functions so the tenant, status and totals are
-- checked in one transaction (no check-then-act across a network boundary).
CREATE OR REPLACE FUNCTION public.save_invoice_draft(p_id uuid,p_revision integer,p_draft jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; i public.invoices; subtotal bigint; line jsonb; d jsonb:=p_draft;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=t AND config->'modules'->>'invoicing'='true') THEN RAISE EXCEPTION 'Invoicing is disabled'; END IF;
 IF d IS NULL OR jsonb_typeof(d->'lines')<>'array' OR jsonb_array_length(d->'lines') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Add between 1 and 20 line items'; END IF;
 subtotal:=0;
 FOR line IN SELECT value FROM jsonb_array_elements(d->'lines') LOOP
  IF length(btrim(coalesce(line->>'description','')))<1 OR length(line->>'description')>240
   OR (line->>'quantity')::integer NOT BETWEEN 1 AND 1000 OR (line->>'unit_cents')::bigint NOT BETWEEN 1 AND 100000000
   THEN RAISE EXCEPTION 'Each line item needs a description, a quantity and a rate'; END IF;
  subtotal:=subtotal+(line->>'quantity')::bigint*(line->>'unit_cents')::bigint;
 END LOOP;
 IF coalesce((d->>'discount_cents')::bigint,0)<0 OR coalesce((d->>'discount_cents')::bigint,0)>=subtotal THEN RAISE EXCEPTION 'Discount must be less than the full price'; END IF;
 IF subtotal-coalesce((d->>'discount_cents')::bigint,0) NOT BETWEEN 50 AND 99999999 THEN RAISE EXCEPTION 'Invoice amount must be between $0.50 and $999,999.99'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO i FROM public.invoices WHERE tenant_id=t AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF i.status<>'draft' THEN RAISE EXCEPTION 'Only a draft can be edited. Void this invoice and create a new one.'; END IF;
  IF i.revision<>p_revision THEN RAISE EXCEPTION 'This draft changed. Reload it before saving.'; END IF;
 END IF;
 INSERT INTO public.invoices AS cur(id,tenant_id,contact_id,kind,company_name,contact_name,contact_email,billing_line1,billing_line2,billing_city,
  billing_region,billing_postal,billing_country,purchase_order,description,support_details,service_period,notes,tax_review,lines,discount_cents,
  discount_label,amount_cents,invoice_date,due_date,due_days,payment_methods,created_by)
 VALUES(coalesce(p_id,gen_random_uuid()),t,nullif(d->>'contact_id','')::uuid,coalesce(d->>'kind','services'),btrim(d->>'company_name'),btrim(d->>'contact_name'),
  lower(btrim(d->>'contact_email')),coalesce(d->>'billing_line1',''),coalesce(d->>'billing_line2',''),coalesce(d->>'billing_city',''),coalesce(d->>'billing_region',''),
  coalesce(d->>'billing_postal',''),coalesce(d->>'billing_country','US'),coalesce(d->>'purchase_order',''),btrim(d->>'description'),coalesce(d->>'support_details',''),
  coalesce(d->>'service_period',''),coalesce(d->>'notes',''),coalesce(d->>'tax_review','no_tax'),d->'lines',coalesce((d->>'discount_cents')::bigint,0),
  coalesce(d->>'discount_label','Agreed discount'),subtotal-coalesce((d->>'discount_cents')::bigint,0),nullif(d->>'invoice_date','')::date,nullif(d->>'due_date','')::date,
  coalesce((d->>'due_days')::integer,15),ARRAY(SELECT jsonb_array_elements_text(coalesce(d->'payment_methods','["us_bank_account","card"]'::jsonb))),p_actor)
 ON CONFLICT(id) DO UPDATE SET contact_id=EXCLUDED.contact_id,kind=EXCLUDED.kind,company_name=EXCLUDED.company_name,contact_name=EXCLUDED.contact_name,
  contact_email=EXCLUDED.contact_email,billing_line1=EXCLUDED.billing_line1,billing_line2=EXCLUDED.billing_line2,billing_city=EXCLUDED.billing_city,
  billing_region=EXCLUDED.billing_region,billing_postal=EXCLUDED.billing_postal,billing_country=EXCLUDED.billing_country,purchase_order=EXCLUDED.purchase_order,
  description=EXCLUDED.description,support_details=EXCLUDED.support_details,service_period=EXCLUDED.service_period,notes=EXCLUDED.notes,
  tax_review=EXCLUDED.tax_review,lines=EXCLUDED.lines,discount_cents=EXCLUDED.discount_cents,discount_label=EXCLUDED.discount_label,
  amount_cents=EXCLUDED.amount_cents,invoice_date=EXCLUDED.invoice_date,due_date=EXCLUDED.due_date,due_days=EXCLUDED.due_days,
  payment_methods=EXCLUDED.payment_methods,revision=cur.revision+1,updated_at=now()
  WHERE cur.tenant_id=t
 RETURNING * INTO i;
 IF i.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 RETURN to_jsonb(i);
END $$;

-- Assigns the next invoice number and records the PaymentIntent and the
-- customer link together, so a retry can never mint a second number.
CREATE OR REPLACE FUNCTION public.issue_invoice(p_id uuid,p_intent text,p_account text,p_livemode boolean,p_link_hash text,p_encrypted_link text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; i public.invoices; n integer;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_intent !~ '^pi_[A-Za-z0-9_]+$' OR p_account !~ '^acct_[A-Za-z0-9]+$' OR p_link_hash !~ '^[a-f0-9]{64}$' OR p_encrypted_link IS NULL
  THEN RAISE EXCEPTION 'Invalid invoice issue receipt'; END IF;
 SELECT * INTO i FROM public.invoices WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF i.status<>'draft' THEN
  IF i.stripe_payment_intent_id=p_intent THEN RETURN to_jsonb(i); END IF;
  RAISE EXCEPTION 'This invoice was already issued';
 END IF;
 INSERT INTO public.invoice_number_counters(tenant_id,last_value) VALUES(t,1)
  ON CONFLICT(tenant_id) DO UPDATE SET last_value=public.invoice_number_counters.last_value+1
  RETURNING last_value INTO n;
 UPDATE public.invoices SET status='open',number='INV-'||lpad(n::text,4,'0'),issued_at=now(),
  due_at=CASE WHEN due_date IS NOT NULL THEN due_date::timestamptz
   ELSE (coalesce(invoice_date,(now() AT TIME ZONE 'UTC')::date)+due_days)::timestamptz END,
  stripe_payment_intent_id=p_intent,stripe_account_id=p_account,livemode=p_livemode,
  link_token_hash=p_link_hash,encrypted_link_token=p_encrypted_link,revision=revision+1,updated_at=now()
 WHERE tenant_id=t AND id=p_id RETURNING * INTO i;
 RETURN to_jsonb(i);
END $$;

-- Applies a verified Stripe PaymentIntent observation. Idempotent per
-- external id; a paid invoice never regresses.
CREATE OR REPLACE FUNCTION public.observe_invoice_payment(p_id uuid,p_external_id text,p_observation jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; i public.invoices; s text; next_status text;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT * INTO i FROM public.invoices WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF p_external_id IS NULL OR p_observation IS NULL OR jsonb_typeof(p_observation)<>'object'
  OR p_observation->>'intent_id' IS DISTINCT FROM i.stripe_payment_intent_id
  OR p_observation->>'account_id' IS DISTINCT FROM i.stripe_account_id
  OR (p_observation->>'livemode')::boolean IS DISTINCT FROM i.livemode
  THEN RAISE EXCEPTION 'Payment observation does not match this invoice'; END IF;
 IF EXISTS(SELECT 1 FROM public.invoice_payment_receipts WHERE tenant_id=t AND external_id=p_external_id) THEN RETURN to_jsonb(i); END IF;
 s:=p_observation->>'intent_status';
 next_status:=CASE
  WHEN i.status IN ('paid','paid_external','void') THEN i.status
  WHEN s='succeeded' THEN 'paid'
  WHEN s='processing' THEN 'processing'
  ELSE 'open' END;
 IF s='succeeded' AND (p_observation->>'amount_received')::bigint IS DISTINCT FROM i.amount_cents THEN RAISE EXCEPTION 'Payment amount differs from the invoice'; END IF;
 INSERT INTO public.invoice_payment_receipts(tenant_id,invoice_id,external_id,observation) VALUES(t,i.id,p_external_id,p_observation);
 UPDATE public.invoices SET status=next_status,
  amount_paid_cents=CASE WHEN next_status='paid' THEN amount_cents ELSE amount_paid_cents END,
  paid_at=CASE WHEN next_status='paid' AND paid_at IS NULL THEN coalesce((p_observation->>'paid_at')::timestamptz,now()) ELSE paid_at END,
  stripe_charge_id=coalesce(p_observation->>'charge_id',stripe_charge_id),
  refunded_cents=greatest(refunded_cents,least(amount_cents,coalesce((p_observation->>'refunded_cents')::bigint,0))),
  revision=revision+1,updated_at=now()
 WHERE tenant_id=t AND id=i.id RETURNING * INTO i;
 RETURN to_jsonb(i);
END $$;

CREATE OR REPLACE FUNCTION public.close_invoice(p_id uuid,p_revision integer,p_outcome text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid; i public.invoices;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_outcome NOT IN ('void','paid_external') OR length(coalesce(p_note,''))>300 THEN RAISE EXCEPTION 'Invalid invoice change'; END IF;
 SELECT * INTO i FROM public.invoices WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF i.revision<>p_revision THEN RAISE EXCEPTION 'This invoice changed. Reload it before continuing.'; END IF;
 IF i.status IN ('paid','paid_external','void') THEN RAISE EXCEPTION 'This invoice is already closed'; END IF;
 IF i.status='processing' THEN RAISE EXCEPTION 'A payment is processing for this invoice. Wait for it to settle.'; END IF;
 IF p_outcome='paid_external' AND i.status='draft' THEN RAISE EXCEPTION 'Issue the invoice before recording a payment'; END IF;
 UPDATE public.invoices SET status=p_outcome,
  voided_at=CASE WHEN p_outcome='void' THEN now() ELSE voided_at END,
  paid_at=CASE WHEN p_outcome='paid_external' THEN now() ELSE paid_at END,
  amount_paid_cents=CASE WHEN p_outcome='paid_external' THEN amount_cents ELSE amount_paid_cents END,
  external_payment_note=coalesce(p_note,''),revision=revision+1,updated_at=now()
 WHERE tenant_id=t AND id=p_id RETURNING * INTO i;
 RETURN to_jsonb(i);
END $$;

REVOKE ALL ON FUNCTION public.save_invoice_draft(uuid,integer,jsonb,text),public.issue_invoice(uuid,text,text,boolean,text,text),
 public.observe_invoice_payment(uuid,text,jsonb),public.close_invoice(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_invoice_draft(uuid,integer,jsonb,text),public.issue_invoice(uuid,text,text,boolean,text,text),
 public.observe_invoice_payment(uuid,text,jsonb),public.close_invoice(uuid,integer,text,text) TO service_role;

-- The module is renamed from its old provider-specific id. Enabled stays enabled.
UPDATE public.tenants SET config=jsonb_set(config #- '{modules,stripe-invoicing}','{modules,invoicing}',config->'modules'->'stripe-invoicing')
 WHERE config->'modules' ? 'stripe-invoicing';

-- The previous design published pages for Stripe-hosted invoices. Nothing was
-- ever published (0 rows); our own invoices carry their own customer link.
DROP TABLE IF EXISTS public.invoice_pages;

DROP FUNCTION IF EXISTS public.protect_published_invoice_page() CASCADE;

-- Collections now track this workspace's own invoices. The evidence tables were
-- empty, so they are re-keyed from Stripe invoice actions to invoices.id.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='collection_observations' AND column_name='creation_action_id') THEN
  IF EXISTS(SELECT 1 FROM public.collection_observations) OR EXISTS(SELECT 1 FROM public.collection_case_invoices)
  THEN RAISE EXCEPTION 'Collection evidence exists; migrate it explicitly before re-keying'; END IF;
  ALTER TABLE public.collection_case_invoices DROP CONSTRAINT IF EXISTS collection_case_invoices_tenant_id_creation_action_id_fkey;
  ALTER TABLE public.collection_observations DROP CONSTRAINT IF EXISTS collection_observations_tenant_id_creation_action_id_fkey;
  ALTER TABLE public.collection_observations DROP CONSTRAINT IF EXISTS collection_observations_status_check;
  ALTER TABLE public.collection_observations DROP COLUMN IF EXISTS invoice_id;
  ALTER TABLE public.collection_observations DROP COLUMN IF EXISTS provider_account;
  ALTER TABLE public.collection_observations DROP COLUMN IF EXISTS credential_version;
  ALTER TABLE public.collection_observations DROP COLUMN IF EXISTS provider_request_id;
  ALTER TABLE public.collection_observations RENAME COLUMN creation_action_id TO invoice_id;
  ALTER TABLE public.collection_case_invoices RENAME COLUMN creation_action_id TO invoice_id;
  ALTER TABLE public.collection_observations ADD CONSTRAINT collection_observations_status_check
   CHECK(status IN ('draft','open','processing','paid','paid_external','void'));
  ALTER TABLE public.collection_observations ADD CONSTRAINT collection_observations_invoice_fkey
   FOREIGN KEY(tenant_id,invoice_id) REFERENCES public.invoices(tenant_id,id);
  ALTER TABLE public.collection_case_invoices ADD CONSTRAINT collection_case_invoices_invoice_fkey
   FOREIGN KEY(tenant_id,invoice_id) REFERENCES public.invoices(tenant_id,id);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION private.collection_write_tenant() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Host service required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':collections',0));
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR (cfg #> '{modules,receivables-collections}' IS DISTINCT FROM 'true'::jsonb OR cfg #> '{modules,invoicing}' IS DISTINCT FROM 'true'::jsonb) THEN
  RAISE EXCEPTION 'Collections is disabled or workspace unavailable' USING ERRCODE='42501';
 END IF;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION private.collection_write_tenant() FROM PUBLIC,anon,authenticated;

-- Observations are read from the invoices table inside this transaction, so a
-- caller cannot supply a balance; it only names which invoices to refresh.
CREATE OR REPLACE FUNCTION public.sync_collection_observations(p_request uuid,p_observations jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; h text; prior public.collection_commands%ROWTYPE; item jsonb; i public.invoices%ROWTYPE;
 c public.collection_cases%ROWTYPE; oid uuid; before_case jsonb; touched uuid[]:='{}'; target_case_id uuid; output jsonb; remaining bigint; BEGIN
 t:=private.collection_write_tenant();
 IF p_request IS NULL OR p_observations IS NULL OR char_length(p_actor)>254 OR nullif(btrim(p_actor),'') IS NULL OR jsonb_typeof(p_observations)<>'array' OR jsonb_array_length(p_observations) NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'Invalid observation batch'; END IF;
 IF (SELECT count(DISTINCT value->>'invoiceId') FROM jsonb_array_elements(p_observations))<>jsonb_array_length(p_observations) THEN RAISE EXCEPTION 'Duplicate invoice'; END IF;
 SELECT encode(digest('observe:'||string_agg(value->>'invoiceId',',' ORDER BY value->>'invoiceId'),'sha256'),'hex') INTO h FROM jsonb_array_elements(p_observations);
 SELECT * INTO prior FROM public.collection_commands WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN IF prior.command_hash<>h THEN RAISE EXCEPTION 'Request identity conflict'; END IF; RETURN prior.result; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_observations) LOOP
  SELECT * INTO i FROM public.invoices WHERE tenant_id=t AND id=(item->>'invoiceId')::uuid FOR SHARE;
  IF NOT FOUND OR i.contact_id IS NULL THEN RAISE EXCEPTION 'Collections tracks issued invoices linked to a contact'; END IF;
  remaining:=CASE WHEN i.status IN ('paid','paid_external','void') THEN 0 ELSE i.amount_cents-i.amount_paid_cents END;
  SELECT * INTO c FROM public.collection_cases WHERE tenant_id=t AND contact_id=i.contact_id AND currency=i.currency AND status='open';
  IF NOT FOUND AND i.status='open' AND remaining>0 AND i.due_at<now() THEN
   INSERT INTO public.collection_cases(tenant_id,contact_id,currency) VALUES(t,i.contact_id,i.currency) RETURNING * INTO c;
  END IF;
  INSERT INTO public.collection_observations(tenant_id,request_id,invoice_id,contact_id,test_mode,currency,status,remaining,due_date,observed_at)
  VALUES(t,p_request,i.id,i.contact_id,coalesce(NOT i.livemode,false),i.currency,i.status,remaining,i.due_at::date,now()) RETURNING id INTO oid;
  IF c.id IS NOT NULL THEN
   INSERT INTO public.collection_case_invoices VALUES(t,c.id,i.id,oid) ON CONFLICT(tenant_id,case_id,invoice_id) DO UPDATE SET observation_id=EXCLUDED.observation_id;
   IF NOT c.id=ANY(touched) THEN touched:=array_append(touched,c.id); END IF;
  END IF;
 END LOOP;
 FOREACH target_case_id IN ARRAY touched LOOP
  SELECT * INTO STRICT c FROM public.collection_cases WHERE id=target_case_id AND tenant_id=t; before_case:=to_jsonb(c);
  IF NOT EXISTS(SELECT 1 FROM public.collection_case_invoices ci JOIN public.collection_observations o ON o.tenant_id=ci.tenant_id AND o.id=ci.observation_id WHERE ci.tenant_id=t AND ci.case_id=c.id AND o.remaining<>0) THEN
   UPDATE public.collection_cases SET status='settled',settled_at=now(),next_action='Verified payment settled tracked invoices',revision=revision+1,updated_at=now() WHERE id=c.id;
  ELSE UPDATE public.collection_cases SET revision=revision+1,updated_at=now() WHERE id=c.id; END IF;
  PERFORM private.collection_record_change(c.id,p_request,'provider_observation',p_actor,before_case);
 END LOOP;
 output:=jsonb_build_object('caseIds',to_jsonb(touched),'observations',jsonb_array_length(p_observations));
 INSERT INTO public.collection_commands VALUES(t,p_request,h,output,now()); RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.sync_collection_observations(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_collection_observations(uuid,jsonb,text) TO service_role;

COMMIT;
