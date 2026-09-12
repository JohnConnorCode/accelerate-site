-- The existing identity resolver is one invoker writer so opportunity creation
-- can include identity, opportunity, activity and receipt in the same transaction.
CREATE OR REPLACE FUNCTION public.resolve_revenue_identity(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); company public.companies%ROWTYPE;
 contact public.contacts%ROWTYPE; matches uuid[]; email text:=nullif(p_input->>'email','');
 identity_domain text:=nullif(p_input->>'domain',''); identity_phone text:=nullif(btrim(p_input->>'phone'),'');
 source_type text:=nullif(p_input->>'sourceRecordType',''); source_id uuid:=nullif(p_input->>'sourceRecordId','')::uuid;
BEGIN
 IF current_user<>'service_role' AND (auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active')) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 -- Serialize this resolver within a tenant: every matching path sees the same
 -- committed identity. Existing tenant unique constraints remain authoritative.
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':canonical-identity',0));
 IF source_type IS NOT NULL AND source_id IS NOT NULL THEN
  SELECT array_agg(id) INTO matches FROM public.companies WHERE tenant_id=t AND source_record_type=source_type AND source_record_id=source_id;
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous company source identity for %:%',source_type,source_id; END IF;
  SELECT * INTO company FROM public.companies WHERE tenant_id=t AND id=matches[1];
 END IF;
 IF company.id IS NULL AND identity_domain IS NOT NULL THEN
  SELECT array_agg(id) INTO matches FROM public.companies WHERE tenant_id=t AND lower(companies.domain)=lower(identity_domain);
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous company identity for %',identity_domain; END IF;
  SELECT * INTO company FROM public.companies WHERE tenant_id=t AND id=matches[1];
 END IF;
 IF company.id IS NULL THEN
  INSERT INTO public.companies(tenant_id,name,domain,website,industry,source,source_record_type,source_record_id)
  VALUES(t,coalesce(nullif(btrim(p_input->>'companyName'),''),identity_domain,btrim(p_input->>'name')||' company'),identity_domain,nullif(p_input->>'website',''),nullif(p_input->>'industry',''),p_input->>'source',source_type,source_id) RETURNING * INTO company;
 END IF;
 IF source_type IS NOT NULL AND source_id IS NOT NULL THEN
  SELECT array_agg(id) INTO matches FROM public.contacts WHERE tenant_id=t AND source_record_type=source_type AND source_record_id=source_id;
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous contact source identity for %:%',source_type,source_id; END IF;
  SELECT * INTO contact FROM public.contacts WHERE tenant_id=t AND id=matches[1];
 END IF;
 IF contact.id IS NULL AND email IS NOT NULL THEN
  SELECT array_agg(id) INTO matches FROM public.contacts WHERE tenant_id=t AND (lower(primary_email)=lower(email) OR alternate_emails @> ARRAY[email]);
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous contact identity for %',email; END IF;
  SELECT * INTO contact FROM public.contacts WHERE tenant_id=t AND id=matches[1];
 END IF;
 IF contact.id IS NULL AND identity_phone IS NOT NULL THEN
  SELECT array_agg(id) INTO matches FROM public.contacts WHERE tenant_id=t AND contacts.phone=identity_phone;
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous contact identity for phone %',identity_phone; END IF;
  SELECT * INTO contact FROM public.contacts WHERE tenant_id=t AND id=matches[1];
 END IF;
 IF contact.id IS NULL THEN
  INSERT INTO public.contacts(tenant_id,full_name,primary_email,phone,company_id,source,source_record_type,source_record_id)
  VALUES(t,btrim(p_input->>'name'),email,nullif(p_input->>'phone',''),company.id,p_input->>'source',source_type,source_id) RETURNING * INTO contact;
 END IF;
 RETURN jsonb_build_object('company',jsonb_build_object('id',company.id,'name',company.name,'domain',company.domain),'contact',jsonb_build_object('id',contact.id,'full_name',contact.full_name,'primary_email',contact.primary_email));
