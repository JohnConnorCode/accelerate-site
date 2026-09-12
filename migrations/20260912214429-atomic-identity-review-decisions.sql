-- Finish the existing human identity review as one effect/receipt. The generic
-- approval executor still directs users to the workbench for the exact choice.
CREATE OR REPLACE FUNCTION private.require_identity_review_action(p_id uuid,p_payload jsonb,p_actor text)
RETURNS public.action_queue LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE; policy record;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL OR (current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'))) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.action_queue WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND OR a.action_type IS DISTINCT FROM 'identity_review' OR a.payload IS DISTINCT FROM p_payload OR p_payload#>>'{approvedDecision,decision}' IS NULL OR p_payload#>>'{approvedDecision,decision}' NOT IN ('link','create','no_match','defer') OR nullif(btrim(p_payload->>'participant_email'),'') IS NULL OR jsonb_typeof(p_payload->'conversationState') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Current exact identity decision required'; END IF;
 IF a.status='executed' OR (a.status='pending' AND a.result->>'decision'='defer' AND p_payload#>>'{approvedDecision,decision}'='defer') THEN RETURN a; END IF;
 IF a.status NOT IN ('executing','failed') OR a.approved_by IS DISTINCT FROM p_actor OR a.approved_at IS NULL OR (a.expires_at IS NOT NULL AND a.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Current exact human identity approval required'; END IF;
 SELECT * INTO policy FROM public.check_autonomy('identity_review',CASE WHEN a.proposed_by LIKE 'coworker:%' THEN substring(a.proposed_by FROM 10) ELSE NULL END);
 IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Identity decision prohibited by current policy'; END IF;
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION private.require_identity_review_action(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.require_identity_review_action(uuid,jsonb,text) TO authenticated,service_role;

-- Child links retain the exact existing parent decision authority.
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
  PERFORM private.require_identity_review_action(p_id,a.payload,p_actor);
  decision:=a.payload->'approvedDecision';
  IF p_operation<>'link_conversation_record' OR p_payload->>'conversationId' IS DISTINCT FROM a.payload->>'conversation_id' OR p_payload->'expectedState' IS DISTINCT FROM a.payload->'conversationState' OR decision->>'decision' IS NULL OR decision->>'decision' NOT IN ('link','create') THEN RAISE EXCEPTION 'Link is outside the approved identity decision'; END IF;
  SELECT * INTO chosen FROM public.contacts WHERE tenant_id=t AND id=(p_payload#>>'{patch,contact_id}')::uuid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chosen contact is unavailable'; END IF;
  IF decision->>'decision'='link' THEN
   IF chosen.id::text IS DISTINCT FROM decision->>'contactId' OR NOT (lower(btrim(chosen.primary_email))=lower(btrim(a.payload->>'participant_email')) OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.payload->'candidates') c WHERE c->>'id'=chosen.id::text)) THEN RAISE EXCEPTION 'Chosen contact no longer matches the approved identity'; END IF;
  ELSE
   IF chosen.source_record_type IS DISTINCT FROM 'identity_review_row' OR chosen.source_record_id IS DISTINCT FROM a.id OR chosen.full_name IS DISTINCT FROM decision->>'fullName' OR lower(btrim(chosen.primary_email)) IS DISTINCT FROM lower(btrim(a.payload->>'participant_email')) OR chosen.phone IS DISTINCT FROM decision->>'phone' THEN RAISE EXCEPTION 'Created contact does not match the approved identity'; END IF;
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


-- Keep the same evidence algorithm; add only the exact approved no-match decision.
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
    IF p_source_type='operator_review' THEN
      a := private.require_identity_review_action(p_action_id,p_action_payload,p_actor);
      IF a.status<>'executing' OR a.payload#>>'{approvedDecision,decision}' IS DISTINCT FROM 'no_match'
        OR p_entity_type IS DISTINCT FROM 'conversation' OR p_entity_id::text IS DISTINCT FROM a.payload->>'conversation_id'
        OR p_field IS DISTINCT FROM 'identity_review_decision' OR p_proposed_value IS DISTINCT FROM a.id::text
        OR p_strength IS DISTINCT FROM 'human_entered'::public.evidence_strength
        OR p_source_id IS DISTINCT FROM 'identity-review:'||a.id::text||':no-match'
        OR p_observation IS DISTINCT FROM 'Founder decided '||lower(btrim(a.payload->>'participant_email'))||' matches no canonical record'
        OR p_provenance IS DISTINCT FROM jsonb_build_object('conversation_id',p_entity_id,'action_id',a.id)
        OR p_coworker_id IS NOT NULL OR p_agent_run_id IS NOT NULL
        OR NOT EXISTS(SELECT 1 FROM public.conversations c WHERE c.tenant_id=v_tenant_id AND c.id=p_entity_id AND to_jsonb(c)=a.payload->'conversationState')
      THEN RAISE EXCEPTION 'Evidence is outside the exact executing identity decision'; END IF;
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
    END IF;
    -- Serialize exact approved evidence retries on the queue row locked above.
    RETURN QUERY SELECT c.id,e.id,c.status,c.best_evidence,false FROM public.evidence e
      JOIN public.claims c ON c.id=e.claim_id AND c.tenant_id=e.tenant_id
      WHERE e.tenant_id=v_tenant_id AND e.source_type=p_source_type AND e.source_id=p_source_id;
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
CREATE OR REPLACE FUNCTION public.apply_identity_review_action(p_id uuid,p_payload jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); a public.action_queue%ROWTYPE;
 conversation public.conversations%ROWTYPE; contact public.contacts%ROWTYPE; company public.companies%ROWTYPE;
 decision jsonb; choice text; email text; domain text; full_name text; names text[]; company_id uuid; contact_id uuid;
 result_json jsonb; link_payload jsonb; evidence_result record; happened timestamptz:=clock_timestamp(); title text; summary text;
BEGIN
 a:=private.require_identity_review_action(p_id,p_payload,p_actor);
 IF a.status='executed' OR (a.status='pending' AND a.result->>'decision'='defer') THEN RETURN a.result; END IF;
 IF a.status='failed' THEN UPDATE public.action_queue SET status='executing',error=NULL WHERE tenant_id=t AND id=a.id; a.status:='executing'; END IF;
 decision:=p_payload->'approvedDecision'; choice:=decision->>'decision'; email:=lower(btrim(p_payload->>'participant_email'));
 SELECT * INTO conversation FROM public.conversations WHERE tenant_id=t AND id=(p_payload->>'conversation_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 IF choice IN ('link','create') AND a.result ? 'conversationEffect' THEN
  -- Finish a retained child receipt from the previous owner without repeating
  -- identity creation or link evidence. Both the live approval and full saved
  -- thread must still match; a newer human edit requires another review.
  link_payload:=a.result#>'{conversationEffect,payload}';
  PERFORM private.require_conversation_action(a.id,'link_conversation_record',link_payload,p_actor);
  IF to_jsonb(conversation) IS DISTINCT FROM a.result#>'{conversationEffect,result}' THEN RAISE EXCEPTION 'Conversation changed since identity review; prepare a new decision'; END IF;
  contact_id:=(link_payload#>>'{patch,contact_id}')::uuid;
  company_id:=(link_payload#>>'{patch,company_id}')::uuid;
  title:='Identity review '||CASE choice WHEN 'create' THEN 'created ' ELSE 'linked ' END||email;
  summary:='Founder confirmed the participant identity and linked the conversation.';
 ELSE
 IF to_jsonb(conversation) IS DISTINCT FROM p_payload->'conversationState' THEN RAISE EXCEPTION 'Conversation changed since identity review; prepare a new decision'; END IF;
 IF choice IN ('link','create') THEN
  -- The same identity lock used by resolve_revenue_identity protects exact email
  -- matching and creation against concurrent canonical intake.
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':canonical-identity',0));
  IF choice='link' THEN
   SELECT * INTO contact FROM public.contacts WHERE tenant_id=t AND id=(decision->>'contactId')::uuid FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Chosen contact is unavailable'; END IF;
   IF NOT (lower(btrim(contact.primary_email))=email OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'candidates') candidate WHERE candidate->>'id'=contact.id::text)) THEN RAISE EXCEPTION 'Identity changed after review: chosen contact no longer matches'; END IF;
   IF conversation.contact_id IS NOT NULL AND conversation.contact_id<>contact.id THEN RAISE EXCEPTION 'Conversation was linked elsewhere while under review; re-review before linking'; END IF;
   contact_id:=contact.id;
   company_id:=coalesce(nullif(decision->>'companyId','')::uuid,contact.company_id);
   IF company_id IS NOT NULL THEN
    PERFORM 1 FROM public.companies WHERE tenant_id=t AND id=company_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chosen company is unavailable'; END IF;
   END IF;
   title:='Identity review linked '||email; summary:='Founder linked the participant to '||contact.full_name||'.';
  ELSE
   full_name:=nullif(btrim(decision->>'fullName'),'');
   IF full_name IS NULL THEN RAISE EXCEPTION 'Create requires the contact full name'; END IF;
   IF EXISTS(SELECT 1 FROM public.contacts c WHERE c.tenant_id=t AND (lower(c.primary_email)=email OR EXISTS(SELECT 1 FROM unnest(c.alternate_emails) alternate WHERE lower(alternate)=email))) THEN RAISE EXCEPTION 'Identity changed after review: this email now belongs to an existing contact'; END IF;
   IF nullif(decision->>'companyId','') IS NOT NULL THEN
    SELECT * INTO company FROM public.companies WHERE tenant_id=t AND id=(decision->>'companyId')::uuid FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chosen company is unavailable'; END IF;
    company_id:=company.id;
   ELSIF nullif(btrim(decision->>'companyName'),'') IS NOT NULL THEN
    -- Email-only normalization matches the existing JavaScript helper; websites
    -- and URL parsing are not part of this human-confirmed review operation.
    domain:=nullif(split_part(email,'@',2),'');
    IF domain IS DISTINCT FROM decision->>'companyDomain' THEN RAISE EXCEPTION 'Company domain does not match the reviewed participant'; END IF;
    IF domain IN ('gmail.com','googlemail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','me.com','aol.com','proton.me','protonmail.com') THEN RAISE EXCEPTION 'A personal email address cannot seed a company; create the contact without one'; END IF;
    INSERT INTO public.companies(tenant_id,name,domain,source,source_record_type,source_record_id)
    VALUES(t,btrim(decision->>'companyName'),domain,'identity_review','identity_review_company_row',a.id) RETURNING id INTO company_id;
   END IF;
   names:=regexp_split_to_array(full_name,'\s+');
   INSERT INTO public.contacts(tenant_id,first_name,last_name,full_name,primary_email,phone,company_id,source,source_record_type,source_record_id)
   VALUES(t,names[1],CASE WHEN cardinality(names)>1 THEN array_to_string(names[2:cardinality(names)],' ') ELSE NULL END,full_name,email,nullif(btrim(decision->>'phone'),''),company_id,'identity_review','identity_review_row',a.id) RETURNING id INTO contact_id;
   INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata)
   VALUES(t,p_actor,'contact.created','contact',contact_id::text,jsonb_build_object('company_id',company_id,'review_action_id',a.id),jsonb_build_object('source','admin','actionId',a.id));
   title:='Identity review created '||full_name; summary:='Founder confirmed '||email||' is a new contact and linked the conversation.';
  END IF;
  link_payload:=jsonb_build_object('conversationId',conversation.id,'patch',jsonb_build_object('contact_id',contact_id,'company_id',company_id),'expectedState',to_jsonb(conversation));
  PERFORM public.apply_conversation_action(a.id,'link_conversation_record',link_payload,p_actor);
 ELSIF choice='no_match' THEN
  SELECT * INTO evidence_result FROM private.record_evidence_effect('conversation',conversation.id,'identity_review_decision',a.id::text,'operator_review','Founder decided '||email||' matches no canonical record','human_entered','identity-review:'||a.id::text||':no-match',jsonb_build_object('conversation_id',conversation.id,'action_id',a.id),NULL,NULL,a.id,p_payload,p_actor);
  IF evidence_result.is_new_claim THEN
   INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata)
   VALUES(t,p_actor,'claim.created','claim',evidence_result.claim_id::text,jsonb_build_object('entity_type','conversation','entity_id',conversation.id,'field','identity_review_decision','proposed_value',a.id,'status',evidence_result.claim_status,'best_evidence',evidence_result.best_evidence),jsonb_build_object('source','automation','actionId',a.id));
  END IF;
  title:='Identity review resolved without a match: '||email;
  summary:='Founder confirmed this participant matches no canonical record; existing conversation links were preserved.';
 ELSE
  title:='Identity review deferred: '||email; summary:='Founder deferred the identity decision; the item stays in the review queue.';
 END IF;
 END IF;
 result_json:=jsonb_build_object('decision',choice,'conversation_id',conversation.id,'contact_id',contact_id,'company_id',company_id);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata)
 VALUES(t,p_actor,CASE WHEN choice='defer' THEN 'identity_review.deferred' ELSE 'identity_review.resolved' END,'action_queue',a.id::text,result_json,jsonb_build_object('source','admin','conversation_id',conversation.id,'participant_email',email));
 INSERT INTO public.activities(tenant_id,activity_type,title,summary,conversation_id,contact_id,company_id,actor_email,source,external_id,metadata)
 VALUES(t,CASE WHEN choice='defer' THEN 'identity_review_deferred' ELSE 'identity_review_resolved' END,title,summary,conversation.id,contact_id,company_id,p_actor,'operator',CASE choice WHEN 'link' THEN 'identity_link:' WHEN 'create' THEN 'identity_create:' WHEN 'no_match' THEN 'identity_no_match:' ELSE 'identity_defer:' END||a.id::text,jsonb_build_object('actionId',a.id));
 UPDATE public.action_queue SET status=CASE WHEN choice='defer' THEN 'pending' ELSE 'executed' END,
  approved_by=CASE WHEN choice='defer' THEN NULL ELSE approved_by END,approved_at=CASE WHEN choice='defer' THEN NULL ELSE approved_at END,
  executed_at=CASE WHEN choice='defer' THEN NULL ELSE happened END,result=result_json,error=NULL,reversibility='compensable'
  WHERE tenant_id=t AND id=a.id;
 IF choice<>'defer' THEN
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata) VALUES(t,p_actor,'action.executed','action_queue',a.id::text,result_json,jsonb_build_object('actionType','identity_review'));
 END IF;
 RETURN result_json;
END $$;
REVOKE ALL ON FUNCTION public.apply_identity_review_action(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_identity_review_action(uuid,jsonb,text) TO authenticated,service_role;
