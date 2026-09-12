-- Local reversible actions stay in action_queue. The mutation, inverse and terminal
-- receipt share one transaction; undo is fenced by the captured post-state.
CREATE OR REPLACE FUNCTION public.apply_local_action(p_id uuid, p_payload jsonb, p_actor text, p_undo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 t uuid := private.authorized_request_tenant_id();
 a public.action_queue%ROWTYPE; task public.tasks%ROWTYPE;
 before_row jsonb; after_row jsonb; patch jsonb := '{}'::jsonb;
 target uuid; policy record; v_result jsonb; k text; effect text; old public.tasks%ROWTYPE;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;
 IF current_user <> 'service_role' AND (auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'
 ) OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email')) THEN
  RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM public.action_queue WHERE id=p_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR a.action_type NOT IN ('create_task','update_task','delete_task','update_next_action') THEN RAISE EXCEPTION 'Local action unavailable'; END IF;
 IF a.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Approval payload changed; review again'; END IF;
 IF p_undo THEN
  IF a.status<>'executed' OR a.reversibility IS DISTINCT FROM 'reversible' OR a.compensation->>'version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'No verified executed inverse available'; END IF;
  IF a.compensation ? 'receipt' THEN RETURN a.compensation->'receipt'; END IF;
  target := (a.compensation->>'targetId')::uuid;
  IF a.action_type='update_next_action' THEN
   SELECT to_jsonb(o) INTO after_row FROM public.opportunities o WHERE id=target AND tenant_id=t FOR UPDATE;
  ELSE
   SELECT to_jsonb(s) INTO after_row FROM public.tasks s WHERE id=target AND tenant_id=t FOR UPDATE;
  END IF;
  IF coalesce(after_row,'null'::jsonb) IS DISTINCT FROM a.compensation->'after' THEN RAISE EXCEPTION 'Record changed since execution; prepare a new restorative action'; END IF;
  before_row := a.compensation->'before';
  IF a.action_type='create_task' THEN
   DELETE FROM public.tasks WHERE id=target AND tenant_id=t;
  ELSIF a.action_type='delete_task' THEN
   -- No incoming task foreign keys exist in the catalog. Revalidate at runtime
   -- so a future cascade cannot silently make this inverse incomplete.
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE contype='f' AND confrelid='public.tasks'::regclass) THEN RAISE EXCEPTION 'Task dependencies require reviewed restoration'; END IF;
   INSERT INTO public.tasks SELECT (jsonb_populate_record(NULL::public.tasks,before_row)).*;
  ELSIF a.action_type='update_task' THEN
   old := jsonb_populate_record(NULL::public.tasks,before_row);
   UPDATE public.tasks SET title=old.title,description=old.description,priority=old.priority,due_date=old.due_date,status=old.status,snoozed_until=old.snoozed_until,completed_at=old.completed_at WHERE id=target AND tenant_id=t;
  ELSE
   UPDATE public.opportunities SET next_action=before_row->>'next_action',next_action_at=(before_row->>'next_action_at')::timestamptz WHERE id=target AND tenant_id=t;
  END IF;
  IF a.action_type='update_next_action' THEN
   SELECT to_jsonb(o) INTO before_row FROM public.opportunities o WHERE id=target AND tenant_id=t;
  ELSE
   SELECT to_jsonb(s) INTO before_row FROM public.tasks s WHERE id=target AND tenant_id=t;
  END IF;
  v_result := jsonb_build_object('undone',a.action_type,'detail',jsonb_build_object('targetId',target));
  UPDATE public.action_queue SET compensation=compensation||jsonb_build_object('receipt',v_result) WHERE id=p_id AND tenant_id=t;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'action.compensated','action_queue',p_id::text,after_row,before_row,jsonb_build_object('targetId',target));
  RETURN v_result;
 END IF;
 IF a.status<>'executing' OR (a.expires_at IS NOT NULL AND a.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'A current exact approval is required'; END IF;
 SELECT * INTO policy FROM public.check_autonomy(a.action_type,CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END);
 IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Action prohibited by current policy'; END IF;
 IF a.approved_by IS NULL THEN
  IF NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required'; END IF;
 ELSIF a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL THEN RAISE EXCEPTION 'A current exact human approval is required'; END IF;
 IF a.action_type='create_task' THEN
  IF p_payload ? 'description' AND jsonb_typeof(p_payload->'description') NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid description'; END IF;
  IF jsonb_typeof(p_payload->'title') IS DISTINCT FROM 'string' OR length(p_payload->>'title')>1000 OR nullif(btrim(p_payload->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Task title required'; END IF;
  -- A pre-existing deduped task is not a created effect and must never be
  -- offered for deletion by this action's inverse.
  IF nullif(p_payload->>'dedupeKey','') IS NOT NULL AND EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=t AND dedupe_key=p_payload->>'dedupeKey' AND status<>'completed') THEN RAISE EXCEPTION 'Task already exists; no new effect was applied'; END IF;
  target := gen_random_uuid();
  INSERT INTO public.tasks(id,tenant_id,title,description,due_date,due_time,priority,related_type,related_id,related_name,opportunity_id,source,dedupe_key)
  VALUES(target,t,btrim(p_payload->>'title'),p_payload->>'description',nullif(p_payload->>'dueDate','')::date,nullif(p_payload->>'dueTime','')::time,coalesce(p_payload->>'priority','medium'),p_payload->>'relatedType',nullif(p_payload->>'relatedId','')::uuid,p_payload->>'relatedName',nullif(p_payload->>'opportunityId','')::uuid,CASE WHEN a.source_context='operator_ui' THEN 'manual' ELSE 'ai' END,coalesce(nullif(p_payload->>'dedupeKey',''),'action:'||p_id::text)) RETURNING to_jsonb(tasks) INTO after_row;
  v_result := jsonb_build_object('task',after_row,'deduplicated',false);
 ELSE
  target := coalesce(p_payload->>'taskId',p_payload->>'opportunityId')::uuid;
  IF a.action_type='update_next_action' THEN
   SELECT to_jsonb(o) INTO before_row FROM public.opportunities o WHERE id=target AND tenant_id=t FOR UPDATE;
  ELSE
   SELECT * INTO task FROM public.tasks WHERE id=target AND tenant_id=t FOR UPDATE;
   IF FOUND THEN before_row:=to_jsonb(task); END IF;
  END IF;
  IF before_row IS NULL THEN RAISE EXCEPTION 'Target record unavailable'; END IF;
  IF before_row IS DISTINCT FROM p_payload->'expectedState' THEN RAISE EXCEPTION 'Record changed since proposal; review again'; END IF;
  IF a.action_type='delete_task' THEN
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE contype='f' AND confrelid='public.tasks'::regclass) THEN RAISE EXCEPTION 'Task dependencies require reviewed deletion'; END IF;
   DELETE FROM public.tasks WHERE id=target AND tenant_id=t;
   v_result:=jsonb_build_object('deleted',target);
  ELSIF a.action_type='update_next_action' THEN
   IF nullif(btrim(p_payload->>'nextAction'),'') IS NULL THEN RAISE EXCEPTION 'Next action required'; END IF;
   UPDATE public.opportunities SET next_action=btrim(p_payload->>'nextAction'),next_action_at=nullif(p_payload->>'nextActionAt','')::timestamptz WHERE id=target AND tenant_id=t RETURNING to_jsonb(opportunities) INTO after_row;
   v_result:=after_row;
  ELSE
   IF p_payload->>'changeType'='patch' THEN patch:=p_payload->'patch';
   ELSIF p_payload->>'changeType'='complete' THEN patch:=jsonb_build_object('status','completed');
   ELSIF p_payload->>'changeType'='snooze' THEN patch:=jsonb_build_object('snoozed_until',p_payload->>'until');
   ELSIF p_payload->>'changeType'='edit' THEN
    FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
     IF k IN ('title','description','priority') THEN patch:=patch||jsonb_build_object(k,p_payload->k); END IF;
     IF k='dueDate' THEN patch:=patch||jsonb_build_object('due_date',p_payload->k); END IF;
    END LOOP;
   ELSE RAISE EXCEPTION 'Invalid task change'; END IF;
   IF jsonb_typeof(patch)<>'object' OR patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) x WHERE x NOT IN ('title','description','priority','due_date','status','snoozed_until')) THEN RAISE EXCEPTION 'Invalid task patch'; END IF;
   IF patch ? 'description' AND jsonb_typeof(patch->'description') NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid description'; END IF;
   IF (patch ? 'title' AND nullif(btrim(patch->>'title'),'') IS NULL) OR (patch ? 'priority' AND coalesce(patch->>'priority','') NOT IN ('high','medium','low')) OR (patch ? 'status' AND coalesce(patch->>'status','') NOT IN ('pending','completed','snoozed')) THEN RAISE EXCEPTION 'Invalid task fields'; END IF;
   IF (p_payload->>'changeType'<>'patch' OR p_payload->>'requireOpen'='true') AND task.status NOT IN ('pending','snoozed') THEN RAISE EXCEPTION 'Task no longer open'; END IF;
   IF patch->>'status'='completed' THEN patch:=patch||jsonb_build_object('completed_at',coalesce(task.completed_at,clock_timestamp()),'snoozed_until',null); END IF;
   IF patch->>'status'='pending' THEN patch:=patch||jsonb_build_object('completed_at',null,'snoozed_until',null); END IF;
   IF nullif(patch->>'snoozed_until','') IS NOT NULL THEN
    IF (patch->>'snoozed_until')::date<=current_date THEN RAISE EXCEPTION 'Snooze date must be after today'; END IF;
    patch:=patch||jsonb_build_object('status','snoozed','completed_at',null);
   END IF;
   old:=jsonb_populate_record(task,patch);
   IF old.status='snoozed' AND old.snoozed_until IS NULL THEN RAISE EXCEPTION 'Snooze date required'; END IF;
   UPDATE public.tasks SET title=btrim(old.title),description=old.description,priority=old.priority,due_date=old.due_date,status=old.status,snoozed_until=old.snoozed_until,completed_at=old.completed_at WHERE id=target AND tenant_id=t RETURNING to_jsonb(tasks) INTO after_row;
   v_result:=after_row;
  END IF;
 END IF;
 IF a.action_type IN ('create_task','update_task','delete_task') THEN
  effect:=CASE WHEN a.action_type='create_task' THEN 'created' WHEN a.action_type='delete_task' THEN 'deleted' WHEN after_row->>'status'='completed' THEN 'completed' WHEN after_row->>'status'='snoozed' THEN 'snoozed' ELSE 'updated' END;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'task.'||effect,'task',target::text,before_row,after_row,jsonb_build_object('actionId',p_id));
  INSERT INTO public.activities(tenant_id,activity_type,title,opportunity_id,source,actor_email,external_id,metadata)
  VALUES(t,'task_'||effect,'Task '||effect||': '||coalesce(after_row->>'title',before_row->>'title'),coalesce(after_row->>'opportunity_id',before_row->>'opportunity_id')::uuid,'admin',p_actor,'action:'||p_id::text,jsonb_build_object('task_id',target,'actionId',p_id));
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
 VALUES(t,p_actor,'action.executed','action_queue',p_id::text,before_row,after_row,jsonb_build_object('targetId',target,'actionType',a.action_type));
 UPDATE public.action_queue SET status='executed',executed_at=clock_timestamp(),result=v_result,error=NULL,reversibility='reversible',compensation=jsonb_build_object('version',1,'targetId',target,'before',before_row,'after',after_row) WHERE id=p_id AND tenant_id=t;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.apply_local_action(uuid,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_local_action(uuid,jsonb,text,boolean) TO authenticated,service_role;
