-- Qualify output-column names in the shared autonomy function. Native PostgreSQL
-- otherwise treats action_key as both an OUT parameter and a table column.
CREATE OR REPLACE FUNCTION public.check_autonomy(
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
SECURITY DEFINER
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
    SELECT 1 FROM public.autonomy_hard_floors AS floor
    WHERE floor.tenant_id = v_tenant_id
      AND floor.action_key = btrim(p_action_key)
  ) INTO v_is_hard_floor;

  IF v_is_hard_floor THEN
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
    SELECT policy.* INTO v_policy FROM public.autonomy_policies AS policy
    WHERE policy.tenant_id = v_tenant_id
      AND policy.action_key = btrim(p_action_key)
      AND policy.coworker_id = p_coworker_id
    LIMIT 1;
    v_found := FOUND;
  ELSE
    v_found := false;
  END IF;

  -- Step 3: Fall back to generic (coworker-agnostic) policy.
  IF NOT v_found THEN
    SELECT policy.* INTO v_policy FROM public.autonomy_policies AS policy
    WHERE policy.tenant_id = v_tenant_id
      AND policy.action_key = btrim(p_action_key)
      AND policy.coworker_id IS NULL
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

-- Durable conversational plans and bounded, human-established internal permissions.
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS agent_plan jsonb;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS agent_plan_revision integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS work_agent_request ON public.work_items(tenant_id,dedupe_key) WHERE kind='agent_work';
DROP POLICY IF EXISTS "Tenant member access" ON public.work_items;
CREATE POLICY "Tenant member access" ON public.work_items FOR ALL TO authenticated
 USING (tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)
   AND (kind<>'agent_work' OR agent_plan->>'requesterId'=auth.uid()::text))
 WITH CHECK (tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)
   AND (kind<>'agent_work' OR agent_plan->>'requesterId'=auth.uid()::text));

