BEGIN;
-- Reservations supplement the canonical action/message ledgers. An uncertain
-- attempt has no automatic timeout: observation can recover it, never resend it.
CREATE TABLE IF NOT EXISTS public.radar_outreach_attempts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), action_id uuid NOT NULL,
 opportunity_id uuid NOT NULL, asset_id uuid NOT NULL, contact_ids uuid[] NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('dispatching','uncertain','sent','not_sent')),
 message_id uuid, provider_id text, sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,action_id),
 FOREIGN KEY(tenant_id,action_id) REFERENCES public.action_queue(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES public.radar_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES public.radar_assets(tenant_id,id),
 FOREIGN KEY(tenant_id,message_id) REFERENCES public.messages(tenant_id,id),
 CHECK(cardinality(contact_ids) BETWEEN 1 AND 2),
 CHECK(state<>'sent' OR (message_id IS NOT NULL AND provider_id IS NOT NULL AND sent_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS radar_outreach_history ON public.radar_outreach_attempts(tenant_id,created_at DESC);
ALTER TABLE public.radar_outreach_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.radar_outreach_attempts FROM anon,authenticated,service_role;
GRANT SELECT ON public.radar_outreach_attempts TO authenticated,service_role;
DROP POLICY IF EXISTS radar_outreach_read ON public.radar_outreach_attempts;
CREATE POLICY radar_outreach_read ON public.radar_outreach_attempts FOR SELECT TO authenticated,service_role USING(tenant_id=private.authorized_request_tenant_id());
CREATE OR REPLACE FUNCTION public.reserve_radar_outreach(p_action uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; a public.action_queue%ROWTYPE; o public.radar_opportunities%ROWTYPE;
 cfg jsonb; settings jsonb; preview jsonb; item jsonb; ids uuid[]; hours integer; cap integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Host service required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':radar-outreach',0));
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce((cfg #>> '{modules,opportunity-radar}')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Active Radar workspace required'; END IF;
 settings:=cfg #> '{moduleSettings,opportunity-radar}';
 IF settings->>'outreachMode' IS DISTINCT FROM 'approval-required' THEN RAISE EXCEPTION 'Outreach remains draft-only'; END IF;
 hours:=coalesce((settings->>'outreachCooldownHours')::integer,168); cap:=coalesce((settings->>'outreachDailyLimit')::integer,5);
 IF hours NOT BETWEEN 24 AND 2160 OR cap NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'Invalid outreach policy'; END IF;
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action FOR UPDATE;
 IF NOT FOUND OR a.status<>'executing' OR a.action_type<>'send_radar_outreach' OR a.approved_by IS NULL OR a.approved_at IS NULL OR a.expires_at IS NULL OR a.expires_at<=now() THEN RAISE EXCEPTION 'Claimed unexpired human approval required'; END IF;
 IF EXISTS(SELECT 1 FROM public.radar_outreach_attempts WHERE tenant_id=t AND action_id=p_action) THEN RETURN jsonb_build_object('reserved',false,'state','existing'); END IF;
 preview:=a.payload->'preview';
 IF a.payload->>'digest' IS NULL OR a.payload->>'digest' !~ '^[a-f0-9]{64}$' OR a.payload->>'digest' IS DISTINCT FROM preview->>'digest' OR preview->'config' IS DISTINCT FROM cfg THEN RAISE EXCEPTION 'Approved content or configuration changed'; END IF;
 SELECT * INTO o FROM public.radar_opportunities WHERE tenant_id=t AND id=(preview->>'opportunityId')::uuid FOR SHARE;
 IF NOT FOUND OR o.revision IS DISTINCT FROM (preview->>'revision')::integer THEN RAISE EXCEPTION 'Opportunity changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.radar_assets WHERE tenant_id=t AND id=(preview->>'assetId')::uuid AND opportunity_id=o.id AND kind='outreach_draft' AND title=preview->>'subject' AND body_text=preview->>'text') THEN RAISE EXCEPTION 'Draft changed'; END IF;
 IF jsonb_typeof(preview->'recipients') IS DISTINCT FROM 'array' OR jsonb_array_length(preview->'recipients') NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Canonical recipients required'; END IF;
 ids:=ARRAY[]::uuid[];
 FOR item IN SELECT value FROM jsonb_array_elements(preview->'recipients') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=(item->>'contactId')::uuid AND communication_status='active' AND lower(primary_email)=item->>'email') THEN RAISE EXCEPTION 'Recipient changed or suppressed'; END IF;
  ids:=array_append(ids,(item->>'contactId')::uuid);
 END LOOP;
 IF cardinality(ids)<>(SELECT count(DISTINCT value) FROM unnest(ids) value) THEN RAISE EXCEPTION 'Distinct recipients required'; END IF;
 IF EXISTS(SELECT 1 FROM public.radar_outreach_attempts WHERE tenant_id=t AND contact_ids && ids AND (state IN ('dispatching','uncertain') OR sent_at>now()-make_interval(hours=>hours))) THEN RAISE EXCEPTION 'Earlier outreach unresolved or within cooldown'; END IF;
 IF (SELECT count(*) FROM public.radar_outreach_attempts WHERE tenant_id=t AND state<>'not_sent' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=cap THEN RAISE EXCEPTION 'Daily Radar outreach limit reached'; END IF;
 -- Include canonical earlier messages from other sending workflows, including CC participants.
 IF EXISTS(SELECT 1 FROM public.messages m JOIN public.conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id WHERE m.tenant_id=t AND m.direction='outbound' AND (m.status IN ('processing','queued') OR m.sent_at>now()-make_interval(hours=>hours)) AND (c.contact_id=ANY(ids) OR EXISTS(SELECT 1 FROM unnest(ids) cid WHERE c.metadata @> jsonb_build_object('association',jsonb_build_object('contract','revenue-os-conversation-association.v1','participants',jsonb_build_array(jsonb_build_object('contact_id',cid::text,'outcome','linked'))))))) THEN RAISE EXCEPTION 'Canonical outbound history is unresolved or within cooldown'; END IF;
 INSERT INTO public.radar_outreach_attempts(tenant_id,action_id,opportunity_id,asset_id,contact_ids,digest,state) VALUES(t,p_action,o.id,(preview->>'assetId')::uuid,ids,a.payload->>'digest','dispatching');
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state) VALUES(t,a.approved_by,'radar.outreach_reserved','radar_opportunity',o.id::text,jsonb_build_object('actionId',p_action,'digest',a.payload->>'digest','contactIds',ids));
 RETURN jsonb_build_object('reserved',true,'state','dispatching');
END $$;
CREATE OR REPLACE FUNCTION public.reconcile_radar_outreach(p_action uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; r public.radar_outreach_attempts%ROWTYPE; m public.messages%ROWTYPE; actor text; next_state text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Host service required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':radar-outreach',0));
 SELECT * INTO r FROM public.radar_outreach_attempts WHERE tenant_id=t AND action_id=p_action FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No outreach dispatch exists'; END IF;
 IF r.state IN ('sent','not_sent') THEN RETURN to_jsonb(r); END IF;
 SELECT * INTO m FROM public.messages WHERE tenant_id=t AND idempotency_key='action:'||p_action::text;
 next_state:=CASE WHEN m.provider_id IS NOT NULL AND m.sent_at IS NOT NULL THEN 'sent' WHEN m.status='failed' AND m.metadata->'dispatch_attempted'='false'::jsonb THEN 'not_sent' ELSE 'uncertain' END;
 UPDATE public.radar_outreach_attempts SET state=next_state,message_id=m.id,provider_id=m.provider_id,sent_at=m.sent_at,updated_at=now() WHERE tenant_id=t AND action_id=p_action RETURNING * INTO r;
 SELECT approved_by INTO actor FROM public.action_queue WHERE tenant_id=t AND id=p_action;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state) VALUES(t,actor,'radar.outreach_'||next_state,'radar_opportunity',r.opportunity_id::text,to_jsonb(r));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.reserve_radar_outreach(uuid),public.reconcile_radar_outreach(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_radar_outreach(uuid),public.reconcile_radar_outreach(uuid) TO service_role;
COMMIT;