END $$;
REVOKE ALL ON FUNCTION public.resolve_revenue_identity(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_revenue_identity(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.apply_pipeline_action(p_action_id uuid,p_operation text,p_payload jsonb,p_actor text,p_system_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE;
 old public.opportunities%ROWTYPE; updated public.opportunities%ROWTYPE;
 policy record; provenance jsonb; patch jsonb:='{}'::jsonb; columns_snapshot jsonb;
 from_column jsonb; to_column jsonb; from_key text; to_key text; from_role text; to_role text;
 identity jsonb; result_json jsonb; before_json jsonb; item jsonb; locked_rows jsonb; requested_count integer;
 prior_receipt public.audit_log%ROWTYPE; effect_key text; request_input jsonb;
 source_name text; happened timestamptz:=clock_timestamp(); changed boolean:=false;
 aliases jsonb:='{"calendar_viewed":"qualified","booked":"meeting","showed":"meeting","no_show":"nurture"}';
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN ('transition_opportunity','update_opportunity_details','create_opportunity','update_opportunity_record','update_opportunity_intake','reorder_opportunities') OR nullif(btrim(p_actor),'') IS NULL THEN RAISE EXCEPTION 'Invalid pipeline operation or actor'; END IF;
 IF p_action_id IS NULL THEN
  IF current_user<>'service_role' OR (nullif(btrim(p_system_source),'') IS NULL OR length(p_system_source)>200) THEN RAISE EXCEPTION 'Bound tenant system context required' USING ERRCODE='42501'; END IF;
  effect_key:=nullif(btrim(p_payload->>'effectKey'),'');
  IF effect_key IS NULL OR length(effect_key)>500 THEN RAISE EXCEPTION 'Stable pipeline source effect key required'; END IF;
  request_input:=p_payload-'expectedState'-'expectedPipeline';
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':pipeline:'||p_system_source||':'||effect_key,0));
  SELECT * INTO prior_receipt FROM public.audit_log WHERE tenant_id=t AND action='pipeline.system_receipt' AND metadata->>'systemSource'=p_system_source AND metadata->>'effectKey'=effect_key;
  IF FOUND THEN
   IF prior_receipt.metadata->'request' IS DISTINCT FROM request_input OR prior_receipt.metadata->>'operation' IS DISTINCT FROM p_operation OR prior_receipt.actor_email IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Pipeline effect key belongs to different source intent'; END IF;
   RETURN jsonb_build_object(CASE WHEN p_operation='reorder_opportunities' THEN 'result' ELSE 'opportunity' END,prior_receipt.after_state,'changed',false);
  END IF;
  provenance:=jsonb_build_object('authority','deterministic_system','systemSource',p_system_source,'effectKey',effect_key);

 ELSE
  IF current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active')) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action_id FOR UPDATE;
  IF NOT FOUND OR a.action_type IS DISTINCT FROM p_operation OR a.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Current exact pipeline approval required'; END IF;
  IF a.status='executed' THEN RETURN jsonb_build_object(CASE WHEN p_operation='reorder_opportunities' THEN 'result' ELSE 'opportunity' END,a.result,'changed',false); END IF;
  IF a.status<>'executing' OR (a.expires_at IS NOT NULL AND a.expires_at<=happened) THEN RAISE EXCEPTION 'Current exact pipeline approval required'; END IF;
  SELECT * INTO policy FROM public.check_autonomy(p_operation,CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END);
  IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Pipeline action prohibited by current policy'; END IF;
  IF a.approved_by IS NULL THEN
   IF NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required'; END IF;
  ELSIF a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL THEN RAISE EXCEPTION 'A current exact human approval is required'; END IF;
  provenance:=jsonb_build_object('actionId',a.id,'authority',CASE WHEN a.approved_by IS NULL THEN 'standing_policy' ELSE 'human_approval' END);
 END IF;
 source_name:=coalesce(nullif(p_payload->>'source',''),CASE WHEN p_action_id IS NULL THEN p_system_source WHEN a.source_context='operator_ui' THEN 'admin' ELSE 'ai' END);
 IF p_operation='reorder_opportunities' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.column_key),'[]'::jsonb) INTO columns_snapshot FROM (SELECT column_key,label,metadata FROM public.kanban_columns WHERE tenant_id=t AND board_key='pipeline' ORDER BY column_key FOR SHARE) c;
  IF columns_snapshot IS DISTINCT FROM p_payload->'expectedPipeline' THEN RAISE EXCEPTION 'Pipeline stages changed since preview; prepare a new proposal'; END IF;
  IF jsonb_typeof(p_payload->'updates') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'updates') NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Invalid reorder payload'; END IF;
  requested_count:=jsonb_array_length(p_payload->'updates');
  IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_payload->'updates') x)<>requested_count THEN RAISE EXCEPTION 'Duplicate opportunity IDs in reorder'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb) INTO locked_rows FROM (SELECT * FROM public.opportunities WHERE tenant_id=t AND id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_payload->'updates') x) ORDER BY id FOR UPDATE) o;
  IF jsonb_array_length(locked_rows)<>requested_count OR locked_rows IS DISTINCT FROM p_payload->'expectedState' THEN RAISE EXCEPTION 'Opportunities changed or are unavailable; refresh before reordering'; END IF;
  FOR item IN SELECT x FROM jsonb_array_elements(p_payload->'updates') x LOOP
   IF jsonb_typeof(item->'sort_order') IS DISTINCT FROM 'number' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(locked_rows) o WHERE o->>'id'=item->>'id' AND (o->>'stage'=item->>'column_key' OR aliases->>(o->>'stage')=item->>'column_key')) OR NOT EXISTS(SELECT 1 FROM public.kanban_columns WHERE tenant_id=t AND board_key='pipeline' AND column_key=item->>'column_key') THEN RAISE EXCEPTION 'Reorder requires unchanged valid stages and finite positions'; END IF;
  END LOOP;
  UPDATE public.opportunities o SET sort_order=x.sort_order FROM jsonb_to_recordset(p_payload->'updates') x(id uuid,sort_order numeric) WHERE o.tenant_id=t AND o.id=x.id;
  SELECT jsonb_build_object('affected',requested_count,'opportunities',jsonb_agg(to_jsonb(o) ORDER BY o.id)) INTO result_json FROM public.opportunities o WHERE tenant_id=t AND id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_payload->'updates') x);
  before_json:=locked_rows; changed:=true;
 ELSIF p_operation='create_opportunity' THEN
  patch:=p_payload->'record';
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('name','email','estimated_value','next_action','next_action_at','source','source_detail','source_record_type','source_record_id','contact_id','company_id','metadata','utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer','landing_page','company_website','role','revenue_band','primary_leak','qualified','qualification_reason','qualifier_token','message_variant')) THEN RAISE EXCEPTION 'Invalid opportunity creation fields'; END IF;
  IF nullif(patch->>'source_record_type','') IS NOT NULL AND nullif(patch->>'source_record_id','') IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':opportunity-source:'||(patch->>'source_record_type')||':'||(patch->>'source_record_id'),0));
   SELECT * INTO updated FROM public.opportunities WHERE tenant_id=t AND source_record_type=patch->>'source_record_type' AND source_record_id=(patch->>'source_record_id')::uuid FOR UPDATE;
   -- Canonical source identity is permanent, like task dedupe: reusing it
   -- returns the current record and never rewrites a later human correction.
  END IF;
  IF updated.id IS NULL THEN
  IF p_payload ? 'identity' THEN
   identity:=public.resolve_revenue_identity(p_payload->'identity');
   patch:=patch||jsonb_build_object('contact_id',identity#>>'{contact,id}','company_id',identity#>>'{company,id}','name',coalesce(nullif(btrim(patch->>'name'),''),identity#>>'{company,name}'));
  END IF;
  IF nullif(patch->>'contact_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=(patch->>'contact_id')::uuid) THEN RAISE EXCEPTION 'Contact is unavailable'; END IF;
  IF nullif(patch->>'company_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE tenant_id=t AND id=(patch->>'company_id')::uuid) THEN RAISE EXCEPTION 'Company is unavailable'; END IF;
  IF p_payload ? 'nextActionDelayHours' THEN
   IF p_payload->>'nextActionDelayHours'<>'24' THEN RAISE EXCEPTION 'Invalid next action delay'; END IF;
   patch:=patch||jsonb_build_object('next_action_at',happened+interval '24 hours');
  END IF;
  updated:=jsonb_populate_record(NULL::public.opportunities,patch);
  INSERT INTO public.opportunities(tenant_id,name,email,contact_id,company_id,stage,pipeline,probability,source,source_detail,source_record_type,source_record_id,estimated_value,next_action,next_action_at,owner_email,metadata,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referrer,landing_page,company_website,role,revenue_band,primary_leak,qualified,qualification_reason,qualifier_token,message_variant)
  VALUES(t,updated.name,updated.email,updated.contact_id,updated.company_id,'new','sales',10,coalesce(updated.source,source_name),updated.source_detail,updated.source_record_type,updated.source_record_id,greatest(0,coalesce(updated.estimated_value,0)),updated.next_action,updated.next_action_at,CASE WHEN p_payload ? 'identity' THEN p_actor ELSE NULL END,coalesce(updated.metadata,'{}'::jsonb),updated.utm_source,updated.utm_medium,updated.utm_campaign,updated.utm_content,updated.utm_term,updated.referrer,updated.landing_page,updated.company_website,updated.role,updated.revenue_band,updated.primary_leak,coalesce(updated.qualified,false),updated.qualification_reason,updated.qualifier_token,updated.message_variant) RETURNING * INTO updated;
  changed:=true;
  INSERT INTO public.stage_events(tenant_id,opportunity_id,from_stage,to_stage,source,actor_email,reason,metadata) VALUES(t,updated.id,NULL,'new',coalesce(updated.source,source_name),p_actor,'Opportunity created',provenance);
  INSERT INTO public.activities(tenant_id,activity_type,title,opportunity_id,contact_id,company_id,source,actor_email,external_id,metadata,occurred_at) VALUES(t,'opportunity_created',CASE WHEN updated.source='hubspot_import' THEN 'Opportunity created from HubSpot: ' ELSE 'Opportunity created: ' END||coalesce(updated.name,''),updated.id,updated.contact_id,updated.company_id,coalesce(updated.source,source_name),p_actor,CASE WHEN updated.source='hubspot_import' AND nullif(updated.metadata->>'hubspot_deal_id','') IS NOT NULL THEN 'hubspot:deal:'||(updated.metadata->>'hubspot_deal_id') ELSE 'opportunity:'||updated.id::text||':created' END,provenance||jsonb_build_object('stage','new','estimated_value',updated.estimated_value)||CASE WHEN updated.source='hubspot_import' THEN jsonb_build_object('hubspot_deal_id',updated.metadata->'hubspot_deal_id') ELSE '{}'::jsonb END,happened);
  END IF;
 ELSE
 SELECT * INTO old FROM public.opportunities WHERE tenant_id=t AND id=(p_payload->>'opportunityId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;
 IF to_jsonb(old) IS DISTINCT FROM p_payload->'expectedState' OR (nullif(p_payload->>'expectedUpdatedAt','') IS NOT NULL AND old.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz) THEN RAISE EXCEPTION 'The opportunity changed while you were editing it. Refresh and try again.'; END IF;
 IF p_operation='transition_opportunity' THEN
  IF p_action_id IS NOT NULL AND a.source_context IS DISTINCT FROM 'operator_ui' AND old.stage=p_payload->>'stage' THEN RAISE EXCEPTION 'Opportunity is already in stage %',old.stage; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.column_key),'[]'::jsonb) INTO columns_snapshot FROM (SELECT column_key,label,metadata FROM public.kanban_columns WHERE tenant_id=t AND board_key='pipeline' ORDER BY column_key FOR SHARE) c;
  IF columns_snapshot IS DISTINCT FROM p_payload->'expectedPipeline' THEN RAISE EXCEPTION 'Pipeline stages changed since preview; prepare a new proposal'; END IF;
  SELECT c INTO from_column FROM jsonb_array_elements(columns_snapshot) c WHERE c->>'column_key'=old.stage;
  IF from_column IS NULL THEN SELECT c INTO from_column FROM jsonb_array_elements(columns_snapshot) c WHERE c->>'column_key'=aliases->>old.stage; END IF;
  SELECT c INTO to_column FROM jsonb_array_elements(columns_snapshot) c WHERE c->>'column_key'=p_payload->>'stage';
  IF to_column IS NULL THEN SELECT c INTO to_column FROM jsonb_array_elements(columns_snapshot) c WHERE c->>'column_key'=aliases->>(p_payload->>'stage'); END IF;
  IF from_column IS NULL THEN RAISE EXCEPTION 'Invalid pipeline stage: %',old.stage; END IF;
  IF to_column IS NULL THEN RAISE EXCEPTION 'Cannot move an opportunity to unknown stage %',p_payload->>'stage'; END IF;
  from_key:=from_column->>'column_key'; to_key:=to_column->>'column_key';
  from_role:=CASE WHEN from_column#>>'{metadata,role}' IN ('won','lost') THEN from_column#>>'{metadata,role}' ELSE 'open' END;
  to_role:=CASE WHEN to_column#>>'{metadata,role}' IN ('won','lost') THEN to_column#>>'{metadata,role}' ELSE 'open' END;
  IF p_payload ? 'expectedStage' AND old.stage IS DISTINCT FROM p_payload->>'expectedStage' THEN RAISE EXCEPTION 'Underlying opportunity state changed since proposal'; END IF;
  IF from_role<>'open' AND from_role<>to_role AND from_key<>to_key THEN
   IF coalesce(p_payload->>'allowTerminalReopen','false')<>'true' THEN RAISE EXCEPTION 'Reopen policy for terminal-stage opportunities is disabled for %->%.',from_key,to_key; END IF;
   IF nullif(btrim(p_payload->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'A reason is required to reopen % opportunities.',from_key; END IF;
  END IF;
  IF to_role='lost' AND nullif(btrim(p_payload->>'lossReason'),'') IS NULL THEN RAISE EXCEPTION 'A loss reason is required when closing an opportunity as lost'; END IF;
  IF p_payload ? 'sortOrder' AND jsonb_typeof(p_payload->'sortOrder')<>'number' THEN RAISE EXCEPTION 'Invalid opportunity sort order'; END IF;
  -- Repeated source events do not add another stage event or reset close time.
  IF old.stage IS DISTINCT FROM to_key OR (p_payload ? 'sortOrder' AND old.sort_order IS DISTINCT FROM (p_payload->>'sortOrder')::numeric) THEN
   UPDATE public.opportunities SET stage=to_key,
    probability=CASE WHEN jsonb_typeof(to_column#>'{metadata,probability}')='number' THEN (to_column#>>'{metadata,probability}')::numeric ELSE 0 END,
    last_activity_at=happened,closed_at=CASE WHEN to_role<>'open' THEN happened ELSE NULL END,
    loss_reason=CASE WHEN to_role='lost' THEN btrim(p_payload->>'lossReason') ELSE NULL END,
    won_value=CASE WHEN to_role='won' AND coalesce(old.won_value,0)=0 THEN coalesce(old.estimated_value,0) ELSE old.won_value END,
    sort_order=CASE WHEN p_payload ? 'sortOrder' THEN (p_payload->>'sortOrder')::numeric ELSE old.sort_order END
    WHERE id=old.id AND tenant_id=t RETURNING * INTO updated;
   changed:=true;
   INSERT INTO public.stage_events(tenant_id,opportunity_id,from_stage,to_stage,source,actor_email,reason,metadata)
   VALUES(t,old.id,old.stage,to_key,source_name,p_actor,p_payload->>'reason',provenance||jsonb_build_object('loss_reason',p_payload->>'lossReason'));
   INSERT INTO public.activities(tenant_id,activity_type,title,summary,opportunity_id,source,actor_email,external_id,metadata,occurred_at)
   VALUES(t,'opportunity_stage_changed','Opportunity moved to '||(to_column->>'label'),nullif(btrim(p_payload->>'reason'),''),old.id,source_name,p_actor,'opportunity:'||old.id::text||':stage:'||from_key||':'||to_key||':'||happened::text,provenance||jsonb_build_object('from_stage',from_key,'to_stage',to_key,'loss_reason',p_payload->>'lossReason'),happened);
  END IF;
 ELSIF p_operation='update_opportunity_details' THEN
  patch:=p_payload->'patch';
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('next_action','next_action_at','estimated_value')) THEN RAISE EXCEPTION 'No valid updates supplied'; END IF;
  IF patch ? 'next_action' AND (jsonb_typeof(patch->'next_action') NOT IN ('string','null') OR length(patch->>'next_action')>500) THEN RAISE EXCEPTION 'Next action is limited to 500 characters'; END IF;
  IF patch ? 'next_action_at' AND jsonb_typeof(patch->'next_action_at') NOT IN ('string','null') THEN RAISE EXCEPTION 'Next action time is invalid'; END IF;
  IF patch ? 'estimated_value' AND (jsonb_typeof(patch->'estimated_value') IS DISTINCT FROM 'number' OR (patch->>'estimated_value')::numeric<0 OR (patch->>'estimated_value')::numeric>1000000000) THEN RAISE EXCEPTION 'Estimated value must be between 0 and 1,000,000,000'; END IF;
  updated:=jsonb_populate_record(old,patch);
  IF (old.next_action,old.next_action_at,old.estimated_value) IS DISTINCT FROM (updated.next_action,updated.next_action_at,updated.estimated_value) THEN
   UPDATE public.opportunities SET next_action=nullif(btrim(updated.next_action),''),next_action_at=updated.next_action_at,estimated_value=updated.estimated_value WHERE id=old.id AND tenant_id=t RETURNING * INTO updated;
   changed:=true;
  END IF;
 ELSE
  IF p_payload ? 'expectedCalendlyInviteeUri' AND old.calendly_invitee_uri IS DISTINCT FROM p_payload->>'expectedCalendlyInviteeUri' THEN RAISE EXCEPTION 'The booking changed before cancellation; refresh before retrying'; END IF;
  patch:=p_payload->'patch';
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('estimated_value','won_value','showed_at','calendly_invitee_uri','calendly_event_uri','scheduled_at','booked_at','canceled_at','utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer','landing_page','company_website','role','revenue_band','primary_leak','qualified','qualification_reason','qualifier_token','message_variant','next_action','next_action_at') AND NOT(p_operation='update_opportunity_intake' AND k IN ('email','contact_id','company_id','source','source_detail'))) THEN RAISE EXCEPTION 'Invalid opportunity record fields'; END IF;
  IF p_payload ? 'fillMissing' THEN
   IF jsonb_typeof(p_payload->'fillMissing') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload->'fillMissing') k WHERE k NOT IN ('next_action','next_action_at','onlyWhenActionMissing')) THEN RAISE EXCEPTION 'Invalid intake defaults'; END IF;
   IF coalesce(p_payload#>>'{fillMissing,onlyWhenActionMissing}','false') NOT IN ('true','false') THEN RAISE EXCEPTION 'Invalid intake scheduling mode'; END IF;
   IF coalesce(p_payload#>>'{fillMissing,onlyWhenActionMissing}','false')='false' OR nullif(old.next_action,'') IS NULL THEN
   IF nullif(old.next_action,'') IS NULL AND p_payload->'fillMissing' ? 'next_action' THEN patch:=patch||jsonb_build_object('next_action',p_payload#>'{fillMissing,next_action}'); END IF;
   IF (old.next_action_at IS NULL OR p_payload#>>'{fillMissing,onlyWhenActionMissing}'='true') AND p_payload->'fillMissing' ? 'next_action_at' THEN patch:=patch||jsonb_build_object('next_action_at',p_payload#>'{fillMissing,next_action_at}'); END IF;
   END IF;
  END IF;
  updated:=jsonb_populate_record(old,patch);
  IF updated.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=updated.contact_id) THEN RAISE EXCEPTION 'Contact is unavailable'; END IF;
  IF updated.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE tenant_id=t AND id=updated.company_id) THEN RAISE EXCEPTION 'Company is unavailable'; END IF;
  IF updated.estimated_value<0 OR updated.won_value<0 THEN RAISE EXCEPTION 'Opportunity values cannot be negative'; END IF;
  UPDATE public.opportunities SET email=updated.email,contact_id=updated.contact_id,company_id=updated.company_id,source=updated.source,source_detail=updated.source_detail,estimated_value=updated.estimated_value,won_value=updated.won_value,showed_at=updated.showed_at,calendly_invitee_uri=updated.calendly_invitee_uri,calendly_event_uri=updated.calendly_event_uri,scheduled_at=updated.scheduled_at,booked_at=updated.booked_at,canceled_at=updated.canceled_at,utm_source=updated.utm_source,utm_medium=updated.utm_medium,utm_campaign=updated.utm_campaign,utm_content=updated.utm_content,utm_term=updated.utm_term,referrer=updated.referrer,landing_page=updated.landing_page,company_website=updated.company_website,role=updated.role,revenue_band=updated.revenue_band,primary_leak=updated.primary_leak,qualified=updated.qualified,qualification_reason=updated.qualification_reason,qualifier_token=updated.qualifier_token,message_variant=updated.message_variant,next_action=updated.next_action,next_action_at=updated.next_action_at WHERE id=old.id AND tenant_id=t RETURNING * INTO updated;
  changed:=to_jsonb(old) IS DISTINCT FROM to_jsonb(updated);
 END IF;
 IF NOT changed THEN updated:=old; END IF;
 END IF;
 result_json:=coalesce(result_json,to_jsonb(updated)); before_json:=coalesce(before_json,to_jsonb(old));
 IF changed THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,CASE p_operation WHEN 'transition_opportunity' THEN 'opportunity.stage_changed' WHEN 'create_opportunity' THEN 'opportunity.created' WHEN 'reorder_opportunities' THEN 'opportunity.reordered' ELSE 'opportunity.updated' END,'opportunity',coalesce(updated.id::text,old.id::text,'pipeline'),before_json,result_json,provenance||jsonb_build_object('source',source_name,'reason',p_payload->>'reason'));
 END IF;
 IF p_action_id IS NULL THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'pipeline.system_receipt','opportunity',coalesce(updated.id::text,old.id::text,'pipeline'),before_json,result_json,provenance||jsonb_build_object('operation',p_operation,'request',request_input,'changed',changed));
 END IF;
 IF p_action_id IS NOT NULL THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'action.executed','action_queue',p_action_id::text,before_json,result_json,jsonb_build_object('targetId',old.id,'actionType',p_operation,'changed',changed));
  UPDATE public.action_queue SET status='executed',executed_at=happened,result=result_json,error=NULL,reversibility='compensable' WHERE tenant_id=t AND id=p_action_id;
 END IF;
 RETURN jsonb_build_object(CASE WHEN p_operation='reorder_opportunities' THEN 'result' ELSE 'opportunity' END,result_json,'changed',changed,'toRole',to_role);
