BEGIN;
SELECT set_config('accelerate.work_board_mutation','on',true);
ALTER TABLE public.feature_requests
 ADD COLUMN IF NOT EXISTS dependencies_migrated boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS project_key text NOT NULL DEFAULT 'accelerate',
 ADD COLUMN IF NOT EXISTS initiative text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.feature_requests(id),
 ADD COLUMN IF NOT EXISTS work_kind text NOT NULL DEFAULT 'feature',
 ADD COLUMN IF NOT EXISTS work_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS work_delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS work_blocker text,
 ADD COLUMN IF NOT EXISTS claim_token_hash text;
CREATE TABLE IF NOT EXISTS public.feature_dependencies (
 card_id uuid NOT NULL REFERENCES public.feature_requests(id),
 depends_on_id uuid NOT NULL REFERENCES public.feature_requests(id),
 PRIMARY KEY(card_id, depends_on_id), CHECK(card_id <> depends_on_id)
);
CREATE TABLE IF NOT EXISTS public.work_board_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), card_id uuid REFERENCES public.feature_requests(id),
 actor text NOT NULL, request_key uuid NOT NULL, operation text NOT NULL,
 request_hash text NOT NULL, revision bigint, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor,request_key)
);
CREATE INDEX IF NOT EXISTS work_board_events_card ON public.work_board_events(card_id,created_at DESC);
CREATE INDEX IF NOT EXISTS feature_dependencies_reverse ON public.feature_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS feature_requests_project ON public.feature_requests(project_key,status,sort_order) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS public.work_board_agents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 token_hash text NOT NULL UNIQUE, scopes text[] NOT NULL, projects text[] NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
-- Release switch: applying additive schema must not break an older deployed app.
CREATE TABLE IF NOT EXISTS public.work_board_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enforce_writes boolean NOT NULL DEFAULT false
);
INSERT INTO public.work_board_settings VALUES(true,false) ON CONFLICT DO NOTHING;
ALTER TABLE public.work_board_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_board_settings FROM anon,authenticated;
GRANT ALL ON public.work_board_settings TO service_role;
ALTER TABLE public.work_board_agents ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS public.work_board_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner text NOT NULL,
 shared boolean NOT NULL DEFAULT false, filters jsonb NOT NULL DEFAULT '{}',
 revision bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_board_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_board_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_board_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_dependencies,public.work_board_events,public.work_board_agents,public.work_board_views FROM anon,authenticated;
GRANT ALL ON public.feature_dependencies,public.work_board_events,public.work_board_agents,public.work_board_views TO service_role;
-- Exact title references are imported once. Unresolved legacy references prevent readiness.
INSERT INTO public.feature_dependencies(card_id,depends_on_id)
 SELECT DISTINCT c.id,d.id FROM public.feature_requests c
 CROSS JOIN LATERAL regexp_match(c.notes,'Dependencies: ([^\n]+)') m
 CROSS JOIN LATERAL regexp_split_to_table(m[1],';') AS refs(ref_title)
 JOIN public.feature_requests d ON d.title=btrim(refs.ref_title)
 WHERE NOT c.dependencies_migrated AND c.id<>d.id AND refs.ref_title NOT LIKE 'None%' AND (SELECT count(*) FROM public.feature_requests x WHERE x.title=btrim(refs.ref_title))=1
 ON CONFLICT DO NOTHING;
UPDATE public.feature_requests c SET work_spec = work_spec || jsonb_build_object('unresolvedDependencies',
 (SELECT jsonb_agg(btrim(refs.ref_title)) FROM regexp_matches(c.notes,'Dependencies: ([^\n]+)') m
 CROSS JOIN LATERAL regexp_split_to_table(m[1],';') AS refs(ref_title)
 WHERE refs.ref_title NOT LIKE 'None%' AND (SELECT count(*) FROM public.feature_requests x WHERE x.title=btrim(refs.ref_title))<>1))
 WHERE NOT dependencies_migrated AND NOT work_spec ? 'unresolvedDependencies';
UPDATE public.feature_requests SET dependencies_migrated=true WHERE NOT dependencies_migrated;
INSERT INTO public.kanban_columns(tenant_id,board_key,column_key,label,color,sort_order,is_default,metadata)
 SELECT NULL,'features','in_review','In review','bg-violet-500',4500,true,'{}'
 WHERE NOT EXISTS(SELECT 1 FROM public.kanban_columns WHERE board_key='features' AND tenant_id IS NULL AND column_key='in_review');
UPDATE public.kanban_columns SET label='Verified' WHERE board_key='features' AND tenant_id IS NULL AND column_key='shipped' AND label='Shipped' AND is_default;
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
 ],NULL) FROM feature_requests c WHERE c.id=p_id;
