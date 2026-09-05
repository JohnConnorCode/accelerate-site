-- Execution packets refine the existing work protocol; no card/status/claim is rewritten.
-- Release enforcement remains founder-controlled in work_board_settings.
BEGIN;
CREATE OR REPLACE FUNCTION public.work_packet_problems(s jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE reasons text[] := '{}'; k text;
BEGIN
 IF s->>'packetVersion' IS DISTINCT FROM '2' THEN reasons:=array_append(reasons,'missing_packet_version'); END IF;
 IF nullif(btrim(s->>'businessValue'),'') IS NULL THEN reasons:=array_append(reasons,'missing_business_value'); END IF;
 IF nullif(btrim(s->>'currentBehavior'),'') IS NULL THEN reasons:=array_append(reasons,'missing_current_behavior'); END IF;
 IF coalesce(s->'northstar'->>'phase','') NOT IN ('A','B','C','D','E') OR jsonb_typeof(s->'northstar'->'layers') IS DISTINCT FROM 'array' OR coalesce(s->'northstar'->'layers','[]')='[]'::jsonb OR nullif(btrim(s->'northstar'->>'contribution'),'') IS NULL THEN reasons:=array_append(reasons,'missing_northstar'); END IF;
 FOREACH k IN ARRAY ARRAY['scope','exclusions','references','verification','workflow','failureModes','acceptance'] LOOP
  IF jsonb_typeof(s->k) IS DISTINCT FROM 'array' OR s->k='[]'::jsonb THEN reasons:=array_append(reasons,'missing_'||k); END IF;
 END LOOP;
 IF jsonb_typeof(s->'requiredCapabilities') IS DISTINCT FROM 'array' THEN reasons:=array_append(reasons,'missing_required_capabilities'); END IF;
 IF coalesce(s->'repository'->>'baseCommit','') !~ '^[a-f0-9]{40}$' OR nullif(btrim(s->'repository'->>'baseBranch'),'') IS NULL OR nullif(btrim(s->'repository'->>'url'),'') IS NULL THEN reasons:=array_append(reasons,'missing_repository'); END IF;
 IF jsonb_typeof(s->'acceptance')='array' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'acceptance') a WHERE nullif(btrim(a->>'id'),'') IS NULL OR nullif(btrim(a->>'criterion'),'') IS NULL OR coalesce(a->>'environment','') NOT IN ('local','controlled-integration','production','observation')) OR (SELECT count(*)<>count(DISTINCT a->>'id') FROM jsonb_array_elements(s->'acceptance') a) THEN reasons:=array_append(reasons,'invalid_acceptance_ids_or_environment'); END IF;
 END IF;
 IF jsonb_typeof(s->'verification')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'verification') v WHERE nullif(btrim(v->>'command'),'') IS NULL OR nullif(btrim(v->>'expected'),'') IS NULL OR coalesce(v->>'environment','') NOT IN ('local','controlled-integration','production','observation')) THEN reasons:=array_append(reasons,'invalid_verification'); END IF;
 IF jsonb_typeof(s->'references')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'references') r WHERE nullif(btrim(r->>'path'),'') IS NULL OR nullif(btrim(r->>'reason'),'') IS NULL) THEN reasons:=array_append(reasons,'invalid_references'); END IF;
 FOREACH k IN ARRAY ARRAY['scope','exclusions','workflow','failureModes'] LOOP
  IF jsonb_typeof(s->k)='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->k) v WHERE jsonb_typeof(v)<>'string' OR nullif(btrim(v#>>'{}'),'') IS NULL) THEN reasons:=array_append(reasons,'invalid_'||k); END IF;
 END LOOP;
 IF jsonb_typeof(s->'northstar'->'layers')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s->'northstar'->'layers') l WHERE l NOT IN ('See','Remember','Notice','Act','Learn')) THEN reasons:=array_append(reasons,'invalid_northstar_layers'); END IF;
 RETURN reasons;
