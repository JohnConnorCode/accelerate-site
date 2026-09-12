-- Existing pipeline operations share one invoker transaction. Human actions bind
-- exact queue payload; deterministic callers retain their actual service context.
CREATE OR REPLACE FUNCTION public.apply_pipeline_action(p_action_id uuid,p_operation text,p_payload jsonb,p_actor text,p_system_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE;
 old public.opportunities%ROWTYPE; updated public.opportunities%ROWTYPE;
 policy record; provenance jsonb; patch jsonb:='{}'::jsonb; columns_snapshot jsonb;
 from_column jsonb; to_column jsonb; from_key text; to_key text; from_role text; to_role text;
 source_name text; happened timestamptz:=clock_timestamp(); changed boolean:=false;
 aliases jsonb:='{"calendar_viewed":"qualified","booked":"meeting","showed":"meeting","no_show":"nurture"}';
BEGIN
 IF p_operation NOT IN ('transition_opportunity','update_opportunity_details') OR nullif(btrim(p_actor),'') IS NULL THEN RAISE EXCEPTION 'Invalid pipeline operation or actor'; END IF;
 IF p_action_id IS NULL THEN
  IF current_user<>'service_role' OR nullif(btrim(p_system_source),'') IS NULL THEN RAISE EXCEPTION 'Bound tenant system context required' USING ERRCODE='42501'; END IF;
  provenance:=jsonb_build_object('authority','deterministic_system','systemSource',p_system_source);
 ELSE
  IF current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active')) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action_id FOR UPDATE;
  IF NOT FOUND OR a.action_type IS DISTINCT FROM p_operation OR a.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Current exact pipeline approval required'; END IF;
  IF a.status='executed' THEN RETURN jsonb_build_object('opportunity',a.result,'changed',false); END IF;
  IF a.status<>'executing' OR (a.expires_at IS NOT NULL AND a.expires_at<=happened) THEN RAISE EXCEPTION 'Current exact pipeline approval required'; END IF;
  SELECT * INTO policy FROM public.check_autonomy(p_operation,CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END);
  IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Pipeline action prohibited by current policy'; END IF;
  IF a.approved_by IS NULL THEN
   IF NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required'; END IF;
  ELSIF a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL THEN RAISE EXCEPTION 'A current exact human approval is required'; END IF;
  provenance:=jsonb_build_object('actionId',a.id,'authority',CASE WHEN a.approved_by IS NULL THEN 'standing_policy' ELSE 'human_approval' END);
 END IF;
 SELECT * INTO old FROM public.opportunities WHERE tenant_id=t AND id=(p_payload->>'opportunityId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;
 IF to_jsonb(old) IS DISTINCT FROM p_payload->'expectedState' OR (nullif(p_payload->>'expectedUpdatedAt','') IS NOT NULL AND old.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz) THEN RAISE EXCEPTION 'The opportunity changed while you were editing it. Refresh and try again.'; END IF;
 source_name:=coalesce(nullif(p_payload->>'source',''),CASE WHEN p_action_id IS NULL THEN p_system_source WHEN a.source_context='operator_ui' THEN 'admin' ELSE 'ai' END);
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
 ELSE
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
 END IF;
 IF NOT changed THEN updated:=old; END IF;
 IF changed THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,CASE WHEN p_operation='transition_opportunity' THEN 'opportunity.stage_changed' ELSE 'opportunity.updated' END,'opportunity',old.id::text,to_jsonb(old),to_jsonb(updated),provenance||jsonb_build_object('source',source_name,'reason',p_payload->>'reason'));
 END IF;
 IF p_action_id IS NOT NULL THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'action.executed','action_queue',p_action_id::text,to_jsonb(old),to_jsonb(updated),jsonb_build_object('targetId',old.id,'actionType',p_operation,'changed',changed));
  UPDATE public.action_queue SET status='executed',executed_at=happened,result=to_jsonb(updated),error=NULL,reversibility='compensable' WHERE tenant_id=t AND id=p_action_id;
 END IF;
 RETURN jsonb_build_object('opportunity',to_jsonb(updated),'changed',changed,'toRole',to_role);
END $$;
REVOKE ALL ON FUNCTION public.apply_pipeline_action(uuid,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_pipeline_action(uuid,text,jsonb,text,text) TO authenticated,service_role;