CREATE TABLE IF NOT EXISTS public.internal_action_reservations (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 policy_id uuid NOT NULL,
 action_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,policy_id,action_id)
);
ALTER TABLE public.internal_action_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_action_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.internal_action_reservations TO authenticated;
GRANT ALL ON public.internal_action_reservations TO service_role;
DROP POLICY IF EXISTS "Tenant reservation receipts" ON public.internal_action_reservations;
CREATE POLICY "Tenant reservation receipts" ON public.internal_action_reservations FOR SELECT TO authenticated
 USING (tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
CREATE INDEX IF NOT EXISTS internal_action_daily ON public.internal_action_reservations(tenant_id,policy_id,reserved_at);

CREATE OR REPLACE FUNCTION public.execute_internal_permission(p_action_id uuid,p_actor_id uuid,p_constraints jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=private.request_tenant_id(); a public.action_queue%ROWTYPE; k text; policy uuid; em text;
BEGIN
 IF auth.uid() IS NULL OR auth.uid()<>p_actor_id THEN RAISE EXCEPTION 'Human authentication required'; END IF;
 SELECT u.email INTO em FROM auth.users u JOIN public.tenant_memberships m ON m.user_id=u.id
 JOIN public.tenants ten ON ten.id=m.tenant_id
 WHERE u.id=p_actor_id AND m.tenant_id=t AND m.status='active' AND m.role='admin' AND ten.status='active';
 IF em IS NULL THEN RAISE EXCEPTION 'Current administrator required'; END IF;
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action_id FOR UPDATE;
 IF a.id IS NULL OR a.status<>'executing' OR a.action_type<>'internal_permission_change'
 OR a.approved_by IS DISTINCT FROM em OR a.payload->'constraints' IS DISTINCT FROM p_constraints
 OR p_constraints->>'actorId' IS DISTINCT FROM p_actor_id::text THEN RAISE EXCEPTION 'Exact human-approved permission required'; END IF;
 k:=p_constraints->>'actionKey';
 IF k NOT IN ('create_task','update_task','update_next_action','create_founder_note','bulk_tag_contacts','transition_opportunity')
 OR (p_constraints->>'expiresAt')::timestamptz<=now()
 OR (p_constraints->>'expiresAt')::timestamptz>now()+interval '30 days'
 OR (p_constraints->>'maxDailyActions')::int NOT BETWEEN 1 AND 100
 OR jsonb_typeof(p_constraints->'recordIds')<>'array' OR jsonb_array_length(p_constraints->'recordIds') NOT BETWEEN 1 AND 100
 OR jsonb_typeof(p_constraints->'allowedFields')<>'array' OR jsonb_array_length(p_constraints->'allowedFields') NOT BETWEEN 1 AND 10
 THEN RAISE EXCEPTION 'Invalid bounded internal permission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('autonomy-policy',t,k)::text,0));
 IF EXISTS(SELECT 1 FROM public.autonomy_hard_floors WHERE tenant_id=t AND action_key=k)
 OR EXISTS(SELECT 1 FROM public.autonomy_policies WHERE tenant_id=t AND action_key=k AND (is_hard_floor OR level='prohibited'))
 THEN RAISE EXCEPTION 'Permission is prohibited'; END IF;
 SELECT id INTO policy FROM public.autonomy_policies WHERE tenant_id=t AND action_key=k AND coworker_id IS NULL ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF policy IS NULL THEN
 INSERT INTO public.autonomy_policies(tenant_id,action_key,label,level,constraints,source,approved_by,approved_at)
 VALUES(t,k,'Bounded internal work','standing_permission',p_constraints,'human_conversation',em,now()) RETURNING id INTO policy;
 ELSE UPDATE public.autonomy_policies SET level='standing_permission',constraints=p_constraints,approved_by=em,approved_at=now(),updated_at=now() WHERE tenant_id=t AND id=policy; END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state,metadata)
 VALUES(t,em,'autonomy_policy.internal_permission_granted','autonomy_policy',policy::text,'admin',p_constraints,jsonb_build_object('actionId',p_action_id));
 RETURN jsonb_build_object('status','granted','policyId',policy,'constraints',p_constraints);
END $$;
REVOKE ALL ON FUNCTION public.execute_internal_permission(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.execute_internal_permission(uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_internal_action(p_action_id uuid,p_actor_id uuid,p_reserve boolean DEFAULT true,p_mcp jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=private.request_tenant_id(); a public.action_queue%ROWTYPE; p public.autonomy_policies%ROWTYPE;
 k text; capability text; ck record; target text; ids jsonb; field text; allowed jsonb; count_used int; policies jsonb:='[]'; em text; coworker text;
BEGIN
 IF t IS NULL OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor_id) THEN RAISE EXCEPTION 'Actor context mismatch'; END IF;
 SELECT u.email INTO em FROM auth.users u JOIN public.tenant_memberships m ON m.user_id=u.id JOIN public.tenants ten ON ten.id=m.tenant_id
 WHERE u.id=p_actor_id AND m.tenant_id=t AND m.status='active' AND m.role='admin' AND ten.status='active';
 IF em IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','Requesting member is no longer active'); END IF;
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_action_id;
 IF a.id IS NULL OR a.status NOT IN ('pending','executing') OR (p_reserve AND a.status<>'executing')
 OR a.expires_at<=now() THEN RETURN jsonb_build_object('allowed',false,'reason','Proposal is missing, expired or already handled'); END IF;
 IF auth.uid() IS NULL AND NOT EXISTS(SELECT 1 FROM public.work_items w WHERE w.tenant_id=t AND w.id=a.work_item_id AND w.kind='agent_work' AND w.agent_plan->>'requesterId'=p_actor_id::text AND w.agent_plan->>'control'='running')
 THEN
   IF p_mcp IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','Background work requires an active human delegation'); END IF;
   BEGIN
     PERFORM public.authorize_workspace_mcp_delegation((p_mcp->>'grantId')::uuid,p_actor_id,p_mcp->>'clientId',(p_mcp->>'sessionId')::uuid,p_mcp->>'resource');
   EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('allowed',false,'reason','Workspace OAuth delegation is unavailable or revoked'); END;
 END IF;
 IF a.proposed_by IS DISTINCT FROM em THEN RETURN jsonb_build_object('allowed',false,'reason','Proposal requester mismatch'); END IF;
 k:=a.action_type;
 IF k NOT IN ('create_task','update_task','update_next_action','create_founder_note','bulk_tag_contacts','transition_opportunity')
 THEN RETURN jsonb_build_object('allowed',false,'reason','This action requires explicit human approval'); END IF;
 capability:=CASE k WHEN 'create_task' THEN 'tasks.create' WHEN 'update_task' THEN 'tasks.write' ELSE 'crm.write' END;
 ids:=CASE k WHEN 'update_task' THEN jsonb_build_array(a.payload->>'taskId') WHEN 'bulk_tag_contacts' THEN a.payload->'contactIds'
 WHEN 'create_founder_note' THEN (SELECT jsonb_agg(v) FROM jsonb_each_text(a.payload) e(key,v) WHERE key IN ('contactId','companyId','opportunityId') AND v IS NOT NULL)
 ELSE jsonb_build_array(coalesce(a.payload->>'opportunityId',a.payload->>'relatedId')) END;
 IF ids IS NULL OR jsonb_typeof(ids)<>'array' OR jsonb_array_length(ids)=0 OR ids @> '[null]'::jsonb
 THEN RETURN jsonb_build_object('allowed',false,'reason','A named record scope is required'); END IF;
 FOR target IN SELECT jsonb_array_elements_text(ids) LOOP
  IF NOT (CASE k WHEN 'update_task' THEN EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=t AND id=target::uuid)
   WHEN 'bulk_tag_contacts' THEN EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=target::uuid)
   WHEN 'create_founder_note' THEN EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=target::uuid) OR EXISTS(SELECT 1 FROM public.companies WHERE tenant_id=t AND id=target::uuid) OR EXISTS(SELECT 1 FROM public.opportunities WHERE tenant_id=t AND id=target::uuid)
   ELSE EXISTS(SELECT 1 FROM public.opportunities WHERE tenant_id=t AND id=target::uuid) END)
  THEN RETURN jsonb_build_object('allowed',false,'reason','Record is outside the current workspace'); END IF;
 END LOOP;
 IF k='transition_opportunity' AND NOT EXISTS(SELECT 1 FROM public.kanban_columns WHERE tenant_id=t AND board_key='pipeline' AND column_key=a.payload->>'stage' AND coalesce(metadata->>'role','open')='open')
 THEN RETURN jsonb_build_object('allowed',false,'reason','Terminal or unknown stages require human approval'); END IF;
 FOR ck IN SELECT * FROM public.check_autonomy(k,NULL) UNION ALL SELECT * FROM public.check_autonomy(capability,NULL) LOOP
  IF ck.hard_floor OR ck.level='prohibited' OR (ck.policy_id IS NOT NULL AND ck.requires_approval)
  THEN RETURN jsonb_build_object('allowed',false,'reason',ck.reason); END IF;
  IF ck.policy_id IS NULL THEN CONTINUE; END IF;
  SELECT * INTO p FROM public.autonomy_policies WHERE tenant_id=t AND id=ck.policy_id FOR UPDATE;
  IF p.level<>'standing_permission' OR p.approved_by IS NULL OR p.constraints->>'actorId' IS DISTINCT FROM p_actor_id::text
  OR coalesce((p.constraints->>'expiresAt')::timestamptz,'-infinity')<=now()
  OR coalesce((p.constraints->>'maxDailyActions')::int,0) NOT BETWEEN 1 AND 100
  OR NOT (p.constraints->'recordIds' @> ids)
  THEN RETURN jsonb_build_object('allowed',false,'reason','Permission expired or record scope does not match'); END IF;
  allowed:=p.constraints->'allowedFields';
  FOR field IN SELECT jsonb_object_keys(a.payload) LOOP
   IF field IN ('taskId','contactId','companyId','opportunityId','relatedId','relatedType','expectedState','expectedStage','expectedNextAction','expectedNextActionAt','dedupeKey','reasoning','contactIds') THEN CONTINUE; END IF;
   IF allowed IS NULL OR NOT (allowed ? field) THEN RETURN jsonb_build_object('allowed',false,'reason','Field is outside the approved permission: '||field); END IF;
  END LOOP;
  SELECT count(*) INTO count_used FROM public.internal_action_reservations WHERE tenant_id=t AND policy_id=p.id
   AND reserved_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND action_id<>a.id;
  IF count_used>=(p.constraints->>'maxDailyActions')::int THEN RETURN jsonb_build_object('allowed',false,'reason','Daily permission limit reached'); END IF;
  policies:=policies||jsonb_build_array(p.id);
 END LOOP;
 IF jsonb_array_length(policies)=0 THEN RETURN jsonb_build_object('allowed',false,'reason','No explicit bounded permission exists'); END IF;
 IF p_reserve THEN
  INSERT INTO public.internal_action_reservations(tenant_id,policy_id,action_id,actor_id) SELECT t,v::uuid,a.id,p_actor_id FROM jsonb_array_elements_text(policies) j(v) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('allowed',true,'reason','Within current human-established limits','policyIds',policies);
