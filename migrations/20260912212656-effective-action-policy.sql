-- Resolve action and capability policy in the existing owning RPC, including
-- callers inside an atomic mutation. Keep the original single-rule semantics
-- (coworker precedence, strict duplicates, approved standing constraints) intact.
-- Invoker reads use existing tenant RLS; no policy mutation privilege is added.
GRANT SELECT ON public.autonomy_policies,public.autonomy_hard_floors TO authenticated,service_role;
CREATE OR REPLACE FUNCTION private.check_autonomy_rule(
  p_action_key TEXT,
  p_coworker_id TEXT DEFAULT NULL
) RETURNS TABLE (
  action_key TEXT,
  allowed BOOLEAN,
  level public.autonomy_level,
  requires_approval BOOLEAN,
  policy_id UUID,
  hard_floor BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_hard_floor BOOLEAN;
  v_policy public.autonomy_policies%ROWTYPE;
  v_found BOOLEAN;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_action_key IS NULL OR btrim(p_action_key) = '' THEN
    RAISE EXCEPTION 'action_key is required';
  END IF;

  -- Step 1: Hard floor check — absolute prohibition regardless of policy.
  SELECT EXISTS (
    SELECT 1 FROM public.autonomy_hard_floors AS f
    WHERE f.tenant_id = v_tenant_id
      AND f.action_key = btrim(p_action_key)
    UNION ALL
    SELECT 1 FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id AND p.action_key = btrim(p_action_key)
      AND p.is_hard_floor AND (p.coworker_id IS NULL OR p.coworker_id = p_coworker_id)
  ) INTO v_is_hard_floor;

  IF v_is_hard_floor OR btrim(p_action_key) = ANY(ARRAY['account.delete','credential.change','financial_history.delete','customer_database.export','refund.high_value','financial_transfer.major']) THEN
    RETURN QUERY
      SELECT
        btrim(p_action_key),
        false,
        'prohibited'::public.autonomy_level,
        true,
        NULL::UUID,
        true,
        'This action is a hard safety floor and cannot be automated (§17)';
    RETURN;
  END IF;

  -- Step 2: Look up coworker-specific policy first.
  IF p_coworker_id IS NOT NULL THEN
    SELECT p.* INTO v_policy FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id
      AND p.action_key = btrim(p_action_key)
      AND p.coworker_id = p_coworker_id
    -- NULL coworker keys historically allowed duplicate generic policies.
    -- Preserve their rows while choosing the strictest effective rule.
    ORDER BY CASE
      WHEN p.level = 'prohibited' THEN 0
      WHEN p.level = 'always_ask' THEN 1
      WHEN p.level = 'ask_until_trusted' THEN 2
      WHEN p.level = 'standing_permission' AND (p.approved_by IS NULL OR p.approved_at IS NULL OR COALESCE(p.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN 1
      WHEN p.level = 'standing_permission' THEN 3
      ELSE 4 END, p.updated_at DESC, p.id
    LIMIT 1;
    v_found := FOUND;
  ELSE
    v_found := false;
  END IF;

  -- Step 3: Fall back to generic (coworker-agnostic) policy.
  IF NOT v_found THEN
    SELECT p.* INTO v_policy FROM public.autonomy_policies AS p
    WHERE p.tenant_id = v_tenant_id
      AND p.action_key = btrim(p_action_key)
      AND p.coworker_id IS NULL
    -- NULL coworker keys historically allowed duplicate generic policies.
    -- Preserve their rows while choosing the strictest effective rule.
    ORDER BY CASE
      WHEN p.level = 'prohibited' THEN 0
      WHEN p.level = 'always_ask' THEN 1
      WHEN p.level = 'ask_until_trusted' THEN 2
      WHEN p.level = 'standing_permission' AND (p.approved_by IS NULL OR p.approved_at IS NULL OR COALESCE(p.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN 1
      WHEN p.level = 'standing_permission' THEN 3
      ELSE 4 END, p.updated_at DESC, p.id
    LIMIT 1;
    v_found := FOUND;
  END IF;

  -- Step 4: No policy → default to always_ask (fail-closed).
  IF NOT v_found THEN
    RETURN QUERY
      SELECT
        btrim(p_action_key),
        false,
        'always_ask'::public.autonomy_level,
        true,
        NULL::UUID,
        false,
        'No policy registered; defaulting to always_ask (fail-closed)';
    RETURN;
  END IF;

  -- A manifest declaration is not human approval. Unknown constraint shapes
  -- cannot become standing permission until an executor understands them.
  IF v_policy.level = 'standing_permission' AND
    (v_policy.approved_by IS NULL OR v_policy.approved_at IS NULL OR COALESCE(v_policy.constraints, '{}'::jsonb) <> '{}'::jsonb) THEN
    RETURN QUERY SELECT btrim(p_action_key), false, 'always_ask'::public.autonomy_level,
      true, v_policy.id, false, 'Standing permission requires human approval and supported constraints'::text;
    RETURN;
  END IF;

  -- Step 5: Resolve based on the policy level.
  RETURN QUERY
    SELECT
      btrim(p_action_key),
      v_policy.level IN ('standing_permission', 'autonomous'),
      v_policy.level,
      v_policy.level IN ('prohibited', 'always_ask', 'ask_until_trusted'),
      v_policy.id,
      false,
      CASE v_policy.level
        WHEN 'prohibited' THEN 'Action is prohibited by policy'
        WHEN 'always_ask' THEN 'Action requires approval every time'
        WHEN 'ask_until_trusted' THEN 'Action requires approval until standing permission is granted'
        WHEN 'standing_permission' THEN 'Standing permission granted within constraints'
        WHEN 'autonomous' THEN 'Action is freely executable (low-risk)'
      END;
END;
$$;

REVOKE ALL ON FUNCTION private.check_autonomy_rule(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.check_autonomy_rule(text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.check_autonomy(p_action_key text,p_coworker_id text DEFAULT NULL)
RETURNS TABLE(action_key text,allowed boolean,level public.autonomy_level,requires_approval boolean,policy_id uuid,hard_floor boolean,reason text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE capability text;
BEGIN
 -- Exact parity with ACTION_CAPABILITIES in autonomy-policy.ts is regression-tested.
 SELECT mapping.capability INTO capability FROM (VALUES
  ('send_radar_outreach','email.send'),
  ('review_radar_relationship','crm.write'),
  ('send_collection_reminder','email.send'),
  ('send_email','email.send'),
  ('send_gmail_reply','email.send'),
  ('activate_campaign','email.send'),
  ('duplicate_campaign','crm.write'),
  ('bulk_tag_contacts','crm.write'),
  ('bulk_suppress_contacts','crm.write'),
  ('bulk_enroll_contacts','crm.write'),
  ('update_conversation_status','crm.write'),
  ('assign_conversation','crm.write'),
  ('link_conversation_record','crm.write'),
  ('transition_opportunity','crm.write'),
  ('update_opportunity_details','crm.write'),
  ('create_opportunity','crm.write'),
  ('update_opportunity_record','crm.write'),
  ('update_opportunity_intake','crm.write'),
  ('reorder_opportunities','crm.write'),
  ('update_next_action','crm.write'),
  ('create_task','tasks.create'),
  ('update_task','tasks.write'),
  ('delete_task','tasks.write'),
  ('create_task_batch','tasks.create'),
  ('identity_review','crm.write'),
  ('create_founder_note','crm.write')
 ) mapping(action_key,capability) WHERE mapping.action_key=btrim(p_action_key);
 IF capability IS NULL THEN
  RETURN QUERY SELECT rule.* FROM private.check_autonomy_rule(p_action_key,p_coworker_id) rule;
  RETURN;
 END IF;
 RETURN QUERY SELECT btrim(p_action_key),rules.allowed,rules.level,rules.requires_approval,rules.policy_id,rules.hard_floor,rules.reason FROM (
  SELECT 0 AS priority,rule.* FROM private.check_autonomy_rule(p_action_key,p_coworker_id) rule
  UNION ALL
  SELECT 1 AS priority,rule.* FROM private.check_autonomy_rule(capability,p_coworker_id) rule
 ) rules ORDER BY (rules.hard_floor OR rules.level='prohibited') DESC,(rules.policy_id IS NOT NULL) DESC,rules.requires_approval DESC,rules.priority LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.check_autonomy(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_autonomy(text,text) TO authenticated,service_role;

-- Preserve the established mutation and inverse; add current authority on undo.
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
  SELECT * INTO policy FROM public.check_autonomy(a.action_type,CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END);
  IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Action restoration prohibited by current policy'; END IF;
  IF a.approved_by IS NULL THEN
   IF NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required for restoration'; END IF;
  ELSIF a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL THEN RAISE EXCEPTION 'Exact approved actor required for restoration'; END IF;
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
  IF a.action_type='create_task' AND a.compensation->>'created'='false' THEN
   NULL; -- A reused task was never this action's effect.
  ELSIF a.action_type='create_task' THEN
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
  v_result:=private.create_task_effect(p_payload||jsonb_build_object('source',coalesce(p_payload->>'source',CASE WHEN a.source_context='operator_ui' THEN 'manual' ELSE 'ai' END),'dedupeKey',coalesce(nullif(p_payload->>'dedupeKey',''),'action:'||p_id::text)),p_actor,jsonb_build_object('actionId',p_id,'authority',CASE WHEN a.approved_by IS NULL THEN 'standing_policy' ELSE 'human_approval' END));
  after_row:=v_result->'task'; target:=(after_row->>'id')::uuid;
  IF (v_result->>'deduplicated')::boolean THEN before_row:=after_row; END IF;
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
 IF a.action_type IN ('update_task','delete_task') THEN
  effect:=CASE WHEN a.action_type='create_task' THEN 'created' WHEN a.action_type='delete_task' THEN 'deleted' WHEN after_row->>'status'='completed' THEN 'completed' WHEN after_row->>'status'='snoozed' THEN 'snoozed' ELSE 'updated' END;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
  VALUES(t,p_actor,'task.'||effect,'task',target::text,before_row,after_row,jsonb_build_object('actionId',p_id));
  INSERT INTO public.activities(tenant_id,activity_type,title,opportunity_id,source,actor_email,external_id,metadata)
  VALUES(t,'task_'||effect,'Task '||effect||': '||coalesce(after_row->>'title',before_row->>'title'),coalesce(after_row->>'opportunity_id',before_row->>'opportunity_id')::uuid,'admin',p_actor,'action:'||p_id::text,jsonb_build_object('task_id',target,'actionId',p_id));
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata)
 VALUES(t,p_actor,'action.executed','action_queue',p_id::text,before_row,after_row,jsonb_build_object('targetId',target,'actionType',a.action_type));
 UPDATE public.action_queue SET status='executed',executed_at=clock_timestamp(),result=v_result,error=NULL,reversibility='reversible',compensation=jsonb_build_object('version',1,'targetId',target,'before',before_row,'after',after_row,'created',CASE WHEN a.action_type='create_task' THEN NOT (v_result->>'deduplicated')::boolean ELSE NULL END) WHERE id=p_id AND tenant_id=t;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.apply_local_action(uuid,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_local_action(uuid,jsonb,text,boolean) TO authenticated,service_role;


-- A completed proposal follow-up is still the original source effect on replay.
CREATE OR REPLACE FUNCTION private.create_task_effect(p_input jsonb,p_actor text,p_provenance jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); task public.tasks%ROWTYPE; source_name text:=coalesce(nullif(p_input->>'source',''),'ai'); effect_key text:=nullif(p_input->>'dedupeKey','');
 parent public.action_queue%ROWTYPE; provenance jsonb; policy record; approved_item jsonb; source_state text;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;
 IF (p_provenance->>'actionId')::uuid IS NOT NULL THEN
  SELECT * INTO parent FROM public.action_queue WHERE id=(p_provenance->>'actionId')::uuid AND tenant_id=t FOR UPDATE;
  IF NOT FOUND OR parent.action_type NOT IN ('create_task','create_task_batch') OR parent.status<>'executing' OR (parent.expires_at IS NOT NULL AND parent.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Current exact parent approval required'; END IF;
  IF current_user<>'service_role' AND (lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active')) THEN RAISE EXCEPTION 'Current workspace administrator required'; END IF;
  SELECT * INTO policy FROM public.check_autonomy(parent.action_type,CASE WHEN parent.proposed_by LIKE 'coworker:%' THEN substring(parent.proposed_by FROM 10) ELSE NULL END);
  IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Parent policy was revoked'; END IF;
  IF parent.approved_by IS NULL THEN
   IF NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required'; END IF;
  ELSIF parent.approved_by IS DISTINCT FROM p_actor OR parent.approved_at IS NULL THEN RAISE EXCEPTION 'A current exact human approval is required'; END IF;
  IF parent.action_type='create_task' THEN
   IF p_input IS DISTINCT FROM parent.payload||jsonb_build_object('source',coalesce(parent.payload->>'source',CASE WHEN parent.source_context='operator_ui' THEN 'manual' ELSE 'ai' END),'dedupeKey',coalesce(nullif(parent.payload->>'dedupeKey',''),'action:'||parent.id::text)) THEN RAISE EXCEPTION 'Task is outside the exact approved action'; END IF;
   provenance:=jsonb_build_object('actionId',parent.id,'authority',CASE WHEN parent.approved_by IS NULL THEN 'standing_policy' ELSE 'human_approval' END);
  ELSE
  IF parent.approved_by IS NULL OR parent.approved_at IS NULL OR parent.expires_at IS NULL OR parent.payload IS DISTINCT FROM p_provenance->'payload' OR nullif(parent.payload#>>'{pluginOrigin,id}','') IS NULL THEN RAISE EXCEPTION 'Current exact parent approval required'; END IF;
  IF parent.payload ? 'opportunityId' THEN
   SELECT stage INTO source_state FROM public.opportunities WHERE tenant_id=t AND id=(parent.payload->>'opportunityId')::uuid FOR SHARE;
  ELSE
   SELECT status INTO source_state FROM public.calendar_events WHERE tenant_id=t AND id=(parent.payload->>'meetingId')::uuid FOR SHARE;
  END IF;
  IF source_state IS NULL OR source_state IS DISTINCT FROM parent.payload->>'expectedState' OR (parent.payload ? 'opportunityId' AND source_state<>'won') OR (parent.payload ? 'meetingId' AND source_state='cancelled') THEN RAISE EXCEPTION 'Parent source changed since approval'; END IF;
  SELECT item INTO approved_item FROM jsonb_array_elements(parent.payload->'tasks') item
   WHERE item->>'title'=p_input->>'title' AND item->>'description' IS NOT DISTINCT FROM p_input->>'description'
    AND item->>'dueDate'=p_input->>'dueDate' AND item->>'assigneeUserId'=p_input->>'assigneeUserId' LIMIT 1;
  IF approved_item IS NULL OR p_input->>'source' IS DISTINCT FROM 'plugin'
    OR p_input->>'opportunityId' IS DISTINCT FROM parent.payload->>'opportunityId'
    OR p_input->>'relatedId' IS DISTINCT FROM coalesce(parent.payload->>'opportunityId',parent.payload->>'meetingId')
    OR p_input->>'relatedType' IS DISTINCT FROM (CASE WHEN parent.payload ? 'opportunityId' THEN 'opportunity' ELSE 'calendar_event' END)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('title','description','dueDate','assigneeUserId','source','dedupeKey','opportunityId','relatedType','relatedId','relatedName')) THEN RAISE EXCEPTION 'Task is outside the exact approved batch'; END IF;
  -- Match the existing workflowTaskEffectKey serialization, preserving old
  -- cross-proposal task identity instead of accepting a caller's fresh key.
  effect_key:='plugin:'||encode(sha256(convert_to(
   '{"pluginId":'||to_json(parent.payload#>>'{pluginOrigin,id}')::text||',"source":'||to_json(coalesce(parent.payload->>'opportunityId',parent.payload->>'meetingId'))::text||',"title":'||coalesce(to_json(approved_item->>'title')::text,'null')||',"description":'||coalesce(to_json(approved_item->>'description')::text,'null')||',"dueDate":'||coalesce(to_json(approved_item->>'dueDate')::text,'null')||',"assigneeUserId":'||coalesce(to_json(approved_item->>'assigneeUserId')::text,'null')||'}','UTF8')),'hex');
  IF p_input->>'dedupeKey' IS DISTINCT FROM effect_key THEN RAISE EXCEPTION 'Task effect key does not match approved work'; END IF;
  provenance:=jsonb_build_object('authority','parent_approval','actionId',parent.id);
  END IF;
 ELSE
  IF current_user<>'service_role' OR nullif(btrim(p_provenance->>'systemSource'),'') IS NULL THEN RAISE EXCEPTION 'Bound tenant system context required'; END IF;
  provenance:=jsonb_build_object('authority','deterministic_system','systemSource',p_provenance->>'systemSource');
 END IF;
 IF jsonb_typeof(p_input->'title') IS DISTINCT FROM 'string' OR nullif(btrim(p_input->>'title'),'') IS NULL OR length(p_input->>'title')>1000 THEN RAISE EXCEPTION 'Task title is required'; END IF;
 IF p_input ? 'description' AND jsonb_typeof(p_input->'description') NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid description'; END IF;
 IF nullif(p_input->>'assigneeUserId','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=(p_input->>'assigneeUserId')::uuid AND status='active') THEN RAISE EXCEPTION 'Task assignee must be an active member of this workspace'; END IF;
 IF effect_key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':task:'||effect_key,0));
  SELECT * INTO task FROM public.tasks WHERE tenant_id=t AND dedupe_key=effect_key
   AND (CASE WHEN source_name IN ('delivery_handoff','proposal_response','plugin','bookings','leads','calendly') THEN source=source_name ELSE status IN ('pending','snoozed') END)
   ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('task',to_jsonb(task),'deduplicated',true); END IF;
 END IF;
 INSERT INTO public.tasks(tenant_id,title,description,assigned_to,due_date,due_time,priority,related_type,related_id,related_name,opportunity_id,source,dedupe_key)
 VALUES(t,btrim(p_input->>'title'),nullif(p_input->>'description',''),nullif(p_input->>'assigneeUserId','')::uuid,nullif(p_input->>'dueDate','')::date,nullif(p_input->>'dueTime','')::time,coalesce(p_input->>'priority','medium'),p_input->>'relatedType',nullif(p_input->>'relatedId','')::uuid,p_input->>'relatedName',nullif(p_input->>'opportunityId','')::uuid,source_name,effect_key) RETURNING * INTO task;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata)
 VALUES(t,p_actor,'task.created','task',task.id::text,to_jsonb(task),provenance||jsonb_build_object('source',source_name,'dedupe_key',effect_key));
 INSERT INTO public.activities(tenant_id,activity_type,title,summary,opportunity_id,source,actor_email,external_id,metadata)
 VALUES(t,'task_created','Task created: '||task.title,task.description,task.opportunity_id,source_name,p_actor,'task:'||task.id::text||':created',provenance||jsonb_build_object('task_id',task.id,'priority',task.priority));
 RETURN jsonb_build_object('task',to_jsonb(task),'deduplicated',false);
END $$;
REVOKE ALL ON FUNCTION private.create_task_effect(jsonb,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.create_task_effect(jsonb,text,jsonb) TO authenticated,service_role;
