-- Additive execution attempts. Opt-in is an audited, project-scoped operator action.
BEGIN;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS work_attempt_id uuid, ADD COLUMN IF NOT EXISTS work_checkpoint jsonb;
ALTER TABLE public.work_board_settings ADD COLUMN IF NOT EXISTS automatic_recovery_projects text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS public.work_board_attempts (
 id uuid PRIMARY KEY, card_id uuid NOT NULL REFERENCES public.feature_requests(id),
 predecessor_id uuid REFERENCES public.work_board_attempts(id), actor text NOT NULL,
 started_at timestamptz NOT NULL, ended_at timestamptz, terminal_reason text,
 UNIQUE(card_id,id)
);
DO $constraints$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.work_board_attempts'::regclass AND conname='work_attempt_predecessor_card') THEN
  ALTER TABLE public.work_board_attempts ADD CONSTRAINT work_attempt_predecessor_card FOREIGN KEY(card_id,predecessor_id) REFERENCES public.work_board_attempts(card_id,id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.feature_requests'::regclass AND conname='feature_work_attempt_card') THEN
  ALTER TABLE public.feature_requests ADD CONSTRAINT feature_work_attempt_card FOREIGN KEY(id,work_attempt_id) REFERENCES public.work_board_attempts(card_id,id);
 END IF;
END $constraints$;
ALTER TABLE public.work_board_attempts ADD COLUMN IF NOT EXISTS claim_token_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS work_board_attempt_token_once ON public.work_board_attempts(card_id,claim_token_hash);
ALTER TABLE public.work_board_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_board_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.work_board_attempts TO service_role;
CREATE INDEX IF NOT EXISTS work_board_attempts_card ON public.work_board_attempts(card_id,started_at);
-- Immutable event payloads retain every checkpoint and transition. Attempt rows only summarize lifecycle.
CREATE OR REPLACE FUNCTION public.work_board_attempt_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF coalesce(current_setting('accelerate.work_board_mutation',true),'')<>'on' THEN RAISE EXCEPTION 'Use canonical work operations' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attempt history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (OLD.ended_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.card_id<>OLD.card_id OR NEW.actor<>OLD.actor OR NEW.predecessor_id IS DISTINCT FROM OLD.predecessor_id OR NEW.started_at<>OLD.started_at OR NEW.claim_token_hash IS DISTINCT FROM OLD.claim_token_hash) THEN RAISE EXCEPTION 'Attempt identity and terminal state are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS work_board_attempt_guard ON public.work_board_attempts;
CREATE TRIGGER work_board_attempt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.work_board_attempts FOR EACH ROW EXECUTE FUNCTION public.work_board_attempt_guard();
DO $view$ DECLARE cols text; BEGIN
 SELECT string_agg('f.'||quote_ident(a.attname),',' ORDER BY a.attnum) INTO cols FROM pg_attribute a WHERE a.attrelid='public.work_board_ordered_cards'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname NOT IN ('horizon_rank','priority_rank','work_attempt_id','work_checkpoint');
 EXECUTE 'CREATE OR REPLACE VIEW public.work_board_ordered_cards WITH (security_invoker=true) AS SELECT '||cols||',CASE WHEN ''milestone:now''=ANY(f.labels) THEN 0 WHEN ''milestone:next''=ANY(f.labels) THEN 1 ELSE 2 END AS horizon_rank,CASE f.priority WHEN ''urgent'' THEN 0 WHEN ''high'' THEN 1 WHEN ''medium'' THEN 2 ELSE 3 END AS priority_rank,f.work_attempt_id,f.work_checkpoint FROM public.feature_requests f';
END $view$;
CREATE OR REPLACE FUNCTION public.work_board_resume_readiness_many(p_ids uuid[])
RETURNS TABLE(id uuid,reasons text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.id,array_remove(array_remove(work_board_readiness(f.id),'status:in_progress'),'already_claimed') || array_remove(ARRAY[
 CASE WHEN f.status<>'in_progress' OR f.lease_expires_at IS NULL OR f.lease_expires_at>now() THEN 'resume_requires_expired_lease' END,
 CASE WHEN f.work_checkpoint IS NULL OR f.work_checkpoint->>'baseCommit' IS DISTINCT FROM f.work_spec->'repository'->>'baseCommit' THEN 'missing_checkpoint' END,
 CASE WHEN NOT EXISTS(SELECT 1 FROM work_board_settings WHERE singleton AND f.project_key=ANY(automatic_recovery_projects)) THEN 'automatic_recovery_disabled' END
 ],NULL) FROM feature_requests f WHERE f.id=ANY(p_ids) LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.work_board_resume_readiness_many(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_board_resume_readiness_many(uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.mutate_work_board(p_actor text, p_operation text, p_id uuid, p_expected_revision bigint, p_request_key uuid, p_request_hash text, p_payload jsonb, p_projects text[], p_reviewer boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c feature_requests; old feature_requests; ev work_board_events; dep uuid; reasons text[]; result jsonb; target text; checkpoint jsonb; previous_attempt uuid; effective_now timestamptz;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL OR p_request_key IS NULL OR p_projects IS NULL OR cardinality(p_projects)=0 THEN RAISE EXCEPTION 'Invalid actor or scope'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('work-board',0));
 effective_now:=clock_timestamp();
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
  IF p_operation IN ('heartbeat','progress','block','release','submit','checkpoint') THEN
   IF c.lease_owner IS DISTINCT FROM p_actor OR c.claim_token_hash IS DISTINCT FROM p_payload->>'claim_token_hash' OR c.lease_expires_at IS NULL OR c.lease_expires_at<=effective_now OR c.status<>'in_progress' THEN RAISE EXCEPTION 'Claim expired or session does not own this work' USING ERRCODE='42501'; END IF;
  END IF;
  IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Archived work is read only'; END IF;
  -- Upgrade legacy sessions before checkpoint publication or any terminal transition.
  IF c.work_attempt_id IS NULL AND c.claim_token_hash IS NOT NULL AND p_operation IN ('heartbeat','block','release','submit','recover') THEN
   c.work_attempt_id:=gen_random_uuid();
   INSERT INTO work_board_attempts(id,card_id,predecessor_id,actor,started_at,claim_token_hash) VALUES(c.work_attempt_id,c.id,NULL,c.lease_owner,coalesce(c.claimed_at,effective_now),c.claim_token_hash);
  END IF;
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
  ELSIF p_operation='recovery-policy' THEN
   IF NOT p_reviewer THEN RAISE EXCEPTION 'Recovery policy requires operator authority' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(p_payload->'enabled') IS DISTINCT FROM 'boolean' OR length(coalesce(p_payload->>'message',''))<10 THEN RAISE EXCEPTION 'Policy decision and reason required'; END IF;
   UPDATE work_board_settings SET automatic_recovery_projects=CASE WHEN (p_payload->>'enabled')::boolean THEN ARRAY(SELECT DISTINCT unnest(automatic_recovery_projects||ARRAY[c.project_key])) ELSE array_remove(automatic_recovery_projects,c.project_key) END WHERE singleton;
  ELSIF p_operation='checkpoint' THEN
   checkpoint:=p_payload->'checkpoint';
   IF jsonb_typeof(checkpoint) IS DISTINCT FROM 'object' OR coalesce(checkpoint->>'commitSha','') !~ '^[a-f0-9]{40}$' OR checkpoint->>'baseCommit' IS DISTINCT FROM c.work_spec->'repository'->>'baseCommit' OR coalesce(checkpoint->>'baseCommit','') !~ '^[a-f0-9]{40}$' OR length(coalesce(checkpoint->>'branch','')) NOT BETWEEN 1 AND 500 OR length(coalesce(checkpoint->>'summary','')) NOT BETWEEN 10 AND 10000 THEN RAISE EXCEPTION 'Invalid checkpoint source or summary'; END IF;
   FOREACH target IN ARRAY ARRAY['completed','remaining','artifacts'] LOOP
    IF jsonb_typeof(checkpoint->target) IS DISTINCT FROM 'array' OR jsonb_array_length(checkpoint->target)>100 THEN RAISE EXCEPTION 'Invalid checkpoint list'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(checkpoint->target) item WHERE jsonb_typeof(item)<>'string' OR length(item#>>'{}')>500) THEN RAISE EXCEPTION 'Invalid checkpoint item'; END IF;
   END LOOP;
   IF c.work_attempt_id IS NULL THEN RAISE EXCEPTION 'Heartbeat required to adopt legacy attempt before checkpoint'; END IF;
   IF checkpoint->>'branch' !~ ('^agent/checkpoints/'||c.id::text||'/'||c.work_attempt_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Checkpoint branch must belong to this card and attempt'; END IF;
   c.work_checkpoint:=checkpoint||jsonb_build_object('id',gen_random_uuid(),'attemptId',c.work_attempt_id,'createdAt',effective_now);
  ELSIF p_operation='claim' OR p_operation='resume' THEN
   reasons:=work_board_readiness(c.id);
   IF p_operation='resume' THEN
    IF NOT EXISTS(SELECT 1 FROM work_board_settings WHERE singleton AND c.project_key=ANY(automatic_recovery_projects)) THEN RAISE EXCEPTION 'Automatic recovery is disabled for this project' USING ERRCODE='42501'; END IF;
    IF c.status<>'in_progress' OR c.lease_expires_at IS NULL OR c.lease_expires_at>effective_now THEN RAISE EXCEPTION 'Resume requires an expired execution lease' USING ERRCODE='PT409'; END IF;
    IF c.work_checkpoint IS NULL OR c.work_checkpoint->>'baseCommit' IS DISTINCT FROM c.work_spec->'repository'->>'baseCommit' THEN RAISE EXCEPTION 'Missing checkpoint; needs reconciliation' USING ERRCODE='PT409'; END IF;
    IF p_payload ? 'checkpointId' AND p_payload->>'checkpointId' IS DISTINCT FROM c.work_checkpoint->>'id' THEN RAISE EXCEPTION 'Checkpoint changed; refresh before resuming' USING ERRCODE='PT409'; END IF;
    reasons:=array_remove(reasons,'status:in_progress');
    reasons:=array_remove(reasons,'already_claimed');
   END IF;
   IF NOT (coalesce(p_payload->'worker_capabilities','[]') ? '*') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(c.work_spec->'requiredCapabilities','[]')) required WHERE NOT (coalesce(p_payload->'worker_capabilities','[]') ? required)) THEN RAISE EXCEPTION 'Worker lacks required capabilities'; END IF;
   IF cardinality(reasons)>0 THEN RAISE EXCEPTION 'Not ready: %',array_to_string(reasons,', ') USING ERRCODE='PT409'; END IF;
   IF (SELECT count(*) FROM feature_requests WHERE status='in_progress' AND archived_at IS NULL AND lease_expires_at>effective_now)>=6 THEN RAISE EXCEPTION 'Active WIP limit reached'; END IF;
   IF nullif(p_payload->>'claim_token_hash','') IS NULL THEN RAISE EXCEPTION 'Claim token required'; END IF;
   IF c.claim_token_hash IS NOT DISTINCT FROM p_payload->>'claim_token_hash' OR EXISTS(SELECT 1 FROM work_board_attempts WHERE card_id=c.id AND claim_token_hash=p_payload->>'claim_token_hash') THEN RAISE EXCEPTION 'Successor must rotate the claim token' USING ERRCODE='42501'; END IF;
   previous_attempt:=c.work_attempt_id;
   IF previous_attempt IS NOT NULL THEN UPDATE work_board_attempts SET ended_at=coalesce(ended_at,effective_now),terminal_reason=coalesce(terminal_reason,'expired') WHERE id=previous_attempt AND ended_at IS NULL; END IF;
   c.work_attempt_id:=gen_random_uuid();
   INSERT INTO work_board_attempts(id,card_id,predecessor_id,actor,started_at,claim_token_hash) VALUES(c.work_attempt_id,c.id,previous_attempt,p_actor,effective_now,p_payload->>'claim_token_hash');
   c.status:='in_progress'; c.owner:=p_actor; c.lease_owner:=p_actor; c.claim_token_hash:=p_payload->>'claim_token_hash';c.claimed_at:=effective_now;c.lease_expires_at:=effective_now+interval '30 minutes';
  ELSIF p_operation='heartbeat' THEN c.lease_expires_at:=effective_now+interval '30 minutes';
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
   c.work_delivery:=(p_payload->'evidence')||jsonb_build_object('submittedBy',p_actor,'submittedAt',effective_now);c.status:='in_review';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='delivery' THEN
   IF NOT p_reviewer OR c.status<>'shipped' THEN RAISE EXCEPTION 'Delivery facts require accepted work and review authority' USING ERRCODE='42501'; END IF;
   c.work_delivery:=c.work_delivery||(p_payload-'message')||jsonb_build_object('deliveryRecordedBy',p_actor);
  ELSIF p_operation='review' THEN
   IF NOT p_reviewer OR (c.status<>'in_review' AND NOT (c.work_kind='initiative' AND c.status IN ('backlog','planned','blocked'))) THEN RAISE EXCEPTION 'Review authority and submitted work or initiative required' USING ERRCODE='42501'; END IF;
   IF c.work_kind='initiative' AND ((SELECT count(*) FROM feature_dependencies WHERE card_id=c.id)=0 OR EXISTS(SELECT 1 FROM feature_dependencies e JOIN feature_requests d ON d.id=e.depends_on_id WHERE e.card_id=c.id AND (d.status<>'shipped' OR d.archived_at IS NOT NULL))) THEN RAISE EXCEPTION 'Initiative requires verified children before review'; END IF;
   IF p_actor=c.owner AND coalesce(length(p_payload->>'message'),0)<10 THEN RAISE EXCEPTION 'Self-review requires an explicit recorded override reason'; END IF;
   IF (p_payload->>'accept')::boolean THEN c.status:='shipped';c.work_delivery:=c.work_delivery||jsonb_build_object('reviewer',p_actor,'reviewedAt',effective_now);
   ELSE c.status:='planned';c.work_blocker:=p_payload->>'message'; END IF;
  ELSIF p_operation='transition' THEN
   target:=p_payload->>'status';
   IF target NOT IN ('backlog','planned','blocked') OR c.status IN ('in_progress','in_review','shipped') THEN RAISE EXCEPTION 'Use claim, submit, review or reopen for execution transitions'; END IF;
   c.status:=target;c.work_blocker:=CASE WHEN target='blocked' THEN p_payload->>'message' ELSE NULL END;
  ELSIF p_operation='recover' THEN
   IF NOT p_reviewer OR c.status<>'in_progress' OR c.lease_expires_at>effective_now THEN RAISE EXCEPTION 'Only a reviewer can recover an expired claim' USING ERRCODE='42501'; END IF;
   c.status:='blocked';c.work_blocker:=p_payload->>'message';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='reopen' THEN
   IF NOT p_reviewer OR c.status NOT IN ('shipped','in_review','blocked') THEN RAISE EXCEPTION 'Reopen requires review authority' USING ERRCODE='42501'; END IF;
   c.status:='planned';c.work_blocker:=NULL;
  ELSIF p_operation='archive' THEN
   IF NOT p_reviewer OR c.status IN ('in_progress','in_review') THEN RAISE EXCEPTION 'Release active work before archiving'; END IF;c.archived_at:=effective_now;
  ELSE RAISE EXCEPTION 'Unknown work operation'; END IF;
  IF p_operation IN ('block','release','submit','recover') AND c.work_attempt_id IS NOT NULL THEN
   UPDATE work_board_attempts SET ended_at=coalesce(ended_at,effective_now),terminal_reason=coalesce(terminal_reason,p_operation) WHERE id=c.work_attempt_id AND ended_at IS NULL;
  END IF;
  c.revision:=c.revision+1;
  UPDATE feature_requests SET title=c.title,description=c.description,notes=c.notes,acceptance_criteria=c.acceptance_criteria,
   status=c.status,priority=c.priority,labels=c.labels,owner=c.owner,target_date=c.target_date,subtasks=c.subtasks,initiative=c.initiative,parent_id=c.parent_id,work_kind=c.work_kind,work_spec=c.work_spec,work_delivery=c.work_delivery,work_blocker=c.work_blocker,sort_order=c.sort_order,
   work_attempt_id=c.work_attempt_id,work_checkpoint=c.work_checkpoint,revision=c.revision,lease_owner=c.lease_owner,lease_expires_at=c.lease_expires_at,claimed_at=c.claimed_at,claim_token_hash=c.claim_token_hash,archived_at=c.archived_at,updated_at=effective_now WHERE id=c.id RETURNING * INTO c;
 END IF;
 result:=jsonb_build_object('card',to_jsonb(c)-'claim_token_hash','replayed',false,'resumableAttempts',jsonb_build_object('version',1));
 INSERT INTO work_board_events(card_id,actor,request_key,operation,request_hash,revision,payload)
 VALUES(c.id,p_actor,p_request_key,p_operation,p_request_hash,c.revision,result||jsonb_build_object('message',p_payload->>'message','policyEnabled',p_payload->'enabled','before',CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old)-'claim_token_hash' END));
 RETURN result;
END $function$;


NOTIFY pgrst, 'reload schema';
COMMIT;