END $$;
REVOKE ALL ON FUNCTION public.reserve_internal_action(uuid,uuid,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_internal_action(uuid,uuid,boolean,jsonb) TO authenticated,service_role;

-- Public inference metadata only. Business data and prompts are never stored here.
CREATE TABLE IF NOT EXISTS private.demo_agent_sessions(session_hash text PRIMARY KEY,turns int NOT NULL DEFAULT 0,active_request uuid,lease_until timestamptz);
CREATE TABLE IF NOT EXISTS private.demo_inference_receipts(call_id uuid PRIMARY KEY,session_hash text NOT NULL,request_id uuid NOT NULL,reserved_usd numeric NOT NULL CHECK(reserved_usd>=0),actual_usd numeric,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.demo_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.demo_inference_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.demo_agent_sessions,private.demo_inference_receipts FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS demo_inference_day ON private.demo_inference_receipts(created_at);
CREATE OR REPLACE FUNCTION public.admit_demo_agent(p_session text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.demo_agent_sessions%ROWTYPE;
BEGIN
 IF p_session !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid demo session'; END IF;
 INSERT INTO private.demo_agent_sessions(session_hash) VALUES(p_session) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM private.demo_agent_sessions WHERE session_hash=p_session FOR UPDATE;
 IF s.turns>=10 THEN RETURN jsonb_build_object('allowed',false,'reason','This demo session has used its 10 AI turns. You can keep exploring the workspace.'); END IF;
 IF s.active_request IS NOT NULL AND s.lease_until>now() THEN RETURN jsonb_build_object('allowed',false,'reason','One demo request is already running in this session.'); END IF;
 UPDATE private.demo_agent_sessions SET turns=turns+1,active_request=p_request,lease_until=now()+interval '2 minutes' WHERE session_hash=p_session;
 RETURN jsonb_build_object('allowed',true);
END $$;
CREATE OR REPLACE FUNCTION public.reserve_demo_inference(p_session text,p_request uuid,p_call uuid,p_amount numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE spent numeric;
BEGIN
 IF p_amount IS NULL OR p_amount<0 OR p_amount>0.1 THEN RETURN jsonb_build_object('allowed',false,'reason','This demo request exceeds its cost limit'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('public-demo-ai-budget',0));
 IF NOT EXISTS(SELECT 1 FROM private.demo_agent_sessions WHERE session_hash=p_session AND active_request=p_request AND lease_until>now()) THEN RETURN jsonb_build_object('allowed',false,'reason','Demo request is no longer active'); END IF;
 IF EXISTS(SELECT 1 FROM private.demo_inference_receipts WHERE call_id=p_call) THEN RETURN jsonb_build_object('allowed',false,'reason','Inference call already admitted'); END IF;
 SELECT coalesce(sum(coalesce(actual_usd,reserved_usd)),0) INTO spent FROM private.demo_inference_receipts WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF spent+p_amount>5 THEN RETURN jsonb_build_object('allowed',false,'reason','The shared $5 daily demo budget has been reached. You can keep exploring the workspace.'); END IF;
 INSERT INTO private.demo_inference_receipts(call_id,session_hash,request_id,reserved_usd) VALUES(p_call,p_session,p_request,p_amount);
 RETURN jsonb_build_object('allowed',true);
END $$;
CREATE OR REPLACE FUNCTION public.settle_demo_inference(p_call uuid,p_cost numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.demo_inference_receipts SET actual_usd=CASE WHEN p_cost>=0 AND p_cost<=reserved_usd THEN p_cost ELSE NULL END WHERE call_id=p_call AND actual_usd IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inference receipt is missing or settled'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.finish_demo_agent(p_session text,p_request uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE private.demo_agent_sessions SET active_request=NULL,lease_until=NULL WHERE session_hash=p_session AND active_request=p_request;
$$;
REVOKE ALL ON FUNCTION public.admit_demo_agent(text,uuid),public.reserve_demo_inference(text,uuid,uuid,numeric),public.settle_demo_inference(uuid,numeric),public.finish_demo_agent(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_demo_agent(text,uuid),public.reserve_demo_inference(text,uuid,uuid,numeric),public.settle_demo_inference(uuid,numeric),public.finish_demo_agent(text,uuid) TO service_role;