$$;
CREATE OR REPLACE FUNCTION public.work_board_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT enforce_writes FROM public.work_board_settings WHERE singleton) AND coalesce(current_setting('accelerate.work_board_mutation',true),'')<>'on' THEN
  RAISE EXCEPTION 'Use the canonical work board mutation service' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='feature_requests' AND TG_OP='UPDATE' AND coalesce(current_setting('accelerate.work_board_mutation',true),'')<>'on' THEN NEW.revision:=OLD.revision+1; END IF;
 RETURN NEW;
END $$;
-- No direct application writes may bypass revision, dependency or lifecycle checks.
DROP TRIGGER IF EXISTS work_board_write_guard ON public.feature_requests;
CREATE TRIGGER work_board_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.feature_requests FOR EACH ROW EXECUTE FUNCTION public.work_board_guard();
DROP TRIGGER IF EXISTS work_dependency_write_guard ON public.feature_dependencies;
CREATE TRIGGER work_dependency_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.feature_dependencies FOR EACH ROW EXECUTE FUNCTION public.work_board_guard();
CREATE OR REPLACE FUNCTION public.work_board_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Work history is immutable'; END $$;
DROP TRIGGER IF EXISTS work_events_immutable ON public.work_board_events;
CREATE TRIGGER work_events_immutable BEFORE UPDATE OR DELETE ON public.work_board_events FOR EACH ROW EXECUTE FUNCTION public.work_board_immutable();
CREATE OR REPLACE FUNCTION public.mutate_work_board(
 p_actor text,p_operation text,p_id uuid,p_expected_revision bigint,p_request_key uuid,
 p_request_hash text,p_payload jsonb,p_projects text[],p_reviewer boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,sort_order,id LIMIT 1 FOR UPDATE;
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
   IF jsonb_array_length(coalesce(p_payload->'evidence'->'checks','[]'))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence'->'checks') x WHERE x->>'status' IS DISTINCT FROM 'passed') THEN RAISE EXCEPTION 'Passing verification evidence required'; END IF;
   IF c.work_kind IN ('feature','bug') AND coalesce(p_payload->'evidence'->>'commitSha','') !~ '^[a-f0-9]{40}$' THEN RAISE EXCEPTION 'Exact implementation commit required'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(c.work_spec->'acceptance','[]')) criterion WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence'->'checks') check_item WHERE check_item->>'acceptanceId'=criterion->>'id')) THEN RAISE EXCEPTION 'Every acceptance criterion requires verification evidence'; END IF;
   c.work_delivery:=(p_payload->'evidence')||jsonb_build_object('submittedBy',p_actor,'submittedAt',now());c.status:='in_review';c.lease_owner:=NULL;c.lease_expires_at:=NULL;c.claim_token_hash:=NULL;
  ELSIF p_operation='delivery' THEN
   IF NOT p_reviewer OR c.status<>'shipped' THEN RAISE EXCEPTION 'Delivery facts require accepted work and review authority' USING ERRCODE='42501'; END IF;
   c.work_delivery:=c.work_delivery||(p_payload-'message')||jsonb_build_object('deliveryRecordedBy',p_actor);
  ELSIF p_operation='review' THEN
   IF NOT p_reviewer OR c.status<>'in_review' THEN RAISE EXCEPTION 'Review authority and submitted work required' USING ERRCODE='42501'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean) TO service_role;
REVOKE ALL ON FUNCTION public.work_board_readiness(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_board_readiness(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.work_board_readiness_many(p_ids uuid[])
RETURNS TABLE(id uuid,reasons text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.id,work_board_readiness(f.id) FROM feature_requests f WHERE f.id=ANY(p_ids) LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.work_board_readiness_many(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_board_readiness_many(uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.reorder_work_board(
 p_actor text,p_operation text,p_id uuid,p_expected_revision bigint,p_request_key uuid,
 p_request_hash text,p_payload jsonb,p_projects text[],p_reviewer boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; c feature_requests; outcome jsonb; rev bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('work-board',0));
 IF p_operation<>'reorder' OR jsonb_array_length(p_payload->'updates') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid reorder'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'updates') LOOP
  SELECT * INTO c FROM feature_requests WHERE id=(item->>'id')::uuid;
  rev:=(item->>'revision')::bigint;
  IF c.status IS DISTINCT FROM item->>'status' THEN
   outcome:=mutate_work_board(p_actor,'transition',c.id,rev,md5(p_request_key::text||c.id::text||'transition')::uuid,md5(p_request_hash||'transition'||c.id::text),jsonb_build_object('status',item->>'status','message','Operator reordered work on the board'),p_projects,p_reviewer);
   rev:=(outcome->'card'->>'revision')::bigint;
  END IF;
  PERFORM mutate_work_board(p_actor,'edit',c.id,rev,md5(p_request_key::text||c.id::text||'order')::uuid,md5(p_request_hash||'order'||c.id::text),jsonb_build_object('sort_order',item->'sort_order'),p_projects,p_reviewer);
 END LOOP;
 RETURN jsonb_build_object('affected',jsonb_array_length(p_payload->'updates'));
END $$;
REVOKE ALL ON FUNCTION public.reorder_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean) TO service_role;
COMMIT;
