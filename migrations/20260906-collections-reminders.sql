-- Dispatch receipts supplement the canonical approval and communication ledgers.
-- Uncertain external acceptance retains the case reservation without a timeout.
CREATE TABLE IF NOT EXISTS public.collection_reminder_attempts (
 tenant_id uuid NOT NULL, action_id uuid NOT NULL, case_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('dispatching','uncertain','sent')),
 digest text NOT NULL, case_revision integer NOT NULL, cooldown_hours integer NOT NULL CHECK(cooldown_hours BETWEEN 1 AND 720),
 message_id uuid, provider_id text, sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,action_id),
 FOREIGN KEY(tenant_id,action_id) REFERENCES public.action_queue(tenant_id,id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES public.collection_cases(tenant_id,id),
 FOREIGN KEY(tenant_id,message_id) REFERENCES public.messages(tenant_id,id),
 CHECK(state<>'sent' OR (message_id IS NOT NULL AND provider_id IS NOT NULL AND sent_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_one_dispatch ON public.collection_reminder_attempts(tenant_id,case_id) WHERE state IN ('dispatching','uncertain');
CREATE INDEX IF NOT EXISTS collection_reminder_history ON public.collection_reminder_attempts(tenant_id,case_id,sent_at DESC);
ALTER TABLE public.collection_reminder_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_reminder_attempts FROM anon,authenticated,service_role;
GRANT SELECT ON public.collection_reminder_attempts TO authenticated,service_role;
DROP POLICY IF EXISTS collection_tenant_read ON public.collection_reminder_attempts;
CREATE POLICY collection_tenant_read ON public.collection_reminder_attempts FOR SELECT TO authenticated,service_role USING(tenant_id=private.authorized_request_tenant_id());
CREATE OR REPLACE FUNCTION public.reserve_collection_reminder(p_action uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; a public.action_queue%ROWTYPE; c public.collection_cases%ROWTYPE; recipient public.contacts%ROWTYPE; hours integer; BEGIN
 t:=private.collection_write_tenant();
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action FOR UPDATE;
 IF NOT FOUND OR a.status<>'executing' OR a.action_type<>'send_collection_reminder' OR a.approved_by IS NULL OR a.approved_at IS NULL OR a.expires_at IS NULL OR a.expires_at<=now() THEN
  RAISE EXCEPTION 'Claimed unexpired human approval required'; END IF;
 IF EXISTS(SELECT 1 FROM public.collection_reminder_attempts WHERE tenant_id=t AND action_id=p_action) THEN
  RETURN jsonb_build_object('reserved',false,'state','existing'); END IF;
 SELECT * INTO c FROM public.collection_cases WHERE tenant_id=t AND id=(a.payload->>'caseId')::uuid FOR UPDATE;
 IF NOT FOUND OR c.status<>'open' OR c.revision IS DISTINCT FROM (a.payload->>'revision')::integer OR c.disputed OR c.paused OR c.pause_until >= (now() AT TIME ZONE 'UTC')::date OR c.promise_date >= (now() AT TIME ZONE 'UTC')::date THEN
  RAISE EXCEPTION 'Case policy changed'; END IF;
 SELECT * INTO recipient FROM public.contacts WHERE tenant_id=t AND id=c.contact_id FOR SHARE;
 IF NOT FOUND OR recipient.communication_status<>'active' OR lower(recipient.primary_email) IS DISTINCT FROM a.payload #>> '{preview,to}' OR c.contact_id::text IS DISTINCT FROM a.payload #>> '{preview,contactId}' THEN
  RAISE EXCEPTION 'Recipient changed or suppressed'; END IF;
 IF a.payload->>'digest' IS NULL OR a.payload->>'digest' !~ '^[a-f0-9]{64}$' OR a.payload->>'digest' IS DISTINCT FROM a.payload #>> '{preview,digest}' THEN
  RAISE EXCEPTION 'Bound reminder content is required'; END IF;
 SELECT coalesce((config #>> '{moduleSettings,receivables-collections,cooldownHours}')::integer,72) INTO hours FROM public.tenants WHERE id=t;
 IF hours NOT BETWEEN 1 AND 720 OR hours IS DISTINCT FROM (a.payload #>> '{preview,cooldownHours}')::integer THEN RAISE EXCEPTION 'Reminder policy changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.collection_reminder_attempts WHERE tenant_id=t AND case_id=c.id AND (state IN ('dispatching','uncertain') OR sent_at>now()-make_interval(hours=>hours))) THEN
  RAISE EXCEPTION 'A reminder is unresolved or within cooldown'; END IF;
 INSERT INTO public.collection_reminder_attempts(tenant_id,action_id,case_id,state,digest,case_revision,cooldown_hours) VALUES(t,p_action,c.id,'dispatching',a.payload->>'digest',c.revision,hours);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state) VALUES(t,a.approved_by,'collections.reminder_reserved','collection_case',c.id::text,jsonb_build_object('actionId',p_action,'digest',a.payload->>'digest'));
 RETURN jsonb_build_object('reserved',true,'state','dispatching');
END $$;
-- Records known external facts even after plugin disable; it cannot initiate a
-- send. It recovers only the exact canonical message created for this action.
CREATE OR REPLACE FUNCTION public.reconcile_collection_reminder(p_action uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; r public.collection_reminder_attempts%ROWTYPE; m public.messages%ROWTYPE; actor text; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Host service required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':collections',0));
 SELECT * INTO r FROM public.collection_reminder_attempts WHERE tenant_id=t AND action_id=p_action FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No reminder dispatch exists'; END IF;
 IF r.state='sent' THEN RETURN to_jsonb(r); END IF;
 SELECT * INTO m FROM public.messages WHERE tenant_id=t AND idempotency_key='action:'||p_action::text;
 IF NOT FOUND OR m.provider_id IS NULL OR m.sent_at IS NULL THEN
  UPDATE public.collection_reminder_attempts SET state='uncertain',updated_at=now() WHERE tenant_id=t AND action_id=p_action RETURNING * INTO r;
  RETURN to_jsonb(r);
 END IF;
 UPDATE public.collection_reminder_attempts SET state='sent',message_id=m.id,provider_id=m.provider_id,sent_at=m.sent_at,updated_at=now() WHERE tenant_id=t AND action_id=p_action RETURNING * INTO r;
 UPDATE public.work_items SET next_check_at=greatest(next_check_at,m.sent_at+make_interval(hours=>r.cooldown_hours)),next_check_reason='Recheck invoice balance after the confirmed reminder cooldown'
 WHERE tenant_id=t AND entity_id=r.case_id AND kind='review_collection_case' AND status IN ('pending','waiting');
 SELECT approved_by INTO actor FROM public.action_queue WHERE tenant_id=t AND id=p_action;
 INSERT INTO public.collection_events(tenant_id,case_id,request_id,kind,actor_email,after_state) VALUES(t,r.case_id,p_action,'reminder_sent',actor,to_jsonb(r));
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state) VALUES(t,actor,'collections.reminder_sent','collection_case',r.case_id::text,to_jsonb(r));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.reserve_collection_reminder(uuid),public.reconcile_collection_reminder(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_collection_reminder(uuid),public.reconcile_collection_reminder(uuid) TO service_role;
