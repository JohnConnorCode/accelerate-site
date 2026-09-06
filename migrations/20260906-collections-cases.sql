-- Durable Collections Action Desk state. Provider observations and command
-- receipts are immutable; only service-role domain RPCs may mutate cases.
CREATE TABLE IF NOT EXISTS public.collection_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 contact_id uuid NOT NULL, currency text NOT NULL CHECK(currency IN ('usd','eur','gbp','cad','aud')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','settled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 disputed boolean NOT NULL DEFAULT false, paused boolean NOT NULL DEFAULT false,
 pause_until date, promise_date date, owner_email text, next_action text NOT NULL DEFAULT 'Review overdue invoices' CHECK(char_length(btrim(next_action)) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_one_open_case ON public.collection_cases(tenant_id,contact_id,currency) WHERE status='open';
CREATE TABLE IF NOT EXISTS public.collection_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 request_id uuid NOT NULL, creation_action_id uuid NOT NULL, contact_id uuid NOT NULL,
 provider_account text NOT NULL, credential_version integer NOT NULL CHECK(credential_version>0), invoice_id text NOT NULL, test_mode boolean NOT NULL,
 currency text NOT NULL CHECK(currency IN ('usd','eur','gbp','cad','aud')),
 status text NOT NULL CHECK(status IN ('draft','open','paid','void','uncollectible')),
 remaining bigint NOT NULL CHECK(remaining BETWEEN 0 AND 100000000), due_date date,
 observed_at timestamptz NOT NULL, provider_request_id text,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_id,creation_action_id),
 FOREIGN KEY(tenant_id,creation_action_id) REFERENCES public.action_queue(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id),
 CHECK(status<>'paid' OR remaining=0)
);
CREATE TABLE IF NOT EXISTS public.collection_case_invoices (
 tenant_id uuid NOT NULL, case_id uuid NOT NULL, creation_action_id uuid NOT NULL, observation_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,case_id,creation_action_id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES public.collection_cases(tenant_id,id),
 FOREIGN KEY(tenant_id,creation_action_id) REFERENCES public.action_queue(tenant_id,id),
 FOREIGN KEY(tenant_id,observation_id) REFERENCES public.collection_observations(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.collection_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, case_id uuid NOT NULL,
 request_id uuid NOT NULL, kind text NOT NULL, actor_email text NOT NULL, before_state jsonb, after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,case_id) REFERENCES public.collection_cases(tenant_id,id),
 UNIQUE(tenant_id,request_id,case_id)
);
CREATE TABLE IF NOT EXISTS public.collection_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), request_id uuid NOT NULL,
 command_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,request_id)
);
CREATE OR REPLACE FUNCTION private.collection_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Collection evidence is immutable'; END $$;
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['collection_cases','collection_observations','collection_case_invoices','collection_events','collection_commands'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated,service_role',n);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated,service_role',n);
  EXECUTE format('DROP POLICY IF EXISTS collection_tenant_read ON public.%I',n);
  EXECUTE format('CREATE POLICY collection_tenant_read ON public.%I FOR SELECT TO authenticated,service_role USING (tenant_id=private.authorized_request_tenant_id())',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['collection_observations','collection_events','collection_commands'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS collection_immutable ON public.%I',n);
  EXECUTE format('CREATE TRIGGER collection_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.collection_immutable()',n);
 END LOOP;
END $$;
-- A tenant-wide lock gives provider ingestion and human edits the same ordering.
-- Disable/suspension is rechecked while holding the workspace row lock.
CREATE OR REPLACE FUNCTION private.collection_write_tenant() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Host service required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':collections',0));
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR (cfg #> '{modules,receivables-collections}' IS DISTINCT FROM 'true'::jsonb OR cfg #> '{modules,stripe-invoicing}' IS DISTINCT FROM 'true'::jsonb) THEN
  RAISE EXCEPTION 'Collections is disabled or workspace unavailable' USING ERRCODE='42501';
 END IF;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION private.collection_write_tenant() FROM PUBLIC,anon,authenticated;
-- One canonical work item per case. Payment cancels pursuit with an explicit
-- outcome, never a fabricated successful reminder receipt.
CREATE OR REPLACE FUNCTION private.collection_record_change(p_case uuid,p_request uuid,p_kind text,p_actor text,p_before jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.collection_cases%ROWTYPE; deadline timestamptz; BEGIN
 SELECT * INTO STRICT c FROM public.collection_cases WHERE id=p_case;
 INSERT INTO public.collection_events(tenant_id,case_id,request_id,kind,actor_email,before_state,after_state)
 VALUES(c.tenant_id,c.id,p_request,p_kind,p_actor,p_before,to_jsonb(c));
 INSERT INTO public.activities(tenant_id,activity_type,title,contact_id,source,actor_email,external_id,metadata)
 VALUES(c.tenant_id,'collection_case_updated',c.next_action,c.contact_id,'collections',p_actor,p_request::text||':'||c.id::text,jsonb_build_object('caseId',c.id,'revision',c.revision,'kind',p_kind));
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state)
 VALUES(c.tenant_id,p_actor,'collections.'||p_kind,'collection_case',c.id::text,p_before,to_jsonb(c));
 IF c.status='settled' OR c.paused OR c.disputed THEN
  UPDATE public.work_items SET status='cancelled',outcome=CASE WHEN c.status='settled' THEN 'Verified payment settled tracked invoices' ELSE 'Collection pursuit held for review' END,
   finished_at=now(),lease_owner=NULL,lease_expires_at=NULL
  WHERE tenant_id=c.tenant_id AND kind='review_collection_case' AND entity_id=c.id AND status IN ('pending','claimed','in_progress','waiting');
 ELSE
  deadline:=greatest(now(),(c.promise_date+1)::timestamp AT TIME ZONE 'UTC',(c.pause_until+1)::timestamp AT TIME ZONE 'UTC');
  INSERT INTO public.work_items(tenant_id,kind,objective,reason,source,entity_type,entity_id,dedupe_key,due_at,next_check_at,next_check_reason)
  VALUES(c.tenant_id,'review_collection_case',c.next_action,'Review verified invoice balance and current case policy','collections','collection_case',c.id,'collections:'||c.id::text,deadline,deadline,'Recheck current balance after the recorded promise or pause')
  ON CONFLICT(tenant_id,dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('pending','claimed','in_progress','waiting') DO UPDATE
   SET objective=EXCLUDED.objective,due_at=EXCLUDED.due_at,next_check_at=EXCLUDED.next_check_at,next_check_reason=EXCLUDED.next_check_reason;
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.collection_record_change(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sync_collection_observations(p_request uuid,p_observations jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; h text; prior public.collection_commands%ROWTYPE; item jsonb; a public.action_queue%ROWTYPE;
 c public.collection_cases%ROWTYPE; oid uuid; before_case jsonb; touched uuid[]:='{}'; target_case_id uuid; output jsonb; BEGIN
 t:=private.collection_write_tenant();
 IF p_request IS NULL OR p_observations IS NULL OR char_length(p_actor)>254 OR nullif(btrim(p_actor),'') IS NULL OR jsonb_typeof(p_observations)<>'array' OR jsonb_array_length(p_observations) NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'Invalid observation batch'; END IF;
 IF (SELECT count(DISTINCT value->>'creationActionId') FROM jsonb_array_elements(p_observations))<>jsonb_array_length(p_observations) THEN RAISE EXCEPTION 'Duplicate invoice operation'; END IF;
 SELECT encode(digest('observe:'||string_agg(value->>'creationActionId',',' ORDER BY value->>'creationActionId'),'sha256'),'hex') INTO h FROM jsonb_array_elements(p_observations);
 SELECT * INTO prior FROM public.collection_commands WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN IF prior.command_hash<>h THEN RAISE EXCEPTION 'Request identity conflict'; END IF; RETURN prior.result; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_observations) LOOP
  IF (item->>'complete')::boolean IS DISTINCT FROM true OR (item->>'observedAt')::timestamptz>now()+interval '5 seconds' OR (item->>'observedAt')::timestamptz<now()-interval '15 minutes' THEN RAISE EXCEPTION 'Incomplete or stale invoice observation'; END IF;
  IF EXISTS(SELECT 1 FROM public.collection_observations o WHERE o.tenant_id=t AND o.creation_action_id=(item->>'creationActionId')::uuid AND o.observed_at>(item->>'observedAt')::timestamptz) THEN RAISE EXCEPTION 'A newer provider observation already exists'; END IF;
  PERFORM 1 FROM public.integration_connections WHERE tenant_id=t AND provider='stripe' AND status='connected' AND account_email=item->>'providerAccount' AND credential_version=(item->>'credentialVersion')::integer FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stripe connection changed during observation'; END IF;
  IF EXISTS(SELECT 1 FROM public.collection_observations o WHERE o.tenant_id=t AND o.creation_action_id=(item->>'creationActionId')::uuid AND o.status='paid' AND item->>'status'<>'paid') THEN RAISE EXCEPTION 'Paid invoice cannot regress to collection pursuit'; END IF;
  SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=(item->>'creationActionId')::uuid AND action_type='create_stripe_invoice_draft';
  IF NOT FOUND OR a.result->>'invoiceId' IS DISTINCT FROM item->>'invoiceId' OR a.payload->>'contactId' IS DISTINCT FROM item->>'contactId' OR a.payload->>'accountId' IS DISTINCT FROM item->>'providerAccount' OR a.payload->'testMode' IS DISTINCT FROM item->'testMode' OR a.payload->>'currency' IS DISTINCT FROM item->>'currency' THEN RAISE EXCEPTION 'Invoice provenance mismatch'; END IF;
  SELECT * INTO c FROM public.collection_cases WHERE tenant_id=t AND contact_id=(item->>'contactId')::uuid AND currency=item->>'currency' AND status='open';
  IF NOT FOUND AND item->>'status'='open' AND (item->>'remaining')::bigint>0 AND (item->>'dueDate')::date<(now() AT TIME ZONE 'UTC')::date THEN
   INSERT INTO public.collection_cases(tenant_id,contact_id,currency) VALUES(t,(item->>'contactId')::uuid,item->>'currency') RETURNING * INTO c;
  END IF;
  INSERT INTO public.collection_observations(tenant_id,request_id,creation_action_id,contact_id,provider_account,credential_version,invoice_id,test_mode,currency,status,remaining,due_date,observed_at,provider_request_id)
  VALUES(t,p_request,a.id,(item->>'contactId')::uuid,item->>'providerAccount',(item->>'credentialVersion')::integer,item->>'invoiceId',(item->>'testMode')::boolean,item->>'currency',item->>'status',(item->>'remaining')::bigint,(item->>'dueDate')::date,(item->>'observedAt')::timestamptz,item->>'providerRequestId') RETURNING id INTO oid;
  IF c.id IS NOT NULL THEN
   INSERT INTO public.collection_case_invoices VALUES(t,c.id,a.id,oid) ON CONFLICT(tenant_id,case_id,creation_action_id) DO UPDATE SET observation_id=EXCLUDED.observation_id;
   IF NOT c.id=ANY(touched) THEN touched:=array_append(touched,c.id); END IF;
  END IF;
 END LOOP;
 FOREACH target_case_id IN ARRAY touched LOOP
  SELECT * INTO STRICT c FROM public.collection_cases WHERE id=target_case_id AND tenant_id=t; before_case:=to_jsonb(c);
  IF NOT EXISTS(SELECT 1 FROM public.collection_case_invoices i JOIN public.collection_observations o ON o.tenant_id=i.tenant_id AND o.id=i.observation_id WHERE i.tenant_id=t AND i.case_id=c.id AND (o.status<>'paid' OR o.remaining<>0)) THEN
   UPDATE public.collection_cases SET status='settled',settled_at=now(),next_action='Verified payment settled tracked invoices',revision=revision+1,updated_at=now() WHERE id=c.id;
  ELSE UPDATE public.collection_cases SET revision=revision+1,updated_at=now() WHERE id=c.id; END IF;
  PERFORM private.collection_record_change(c.id,p_request,'provider_observation',p_actor,before_case);
 END LOOP;
 output:=jsonb_build_object('caseIds',to_jsonb(touched),'observations',jsonb_array_length(p_observations));
 INSERT INTO public.collection_commands VALUES(t,p_request,h,output,now()); RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.sync_collection_observations(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_collection_observations(uuid,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.update_collection_case(p_case uuid,p_revision integer,p_request uuid,p_patch jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; h text; prior public.collection_commands%ROWTYPE; c public.collection_cases%ROWTYPE; before_case jsonb; output jsonb; BEGIN
 t:=private.collection_write_tenant();
 IF p_request IS NULL OR p_case IS NULL OR p_revision IS NULL OR p_revision<1 OR p_patch IS NULL OR char_length(p_actor)>254 OR nullif(btrim(p_actor),'') IS NULL OR jsonb_typeof(p_patch)<>'object' OR p_patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('disputed','paused','pauseUntil','promiseDate','ownerEmail','nextAction')) THEN RAISE EXCEPTION 'Invalid case change'; END IF;
 h:=encode(digest('edit:'||p_case::text||':'||p_revision::text||':'||p_patch::text,'sha256'),'hex');
 SELECT * INTO prior FROM public.collection_commands WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN IF prior.command_hash<>h THEN RAISE EXCEPTION 'Request identity conflict'; END IF; RETURN prior.result; END IF;
 SELECT * INTO c FROM public.collection_cases WHERE tenant_id=t AND id=p_case AND status='open';
 IF NOT FOUND OR c.revision<>p_revision THEN RAISE EXCEPTION 'Case changed or unavailable' USING ERRCODE='40001'; END IF;
 before_case:=to_jsonb(c);
 UPDATE public.collection_cases SET
 disputed=CASE WHEN p_patch?'disputed' THEN (p_patch->>'disputed')::boolean ELSE disputed END,
 paused=CASE WHEN p_patch?'paused' THEN (p_patch->>'paused')::boolean ELSE paused END,
 pause_until=CASE WHEN p_patch?'pauseUntil' THEN (p_patch->>'pauseUntil')::date ELSE pause_until END,
 promise_date=CASE WHEN p_patch?'promiseDate' THEN (p_patch->>'promiseDate')::date ELSE promise_date END,
 owner_email=CASE WHEN p_patch?'ownerEmail' THEN p_patch->>'ownerEmail' ELSE owner_email END,
 next_action=CASE WHEN p_patch?'nextAction' THEN p_patch->>'nextAction' ELSE next_action END,
 revision=revision+1,updated_at=now() WHERE id=c.id RETURNING to_jsonb(collection_cases.*) INTO output;
 PERFORM private.collection_record_change(c.id,p_request,'policy_changed',p_actor,before_case);
 INSERT INTO public.collection_commands VALUES(t,p_request,h,output,now()); RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.update_collection_case(uuid,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_collection_case(uuid,integer,uuid,jsonb,text) TO service_role;