END $$;
REVOKE ALL ON FUNCTION public.work_packet_problems(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_packet_problems(jsonb) TO service_role;
CREATE OR REPLACE VIEW public.work_board_ordered_cards WITH (security_invoker=true) AS
 SELECT f.*, CASE WHEN 'milestone:now'=ANY(labels) THEN 0 WHEN 'milestone:next'=ANY(labels) THEN 1 ELSE 2 END AS horizon_rank,
 CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END AS priority_rank
 FROM public.feature_requests f;
REVOKE ALL ON public.work_board_ordered_cards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.work_board_ordered_cards TO service_role;

CREATE OR REPLACE FUNCTION public.work_board_readiness(p_id uuid) RETURNS text[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT array_remove(ARRAY[
 CASE WHEN c.archived_at IS NOT NULL THEN 'archived' END,
 CASE WHEN c.status NOT IN ('backlog','planned') THEN 'status:'||c.status END,
 CASE WHEN nullif(btrim(c.description),'') IS NULL THEN 'missing_outcome' END,
 CASE WHEN nullif(btrim(c.acceptance_criteria),'') IS NULL THEN 'missing_acceptance' END,
 CASE WHEN c.work_kind='initiative' THEN 'initiative_not_executable' END,
 CASE WHEN nullif(btrim(c.work_blocker),'') IS NOT NULL THEN 'blocker:'||c.work_blocker END,
 CASE WHEN jsonb_array_length(coalesce(nullif(c.work_spec->'unresolvedDependencies','null'::jsonb),'[]'))>0 THEN 'unresolved_dependencies' END,
 CASE WHEN EXISTS(SELECT 1 FROM feature_dependencies e JOIN feature_requests d ON d.id=e.depends_on_id WHERE e.card_id=c.id AND (d.status<>'shipped' OR d.archived_at IS NOT NULL)) THEN 'dependencies_incomplete' END,
 CASE WHEN c.lease_expires_at>now() THEN 'already_claimed' END
 ],NULL) || CASE WHEN c.work_kind IN ('feature','bug') THEN public.work_packet_problems(c.work_spec) ELSE ARRAY[]::text[] END FROM feature_requests c WHERE c.id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.mutate_work_board(p_actor text, p_operation text, p_id uuid, p_expected_revision bigint, p_request_key uuid, p_request_hash text, p_payload jsonb, p_projects text[], p_reviewer boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c feature_requests; old feature_requests; ev work_board_events; dep uuid; reasons text[]; result jsonb; target text;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL OR p_request_key IS NULL OR p_projects IS NULL OR cardinality(p_projects)=0 THEN RAISE EXCEPTION 'Invalid actor or scope'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('work-board',0));
 SELECT * INTO ev FROM work_board_events WHERE actor=p_actor AND request_key=p_request_key;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM feature_requests WHERE id=ev.card_id AND (project_key=ANY(p_projects) OR '*'=ANY(p_projects))) THEN RAISE EXCEPTION 'Project denied' USING ERRCODE='42501'; END IF;
  IF ev.request_hash<>p_request_hash THEN RAISE EXCEPTION 'Idempotency key reused with different input' USING ERRCODE='23505'; END IF;
  RETURN ev.payload || jsonb_build_object('replayed',true);
 END IF;
 PERFORM set_config('accelerate.work_board_mutation','on',true);
 IF p_operation='create' THEN
  IF NOT (p_payload->>'project_key'=ANY(p_projects) OR '*'=ANY(p_projects)) THEN RAISE EXCEPTION 'Project denied' USING ERRCODE='42501'; END IF;
  INSERT INTO feature_requests(title,description,acceptance_criteria,notes,priority,labels,status,seed_key,source,project_key,initiative,work_kind,work_spec,sort_order,owner,target_date,subtasks,parent_id,dependencies_migrated)
  VALUES(p_payload->>'title',p_payload->>'description',p_payload->>'acceptance_criteria',p_payload->>'notes',coalesce(p_payload->>'priority','medium'),ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'labels','[]'))),'backlog',p_payload->>'seed_key','work-board',p_payload->>'project_key',coalesce(p_payload->>'initiative',''),coalesce(p_payload->>'work_kind','feature'),coalesce(p_payload->'work_spec','{}'),coalesce((SELECT max(sort_order)+1000 FROM feature_requests),1000),p_payload->>'owner',nullif(p_payload->>'target_date','')::date,coalesce(p_payload->'subtasks','[]'),nullif(p_payload->>'parent_id','')::uuid,true) RETURNING * INTO c;
  IF c.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM feature_requests WHERE id=c.parent_id AND project_key=c.project_key AND archived_at IS NULL) THEN RAISE EXCEPTION 'Invalid parent'; END IF;
 ELSE
  IF p_operation='claim' AND p_id IS NULL THEN
   SELECT * INTO c FROM feature_requests f WHERE (f.project_key=ANY(p_projects) OR '*'=ANY(p_projects))
    AND cardinality(work_board_readiness(f.id))=0
    AND (coalesce(p_payload->'worker_capabilities','[]') ? '*' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(f.work_spec->'requiredCapabilities','[]')) required WHERE NOT (coalesce(p_payload->'worker_capabilities','[]') ? required))) AND ('milestone:now'=ANY(f.labels) OR 'milestone:next'=ANY(f.labels))
    ORDER BY CASE WHEN 'milestone:now'=ANY(f.labels) THEN 0 ELSE 1 END, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,sort_order,id LIMIT 1 FOR UPDATE;
  ELSE SELECT * INTO c FROM feature_requests WHERE id=p_id FOR UPDATE; END IF;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Work not found or no ready work' USING ERRCODE='P0002'; END IF;
  IF NOT (c.project_key=ANY(p_projects) OR '*'=ANY(p_projects)) THEN RAISE EXCEPTION 'Project denied' USING ERRCODE='42501'; END IF;
  old:=c;
  IF p_operation NOT IN ('claim','heartbeat','progress','block','release','submit') AND (p_expected_revision IS NULL OR c.revision<>p_expected_revision) THEN RAISE EXCEPTION 'Revision conflict; refresh before editing' USING ERRCODE='PT409'; END IF;
  IF p_operation IN ('heartbeat','progress','block','release','submit') THEN
   IF c.lease_owner IS DISTINCT FROM p_actor OR c.claim_token_hash IS DISTINCT FROM p_payload->>'claim_token_hash' OR c.lease_expires_at IS NULL OR c.lease_expires_at<=now() OR c.status<>'in_progress' THEN RAISE EXCEPTION 'Claim expired or session does not own this work' USING ERRCODE='42501'; END IF;
  END IF;
  IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Archived work is read only'; END IF;
  IF p_operation='edit' THEN
   IF c.status IN ('in_progress','in_review','shipped') AND (p_payload ? 'description' OR p_payload ? 'acceptance_criteria' OR p_payload ? 'work_spec' OR p_payload ? 'work_kind' OR p_payload ? 'parent_id') THEN RAISE EXCEPTION 'Release or reopen before changing the execution specification'; END IF;
   c.title:=coalesce(p_payload->>'title',c.title);
   IF p_payload ? 'description' THEN c.description:=p_payload->>'description'; END IF;
   IF p_payload ? 'notes' THEN c.notes:=p_payload->>'notes'; END IF;
   IF p_payload ? 'acceptance_criteria' THEN c.acceptance_criteria:=p_payload->>'acceptance_criteria'; END IF;
   IF p_payload ? 'owner' THEN c.owner:=p_payload->>'owner'; END IF;
   IF p_payload ? 'target_date' THEN c.target_date:=nullif(p_payload->>'target_date','')::date; END IF;
   IF p_payload ? 'priority' THEN c.priority:=p_payload->>'priority'; END IF;
   IF p_payload ? 'labels' THEN c.labels:=ARRAY(SELECT jsonb_array_elements_text(p_payload->'labels')); END IF;
   IF p_payload ? 'subtasks' THEN c.subtasks:=p_payload->'subtasks'; END IF;
   IF p_payload ? 'initiative' THEN c.initiative:=p_payload->>'initiative'; END IF;
   IF p_payload ? 'work_kind' THEN c.work_kind:=p_payload->>'work_kind'; END IF;
   IF p_payload ? 'work_spec' THEN c.work_spec:=p_payload->'work_spec'; END IF;
   IF p_payload ? 'sort_order' THEN c.sort_order:=(p_payload->>'sort_order')::numeric; END IF;
   IF p_payload ? 'parent_id' THEN
    c.parent_id:=nullif(p_payload->>'parent_id','')::uuid;
    IF c.parent_id=c.id OR (c.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM feature_requests f WHERE f.id=c.parent_id AND f.project_key=c.project_key)) THEN RAISE EXCEPTION 'Invalid parent'; END IF;
    IF EXISTS(WITH RECURSIVE parents AS(SELECT id,parent_id FROM feature_requests WHERE id=c.parent_id UNION SELECT f.id,f.parent_id FROM feature_requests f JOIN parents p ON f.id=p.parent_id) SELECT 1 FROM parents WHERE id=c.id) THEN RAISE EXCEPTION 'Parent cycle'; END IF;
   END IF;
  ELSIF p_operation='dependencies' THEN
   IF c.status NOT IN ('backlog','planned','blocked') THEN RAISE EXCEPTION 'Release work before changing dependencies'; END IF;
   DELETE FROM feature_dependencies WHERE card_id=c.id;
   FOR dep IN SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'dependencies') LOOP
    IF dep=c.id OR NOT EXISTS(SELECT 1 FROM feature_requests WHERE id=dep AND project_key=c.project_key AND archived_at IS NULL) THEN RAISE EXCEPTION 'Invalid dependency'; END IF;
    INSERT INTO feature_dependencies VALUES(c.id,dep) ON CONFLICT DO NOTHING;
   END LOOP;
   IF EXISTS(WITH RECURSIVE edges AS(SELECT depends_on_id FROM feature_dependencies WHERE card_id=c.id UNION SELECT e.depends_on_id FROM feature_dependencies e JOIN edges d ON e.card_id=d.depends_on_id) SELECT 1 FROM edges WHERE depends_on_id=c.id) THEN RAISE EXCEPTION 'Dependency cycle'; END IF;
   c.work_spec:=c.work_spec-'unresolvedDependencies';
  ELSIF p_operation='claim' THEN
   reasons:=work_board_readiness(c.id);
   IF NOT (coalesce(p_payload->'worker_capabilities','[]') ? '*') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(c.work_spec->'requiredCapabilities','[]')) required WHERE NOT (coalesce(p_payload->'worker_capabilities','[]') ? required)) THEN RAISE EXCEPTION 'Worker lacks required capabilities'; END IF;
   IF cardinality(reasons)>0 THEN RAISE EXCEPTION 'Not ready: %',array_to_string(reasons,', ') USING ERRCODE='PT409'; END IF;
   IF (SELECT count(*) FROM feature_requests WHERE status='in_progress' AND archived_at IS NULL)>=6 THEN RAISE EXCEPTION 'WIP limit reached; review stale claims first'; END IF;
   IF nullif(p_payload->>'claim_token_hash','') IS NULL THEN RAISE EXCEPTION 'Claim token required'; END IF;
   c.status:='in_progress'; c.owner:=p_actor; c.lease_owner:=p_actor; c.claim_token_hash:=p_payload->>'claim_token_hash';c.claimed_at:=now();c.lease_expires_at:=now()+interval '30 minutes';
  ELSIF p_operation='heartbeat' THEN c.lease_expires_at:=now()+interval '30 minutes';
  ELSIF p_operation='progress' THEN NULL;
  ELSIF p_operation='block' THEN c.status:='blocked';c.work_blocker:=p_payload->>'message';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='release' THEN c.status:='planned';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='submit' THEN
   IF c.work_spec->>'packetVersion'='2' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(c.work_spec->'acceptance','[]')) criterion
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p_payload->'evidence'->'checks','[]')) check_item
     WHERE check_item->>'acceptanceId'=criterion->>'id' AND check_item->>'status'='passed'
     AND nullif(btrim(check_item->>'evidence'),'') IS NOT NULL
     AND check_item->>'environment'=criterion->>'environment'))
    THEN RAISE EXCEPTION 'Every acceptance criterion requires passing evidence in its required environment'; END IF;

   IF jsonb_array_length(coalesce(p_payload->'evidence'->'checks','[]'))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence'->'checks') x WHERE x->>'status' IS DISTINCT FROM 'passed') THEN RAISE EXCEPTION 'Passing verification evidence required'; END IF;
   IF c.work_kind IN ('feature','bug') AND coalesce(p_payload->'evidence'->>'commitSha','') !~ '^[a-f0-9]{40}$' THEN RAISE EXCEPTION 'Exact implementation commit required'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(c.work_spec->'acceptance','[]')) criterion WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence'->'checks') check_item WHERE check_item->>'acceptanceId'=criterion->>'id')) THEN RAISE EXCEPTION 'Every acceptance criterion requires verification evidence'; END IF;
   c.work_delivery:=(p_payload->'evidence')||jsonb_build_object('submittedBy',p_actor,'submittedAt',now());c.status:='in_review';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='delivery' THEN
   IF NOT p_reviewer OR c.status<>'shipped' THEN RAISE EXCEPTION 'Delivery facts require accepted work and review authority' USING ERRCODE='42501'; END IF;
   c.work_delivery:=c.work_delivery||(p_payload-'message')||jsonb_build_object('deliveryRecordedBy',p_actor);
  ELSIF p_operation='review' THEN
   IF NOT p_reviewer OR (c.status<>'in_review' AND NOT (c.work_kind='initiative' AND c.status IN ('backlog','planned','blocked'))) THEN RAISE EXCEPTION 'Review authority and submitted work or initiative required' USING ERRCODE='42501'; END IF;
   IF c.work_kind='initiative' AND ((SELECT count(*) FROM feature_dependencies WHERE card_id=c.id)=0 OR EXISTS(SELECT 1 FROM feature_dependencies e JOIN feature_requests d ON d.id=e.depends_on_id WHERE e.card_id=c.id AND (d.status<>'shipped' OR d.archived_at IS NOT NULL))) THEN RAISE EXCEPTION 'Initiative requires verified children before review'; END IF;
   IF p_actor=c.owner AND coalesce(length(p_payload->>'message'),0)<10 THEN RAISE EXCEPTION 'Self-review requires an explicit recorded override reason'; END IF;
   IF (p_payload->>'accept')::boolean THEN c.status:='shipped';c.work_delivery:=c.work_delivery||jsonb_build_object('reviewer',p_actor,'reviewedAt',now());
   ELSE c.status:='planned';c.work_blocker:=p_payload->>'message'; END IF;
  ELSIF p_operation='transition' THEN
   target:=p_payload->>'status';
   IF target NOT IN ('backlog','planned','blocked') OR c.status IN ('in_progress','in_review','shipped') THEN RAISE EXCEPTION 'Use claim, submit, review or reopen for execution transitions'; END IF;
   c.status:=target;c.work_blocker:=CASE WHEN target='blocked' THEN p_payload->>'message' ELSE NULL END;
  ELSIF p_operation='recover' THEN
   IF NOT p_reviewer OR c.status<>'in_progress' OR c.lease_expires_at>now() THEN RAISE EXCEPTION 'Only a reviewer can recover an expired claim' USING ERRCODE='42501'; END IF;
   c.status:='blocked';c.work_blocker:=p_payload->>'message';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='reopen' THEN
   IF NOT p_reviewer OR c.status NOT IN ('shipped','in_review','blocked') THEN RAISE EXCEPTION 'Reopen requires review authority' USING ERRCODE='42501'; END IF;
   c.status:='planned';c.work_blocker:=NULL;
  ELSIF p_operation='archive' THEN
   IF NOT p_reviewer OR c.status IN ('in_progress','in_review') THEN RAISE EXCEPTION 'Release active work before archiving'; END IF;c.archived_at:=now();
  ELSE RAISE EXCEPTION 'Unknown work operation'; END IF;
  c.revision:=c.revision+1;
  UPDATE feature_requests SET title=c.title,description=c.description,notes=c.notes,acceptance_criteria=c.acceptance_criteria,
   status=c.status,priority=c.priority,labels=c.labels,owner=c.owner,target_date=c.target_date,subtasks=c.subtasks,initiative=c.initiative,parent_id=c.parent_id,work_kind=c.work_kind,work_spec=c.work_spec,work_delivery=c.work_delivery,work_blocker=c.work_blocker,sort_order=c.sort_order,
   revision=c.revision,lease_owner=c.lease_owner,lease_expires_at=c.lease_expires_at,claimed_at=c.claimed_at,claim_token_hash=c.claim_token_hash,archived_at=c.archived_at,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 END IF;
 result:=jsonb_build_object('card',to_jsonb(c)-'claim_token_hash','replayed',false);
 INSERT INTO work_board_events(card_id,actor,request_key,operation,request_hash,revision,payload)
 VALUES(c.id,p_actor,p_request_key,p_operation,p_request_hash,c.revision,result||jsonb_build_object('message',p_payload->>'message','before',CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old)-'claim_token_hash' END));
 RETURN result;
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
