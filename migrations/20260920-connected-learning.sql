BEGIN;
-- Independent observations and approved rules can coexist for one action.
-- Existing superseded history stays intact; no old rule is silently reactivated.
DROP INDEX IF EXISTS public.idx_learned_policies_active_global;
DROP INDEX IF EXISTS public.idx_learned_policies_active_scoped;
ALTER TABLE public.learned_policies ADD COLUMN IF NOT EXISTS receipt_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_policy_receipt
 ON public.learned_policies(tenant_id,receipt_key) WHERE receipt_key IS NOT NULL;
ALTER TABLE public.learning_proposals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_learned_policy(
 p_policy jsonb, p_actor text, p_supersedes uuid DEFAULT NULL, p_receipt_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); result learned_policies; previous learned_policies;
BEGIN
 IF nullif(btrim(p_policy->>'action_key'),'') IS NULL OR length(p_policy->>'action_key')>200
 OR nullif(btrim(p_policy->>'rule'),'') IS NULL OR length(p_policy->>'rule')>10000
 OR coalesce(length(p_policy->>'rationale'),0)>10000 OR pg_column_size(p_policy)>32768
 OR nullif(btrim(p_actor),'') IS NULL OR length(p_actor)>320
 OR coalesce(length(p_receipt_key),0)>200 THEN RAISE EXCEPTION 'Invalid learned policy'; END IF;
 IF p_policy->>'source'='approved_learning' THEN
  IF p_policy->>'authority' IS DISTINCT FROM 'approved' OR NOT EXISTS (
    SELECT 1 FROM learning_proposals p JOIN action_queue a ON a.tenant_id=p.tenant_id AND a.id=p.approval_action_id
    WHERE p.tenant_id=t AND p_receipt_key='proposal:'||p.id::text AND p.status='proposed'
      AND p_policy->>'action_key'='learning:'||p.id::text AND p_policy->>'rule'=p.rule
      AND p_policy->>'proposal_type' IS NOT DISTINCT FROM p.proposal_type
      AND p_policy->'scope' IS NOT DISTINCT FROM coalesce(p.scope,'null'::jsonb)
      AND p_policy->'affected_workers' IS NOT DISTINCT FROM to_jsonb(p.affected_workers)
      AND p_supersedes IS NOT DISTINCT FROM p.supersedes_policy_id
      AND p_policy->>'coworker_id' IS NULL AND p_policy->>'scope_entity_type' IS NULL AND p_policy->>'scope_entity_id' IS NULL
      AND a.action_type='approve_learning' AND a.status='executing' AND a.approved_at IS NOT NULL
      AND a.approved_by=p_actor AND a.payload->>'proposalId'=p.id::text
  ) THEN RAISE EXCEPTION 'Approved guidance requires its approved proposal action'; END IF;
 ELSIF coalesce(p_policy->>'authority','working')<>'working' THEN
  RAISE EXCEPTION 'Observations cannot grant themselves approved authority';
 END IF;
 IF p_policy->>'coworker_id' IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM coworkers WHERE tenant_id=t AND id=p_policy->>'coworker_id'
 ) THEN RAISE EXCEPTION 'Coworker does not belong to this tenant'; END IF;
 -- Serialize replay before checking its receipt. A failure rolls back policy,
 -- replacement and audit together. This is not an authorization policy writer.
 IF p_receipt_key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':learning:'||p_receipt_key,0));
  SELECT * INTO result FROM learned_policies WHERE tenant_id=t AND receipt_key=p_receipt_key;
  IF FOUND THEN
   IF NOT to_jsonb(result) @> p_policy THEN RAISE EXCEPTION 'Learning receipt does not match the original policy'; END IF;
   RETURN to_jsonb(result);
  END IF;
 END IF;
 IF p_supersedes IS NOT NULL THEN
  SELECT * INTO previous FROM learned_policies WHERE tenant_id=t AND id=p_supersedes FOR UPDATE;
  IF NOT FOUND OR previous.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Replacement target is unavailable or already superseded'; END IF;
 END IF;
 INSERT INTO learned_policies(tenant_id,action_key,rule,rationale,source,coworker_id,
  scope_entity_type,scope_entity_id,proposal_type,scope,confidence,conflicts,affected_workers,authority,receipt_key)
 VALUES(t,p_policy->>'action_key',p_policy->>'rule',coalesce(p_policy->>'rationale',''),p_policy->>'source',
  p_policy->>'coworker_id',p_policy->>'scope_entity_type',(p_policy->>'scope_entity_id')::uuid,
  p_policy->>'proposal_type',nullif(p_policy->'scope','null'),p_policy->>'confidence',nullif(p_policy->'conflicts','null'),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(nullif(p_policy->'affected_workers','null'),'[]'))),
  coalesce(p_policy->>'authority','working'),p_receipt_key) RETURNING * INTO result;
 IF p_supersedes IS NOT NULL THEN
  UPDATE learned_policies SET superseded_at=now(),superseded_by=result.id WHERE tenant_id=t AND id=p_supersedes;
 END IF;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor,'learned_policy.recorded','learned_policy',result.id::text,'admin',
  jsonb_build_object('actionKey',result.action_key,'source',result.source,'supersedes',p_supersedes));
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.record_learned_policy(jsonb,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_learned_policy(jsonb,text,uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.approve_learning_proposal(p_proposal_id uuid,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); p learning_proposals; a action_queue; policy jsonb;
BEGIN
 SELECT * INTO p FROM learning_proposals WHERE tenant_id=t AND id=p_proposal_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Learning proposal not found'; END IF;
 SELECT * INTO a FROM action_queue WHERE tenant_id=t AND id=p.approval_action_id FOR SHARE;
 IF NOT FOUND OR a.action_type<>'approve_learning' OR a.payload->>'proposalId' IS DISTINCT FROM p.id::text
 OR a.status NOT IN ('executing','executed') OR a.approved_at IS NULL OR a.approved_by IS DISTINCT FROM p_actor
 THEN RAISE EXCEPTION 'Learning requires its human-approved action'; END IF;
 IF p.status='approved' THEN
  SELECT to_jsonb(lp) INTO policy FROM learned_policies lp WHERE tenant_id=t AND id=p.learned_policy_id;
  IF policy IS NULL THEN RAISE EXCEPTION 'Approved learning lost its policy record'; END IF;
  RETURN jsonb_build_object('proposal',to_jsonb(p),'policy',policy);
 END IF;
 IF p.status<>'proposed' OR a.status<>'executing' THEN RAISE EXCEPTION 'Only proposed learnings can be approved'; END IF;
 policy:=public.record_learned_policy(jsonb_build_object(
  'action_key','learning:'||p.id::text,'rule',p.rule,'rationale',p.rationale,'source','approved_learning',
  'proposal_type',p.proposal_type,'scope',p.scope,'confidence',p.confidence,'conflicts',p.conflicts,
  'affected_workers',to_jsonb(p.affected_workers),'authority','approved'),p_actor,p.supersedes_policy_id,'proposal:'||p.id::text);
 UPDATE learning_proposals SET status='approved',authority='approved',learned_policy_id=(policy->>'id')::uuid,decided_at=now()
 WHERE tenant_id=t AND id=p.id RETURNING * INTO p;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor,'learning.approved','learning_proposal',p.id::text,'admin',
  jsonb_build_object('policyId',policy->>'id','approvalActionId',a.id));
 RETURN jsonb_build_object('proposal',to_jsonb(p),'policy',policy);
END $$;
REVOKE ALL ON FUNCTION public.approve_learning_proposal(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_learning_proposal(uuid,text) TO authenticated,service_role;
COMMIT;
