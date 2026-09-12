-- Conversation operator effects share the existing queue. No service-role bridge
-- is added: every writer runs with the caller's grants and tenant RLS.
CREATE OR REPLACE FUNCTION private.require_conversation_action(p_id uuid,p_operation text,p_payload jsonb,p_actor text,p_require_live boolean DEFAULT false)
RETURNS public.action_queue LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE;
 policy record; decision jsonb; chosen public.contacts%ROWTYPE; company uuid;
BEGIN
 IF p_operation NOT IN ('update_conversation_status','assign_conversation','link_conversation_record') OR p_operation IS NULL THEN RAISE EXCEPTION 'Unsupported conversation operation'; END IF;
 IF nullif(btrim(p_actor),'') IS NULL OR (current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'))) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current exact conversation approval required'; END IF;
 IF a.action_type='identity_review' THEN
  decision:=a.payload->'approvedDecision';
  IF p_operation<>'link_conversation_record' OR p_payload->>'conversationId' IS DISTINCT FROM a.payload->>'conversation_id' OR p_payload->'expectedState' IS DISTINCT FROM a.payload->'conversationState' OR decision->>'decision' IS NULL OR decision->>'decision' NOT IN ('link','create') THEN RAISE EXCEPTION 'Link is outside the approved identity decision'; END IF;
  SELECT * INTO chosen FROM public.contacts WHERE tenant_id=t AND id=(p_payload#>>'{patch,contact_id}')::uuid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chosen contact is unavailable'; END IF;
  IF decision->>'decision'='link' THEN
   IF chosen.id::text IS DISTINCT FROM decision->>'contactId' OR NOT (lower(chosen.primary_email)=lower(a.payload->>'participant_email') OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.payload->'candidates') c WHERE c->>'id'=chosen.id::text)) THEN RAISE EXCEPTION 'Chosen contact no longer matches the approved identity'; END IF;
  ELSE
   IF chosen.source_record_type IS DISTINCT FROM 'identity_review_row' OR chosen.source_record_id IS DISTINCT FROM a.id OR chosen.full_name IS DISTINCT FROM decision->>'fullName' OR lower(chosen.primary_email) IS DISTINCT FROM lower(a.payload->>'participant_email') OR chosen.phone IS DISTINCT FROM decision->>'phone' THEN RAISE EXCEPTION 'Created contact does not match the approved identity'; END IF;
  END IF;
  company:=coalesce(nullif(decision->>'companyId','')::uuid,chosen.company_id);
  IF decision->>'decision'='create' AND nullif(decision->>'companyId','') IS NULL THEN
   IF nullif(decision->>'companyName','') IS NULL THEN
    IF company IS NOT NULL THEN RAISE EXCEPTION 'Created company is outside the approved identity decision'; END IF;
   ELSIF company IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE tenant_id=t AND id=company AND source_record_type='identity_review_company_row' AND source_record_id=a.id AND name=decision->>'companyName') THEN RAISE EXCEPTION 'Created company is outside the approved identity decision'; END IF;
  END IF;
  IF p_payload->'patch' IS DISTINCT FROM jsonb_build_object('contact_id',chosen.id,'company_id',company) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('conversationId','patch','expectedState')) THEN RAISE EXCEPTION 'Link is outside the approved identity decision'; END IF;
 ELSIF a.action_type IS DISTINCT FROM p_operation OR a.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Current exact conversation approval required';
 END IF;
 IF a.status='executed' AND NOT p_require_live THEN RETURN a; END IF;
 IF (a.status<>'executing' AND NOT(p_require_live AND a.status='executed')) OR (a.status='executing' AND a.expires_at IS NOT NULL AND a.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Current exact conversation approval required'; END IF;
 SELECT checks.* INTO policy FROM (
  SELECT * FROM public.check_autonomy(a.action_type,CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END)
  UNION ALL SELECT * FROM public.check_autonomy('crm.write',CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END)
 ) checks ORDER BY (checks.hard_floor OR checks.level='prohibited') DESC,(checks.policy_id IS NOT NULL) DESC,checks.requires_approval DESC LIMIT 1;
 IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Conversation action prohibited by current policy'; END IF;
 IF a.approved_by IS NULL THEN
  IF a.action_type='identity_review' OR NOT policy.allowed OR policy.level<>'standing_permission' THEN RAISE EXCEPTION 'Current standing permission required'; END IF;
 ELSIF a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL THEN RAISE EXCEPTION 'Current exact human approval required'; END IF;
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION private.require_conversation_action(uuid,text,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.require_conversation_action(uuid,text,jsonb,text,boolean) TO authenticated,service_role;

-- Preserve one evidence algorithm and the service-only ingestion interface.
-- The old definer RPC supplied these service permissions implicitly. Its invoker
-- replacement keeps that existing ingestion authority without granting a new
-- authenticated direct-table path or bypassing caller RLS.
GRANT SELECT,INSERT,UPDATE ON public.claims,public.evidence TO service_role;
CREATE OR REPLACE FUNCTION private.record_evidence_effect(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_field TEXT,
  p_proposed_value TEXT,
  p_source_type TEXT,
  p_observation TEXT,
  p_strength public.evidence_strength DEFAULT 'model_inference',
  p_source_id TEXT DEFAULT NULL,
  p_provenance JSONB DEFAULT '{}',
  p_coworker_id TEXT DEFAULT NULL,
  p_agent_run_id UUID DEFAULT NULL,
  p_action_id UUID DEFAULT NULL,
  p_action_payload JSONB DEFAULT NULL,
  p_actor TEXT DEFAULT NULL
) RETURNS TABLE (
  claim_id UUID,
  evidence_id UUID,
  claim_status public.claim_status,
  best_evidence public.evidence_strength,
  is_new_claim BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  a public.action_queue%ROWTYPE;
  v_tenant_id UUID;
  v_claim_id UUID;
  v_evidence_id UUID;
  v_is_new_claim BOOLEAN := false;
  v_best_evidence public.evidence_strength;
  v_claim_status public.claim_status;
  v_existing_value TEXT;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();
  IF p_action_id IS NULL THEN
    IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Evidence requires a bound executing action' USING ERRCODE='42501'; END IF;
  ELSE
    a := private.require_conversation_action(p_action_id,'link_conversation_record',p_action_payload,p_actor);
    IF a.status<>'executing' OR p_entity_type IS DISTINCT FROM 'conversation'
      OR p_entity_id::text IS DISTINCT FROM p_action_payload->>'conversationId'
      OR p_field NOT IN ('contact_id','company_id','opportunity_id') OR p_field IS NULL
      OR p_proposed_value IS DISTINCT FROM p_action_payload->'patch'->>p_field
      OR p_source_type IS DISTINCT FROM 'operator_link' OR p_strength IS DISTINCT FROM 'human_entered'::public.evidence_strength
      OR p_source_id IS DISTINCT FROM 'conversation-action:'||p_action_id::text||':'||p_field
      OR p_observation IS DISTINCT FROM 'Founder linked conversation to '||p_field||' '||p_proposed_value
      OR p_provenance IS DISTINCT FROM jsonb_build_object('conversation_id',p_entity_id,'actionId',p_action_id)
      OR p_coworker_id IS NOT NULL OR p_agent_run_id IS NOT NULL
      OR NOT EXISTS(SELECT 1 FROM public.conversations c WHERE c.tenant_id=v_tenant_id AND c.id=p_entity_id AND to_jsonb(c)->>p_field=p_proposed_value)
    THEN RAISE EXCEPTION 'Evidence is outside the exact executing conversation action'; END IF;
    -- Serialize exact approved evidence retries on the queue row locked above.
    RETURN QUERY SELECT c.id,e.id,c.status,c.best_evidence,false FROM public.evidence e
      JOIN public.claims c ON c.id=e.claim_id AND c.tenant_id=e.tenant_id
      WHERE e.tenant_id=v_tenant_id AND e.source_type='operator_link' AND e.source_id=p_source_id;
    IF FOUND THEN RETURN; END IF;
  END IF;


  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'entity_type is required';
  END IF;
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required';
  END IF;
  IF p_field IS NULL OR btrim(p_field) = '' THEN
    RAISE EXCEPTION 'field is required';
  END IF;
  IF p_proposed_value IS NULL OR btrim(p_proposed_value) = '' THEN
    RAISE EXCEPTION 'proposed_value is required';
  END IF;
  IF p_source_type IS NULL OR btrim(p_source_type) = '' THEN
    RAISE EXCEPTION 'source_type is required';
  END IF;
  IF p_observation IS NULL OR btrim(p_observation) = '' THEN
    RAISE EXCEPTION 'observation is required';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1: Find or create the claim.
  -- -------------------------------------------------------------------------
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text||':claim:'||p_entity_type||':'||p_entity_id::text||':'||p_field,0));
  SELECT id, proposed_value INTO v_claim_id, v_existing_value
  FROM public.claims
  WHERE tenant_id = v_tenant_id
    AND entity_type = btrim(p_entity_type)
    AND entity_id = p_entity_id
    AND field = btrim(p_field)
    AND status IN ('unverified', 'supported', 'conflicted', 'verified')
  LIMIT 1;

  IF NOT FOUND THEN
    -- No open claim: create one.
    INSERT INTO public.claims (
      tenant_id, entity_type, entity_id, field, proposed_value,
      status, source_type, source_id, coworker_id, agent_run_id
    ) VALUES (
      v_tenant_id, btrim(p_entity_type), p_entity_id, btrim(p_field), btrim(p_proposed_value),
      'unverified', btrim(p_source_type), p_source_id, p_coworker_id, p_agent_run_id
    ) RETURNING id INTO v_claim_id;
    v_is_new_claim := true;
  ELSIF v_existing_value IS DISTINCT FROM btrim(p_proposed_value) THEN
    -- Value conflict: the existing claim proposes a different value.
    -- Add the evidence but mark the claim as conflicted.
    UPDATE public.claims
    SET status = 'conflicted'
    WHERE id = v_claim_id AND status != 'conflicted';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Add the evidence row.
  -- -------------------------------------------------------------------------
  INSERT INTO public.evidence (
    tenant_id, claim_id, source_type, source_id, observation,
    strength, provenance, agent_run_id
  ) VALUES (
    v_tenant_id, v_claim_id, btrim(p_source_type), p_source_id, btrim(p_observation),
    p_strength, p_provenance, p_agent_run_id
  ) RETURNING id INTO v_evidence_id;

  -- -------------------------------------------------------------------------
  -- Step 3: Recalculate best_evidence and claim status.
  -- -------------------------------------------------------------------------
  -- Determine the strongest evidence across all evidence for this claim.
  -- The hierarchy is: human_confirmed > human_entered > verified_external >
  --                   probable_external > model_inference
  SELECT MIN(e.strength) INTO v_best_evidence
  FROM public.evidence e
  WHERE e.claim_id = v_claim_id
    -- Use the PostgreSQL enum ordering: human_confirmed < human_entered < ... < model_inference
  GROUP BY e.claim_id;

  -- Apply human truth hierarchy:
  --   human_confirmed or human_entered → verified
  --   verified_external → supported
  --   probable_external → supported
  --   model_inference → unverified (never auto-verify from model inference alone)
  --   conflicted claims stay conflicted regardless of evidence strength
  SELECT status INTO v_claim_status FROM public.claims WHERE id = v_claim_id;

  IF v_claim_status = 'conflicted' THEN
    -- Conflicted claims stay conflicted until human review.
    v_claim_status := 'conflicted';
  ELSIF v_best_evidence IN ('human_confirmed', 'human_entered') THEN
    v_claim_status := 'verified';
  ELSIF v_best_evidence IN ('verified_external', 'probable_external') THEN
    v_claim_status := 'supported';
  ELSE
    v_claim_status := 'unverified';
  END IF;

  UPDATE public.claims
  SET best_evidence = v_best_evidence,
      status = v_claim_status,
      resolved_at = CASE WHEN v_claim_status IN ('verified', 'superseded', 'retracted') THEN now() ELSE resolved_at END
  WHERE id = v_claim_id;

  RETURN QUERY SELECT v_claim_id, v_evidence_id, v_claim_status, v_best_evidence, v_is_new_claim;
END;
$$;

REVOKE ALL ON FUNCTION private.record_evidence_effect(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID, UUID, JSONB, TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.record_evidence_effect(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID, UUID, JSONB, TEXT) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.record_evidence(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_field TEXT,
  p_proposed_value TEXT,
  p_source_type TEXT,
  p_observation TEXT,
  p_strength public.evidence_strength DEFAULT 'model_inference',
  p_source_id TEXT DEFAULT NULL,
  p_provenance JSONB DEFAULT '{}',
  p_coworker_id TEXT DEFAULT NULL,
  p_agent_run_id UUID DEFAULT NULL
) RETURNS TABLE (
  claim_id UUID,
  evidence_id UUID,
  claim_status public.claim_status,
  best_evidence public.evidence_strength,
  is_new_claim BOOLEAN
)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM private.record_evidence_effect(p_entity_type,p_entity_id,p_field,p_proposed_value,p_source_type,p_observation,p_strength,p_source_id,p_provenance,p_coworker_id,p_agent_run_id);
$$;
REVOKE ALL ON FUNCTION public.record_evidence(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_evidence(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_conversation_action(p_id uuid,p_operation text,p_payload jsonb,p_actor text,p_undo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE;
 old public.conversations%ROWTYPE; updated public.conversations%ROWTYPE;
 happened timestamptz:=clock_timestamp(); patch jsonb; field text; assignee text;
 audit_name text; activity_name text; title text; summary text; provenance jsonb; result_json jsonb; evidence_result record;
BEGIN
 a:=private.require_conversation_action(p_id,p_operation,p_payload,p_actor,p_undo);
 IF p_undo THEN
  IF a.action_type NOT IN ('update_conversation_status','assign_conversation') OR a.status<>'executed' OR a.reversibility IS DISTINCT FROM 'reversible' OR a.compensation->>'version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'A recorded reversible conversation effect is required'; END IF;
  IF a.compensation ? 'undoneAt' THEN RETURN a.compensation->'undoResult'; END IF;
 ELSIF a.status='executed' THEN
  IF a.action_type='identity_review' THEN RETURN a.result->'conversationEffect'->'result'; END IF;
  RETURN a.result;
 ELSIF a.action_type='identity_review' AND a.result ? 'conversationEffect' THEN
  IF a.result#>'{conversationEffect,payload}' IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Identity link retry differs from its receipt'; END IF;
  RETURN a.result#>'{conversationEffect,result}';
 END IF;
 SELECT * INTO old FROM public.conversations WHERE tenant_id=t AND id=(p_payload->>'conversationId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation is unavailable'; END IF;
 IF p_undo THEN
  IF to_jsonb(old) IS DISTINCT FROM a.compensation->'after' THEN RAISE EXCEPTION 'Conversation changed since execution; review a new correction'; END IF;
  updated:=jsonb_populate_record(NULL::public.conversations,a.compensation->'before');
  assignee:=updated.metadata->>'assigned_to';
 ELSE
  IF to_jsonb(old) IS DISTINCT FROM p_payload->'expectedState' THEN RAISE EXCEPTION 'Conversation changed since preview; prepare a new proposal'; END IF;
  updated:=old;
  IF p_operation='update_conversation_status' THEN
   IF p_payload->>'status' NOT IN ('open','waiting','resolved','archived') OR p_payload->>'status' IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('conversationId','expectedState','status')) THEN RAISE EXCEPTION 'Invalid conversation status'; END IF;
   updated.status:=p_payload->>'status';
   IF updated.status IN ('resolved','archived') THEN updated.unread_count:=0; END IF;
  ELSIF p_operation='assign_conversation' THEN
   IF NOT p_payload ? 'assigneeEmail' OR jsonb_typeof(p_payload->'assigneeEmail') NOT IN ('string','null') OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('conversationId','expectedState','assigneeEmail')) THEN RAISE EXCEPTION 'Invalid conversation assignment'; END IF;
   assignee:=lower(btrim(p_payload->>'assigneeEmail'));
   updated.metadata:=coalesce(old.metadata,'{}'::jsonb)||jsonb_build_object('assigned_to',assignee);
  ELSE
   patch:=p_payload->'patch';
   IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('contact_id','company_id','opportunity_id')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('conversationId','patch','expectedState')) THEN RAISE EXCEPTION 'Invalid conversation links'; END IF;
   updated:=jsonb_populate_record(old,patch);
   IF updated.contact_id IS NOT NULL THEN PERFORM 1 FROM public.contacts WHERE tenant_id=t AND id=updated.contact_id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Contact is unavailable'; END IF; END IF;
   IF updated.company_id IS NOT NULL THEN PERFORM 1 FROM public.companies WHERE tenant_id=t AND id=updated.company_id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Company is unavailable'; END IF; END IF;
   IF updated.opportunity_id IS NOT NULL THEN PERFORM 1 FROM public.opportunities WHERE tenant_id=t AND id=updated.opportunity_id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity is unavailable'; END IF; END IF;
  END IF;
 END IF;
 IF p_operation='assign_conversation' AND assignee IS NOT NULL THEN
  PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=t AND lower(invited_email)=assignee AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation assignee must be an active member of this workspace'; END IF;
 END IF;
 UPDATE public.conversations SET status=updated.status,unread_count=updated.unread_count,metadata=updated.metadata,
  contact_id=updated.contact_id,company_id=updated.company_id,opportunity_id=updated.opportunity_id,updated_at=happened
  WHERE tenant_id=t AND id=old.id RETURNING * INTO updated;
 provenance:=jsonb_build_object('actionId',a.id,'authority',CASE WHEN a.action_type='identity_review' THEN 'parent_approval' WHEN a.approved_by IS NULL THEN 'standing_policy' ELSE 'human_approval' END);
 IF p_undo THEN
  result_json:=jsonb_build_object('undone',a.action_type,'detail',jsonb_build_object('conversation',to_jsonb(updated)));
  UPDATE public.action_queue SET compensation=a.compensation||jsonb_build_object('undoneAt',happened,'undoResult',result_json) WHERE tenant_id=t AND id=p_id;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata) VALUES(t,p_actor,'action.compensated','action_queue',p_id::text,to_jsonb(old),to_jsonb(updated),provenance);
  RETURN result_json;
 END IF;
 IF p_operation='link_conversation_record' THEN
  FOR field IN SELECT jsonb_object_keys(patch) LOOP
   IF patch->>field IS NULL THEN CONTINUE; END IF;
   SELECT * INTO evidence_result FROM private.record_evidence_effect('conversation',old.id,field,patch->>field,'operator_link','Founder linked conversation to '||field||' '||(patch->>field),'human_entered','conversation-action:'||a.id::text||':'||field,jsonb_build_object('conversation_id',old.id,'actionId',a.id),NULL,NULL,a.id,p_payload,p_actor);
   IF evidence_result.is_new_claim THEN
    INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata) VALUES(t,p_actor,'claim.created','claim',evidence_result.claim_id::text,jsonb_build_object('entity_type','conversation','entity_id',old.id,'field',field,'proposed_value',patch->>field,'status',evidence_result.claim_status,'best_evidence',evidence_result.best_evidence),provenance||jsonb_build_object('source','automation'));
   END IF;
  END LOOP;
  audit_name:='conversation.linked_record'; activity_name:='conversation_linked'; title:='Conversation linked to business record';
  summary:='Linked to opportunity: '||coalesce(updated.opportunity_id::text,'none')||', contact: '||coalesce(updated.contact_id::text,'none')||'.';
 ELSIF p_operation='assign_conversation' THEN
  audit_name:=CASE WHEN assignee IS NULL THEN 'conversation.unassigned' ELSE 'conversation.assigned' END; activity_name:='conversation_assigned';
  title:=CASE WHEN assignee IS NULL THEN 'Conversation unassigned' ELSE 'Conversation assigned to '||assignee END;
  summary:=CASE WHEN assignee IS NULL THEN 'Operator cleared the thread assignment.' ELSE 'Operator routed the thread to '||assignee||'.' END;
 ELSE
  audit_name:='conversation.status_'||updated.status; activity_name:='conversation_status_updated'; title:='Conversation marked as '||updated.status; summary:='Operator updated conversation status to '||updated.status||'.';
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata) VALUES(t,p_actor,audit_name,'conversation',old.id::text,to_jsonb(old),to_jsonb(updated),provenance);
 INSERT INTO public.activities(tenant_id,activity_type,title,summary,conversation_id,opportunity_id,contact_id,company_id,source,actor_email,external_id,metadata,occurred_at)
 VALUES(t,activity_name,title,summary,old.id,updated.opportunity_id,updated.contact_id,updated.company_id,'operator',p_actor,'conversation-action:'||a.id::text,provenance,happened);
 result_json:=to_jsonb(updated);
 IF a.action_type='identity_review' THEN
  UPDATE public.action_queue SET result=coalesce(a.result,'{}'::jsonb)||jsonb_build_object('conversationEffect',jsonb_build_object('payload',p_payload,'result',result_json)) WHERE tenant_id=t AND id=p_id;
 ELSE
  UPDATE public.action_queue SET status='executed',executed_at=happened,result=result_json,error=NULL,
   reversibility=CASE WHEN p_operation='link_conversation_record' THEN 'compensable' ELSE 'reversible' END,
   compensation=CASE WHEN p_operation='link_conversation_record' THEN '{}'::jsonb ELSE jsonb_build_object('version',1,'before',to_jsonb(old),'after',result_json) END
   WHERE tenant_id=t AND id=p_id;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,before_state,after_state,metadata) VALUES(t,p_actor,'action.executed','action_queue',p_id::text,to_jsonb(old),result_json,provenance);
 END IF;
 RETURN result_json;
END $$;
REVOKE ALL ON FUNCTION public.apply_conversation_action(uuid,text,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_conversation_action(uuid,text,jsonb,text,boolean) TO authenticated,service_role;