END $$;
REVOKE ALL ON FUNCTION public.apply_pipeline_action(uuid,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_pipeline_action(uuid,text,jsonb,text,text) TO authenticated,service_role;

-- Preserve content/features behavior; retire only the pipeline bypass.
CREATE OR REPLACE FUNCTION public.reorder_kanban_items(p_board_key TEXT, p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER := 0;
  requested_tenant UUID;
BEGIN
  IF p_board_key IS NULL OR btrim(p_board_key) = '' THEN
    RAISE EXCEPTION 'board_key is required';
  END IF;

  IF p_board_key = 'features' THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'features board requires service-role access' USING ERRCODE = '42501';
    END IF;

    WITH requested AS (
      SELECT x.id, x.column_key, x.sort_order
      FROM jsonb_to_recordset(p_updates) AS x(id UUID, column_key TEXT, sort_order NUMERIC)
      WHERE x.column_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kanban_columns kc
        WHERE kc.board_key = 'features' AND kc.tenant_id IS NULL AND kc.column_key = x.column_key
      )
    )
    UPDATE public.feature_requests AS item
    SET status = requested.column_key, sort_order = requested.sort_order, updated_at = now()
    FROM requested
    WHERE item.id = requested.id AND item.archived_at IS NULL;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  requested_tenant := private.authorized_request_tenant_id();

  IF p_board_key = 'content' THEN
    WITH requested AS (
      SELECT x.id, x.column_key, x.sort_order
      FROM jsonb_to_recordset(p_updates) AS x(id UUID, column_key TEXT, sort_order NUMERIC)
      WHERE x.column_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kanban_columns kc
        WHERE kc.board_key = 'content' AND kc.tenant_id = requested_tenant AND kc.column_key = x.column_key
      )
    )
    UPDATE public.content_calendar AS item
    SET status = requested.column_key, sort_order = requested.sort_order, updated_at = now()
    FROM requested
    WHERE item.id = requested.id AND item.tenant_id = requested_tenant;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  IF p_board_key = 'pipeline' THEN
    RAISE EXCEPTION 'Pipeline reorder requires the canonical approved pipeline action' USING ERRCODE='42501';
  END IF;

  RAISE EXCEPTION 'Unknown board_key: %', p_board_key;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_kanban_items(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_kanban_items(TEXT, JSONB) TO authenticated, service_role;
