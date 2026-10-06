BEGIN;
-- Host-owned writes preserve existing interactive grants. The host supplies a
-- verified actor; this transaction rechecks and locks their live membership.
CREATE UNIQUE INDEX IF NOT EXISTS audit_content_calendar_command_key
 ON public.audit_log(tenant_id,entity_id) WHERE action='content_calendar.command';
CREATE OR REPLACE FUNCTION public.write_content_calendar_command(
 p_tenant uuid,p_actor uuid,p_actor_email text,p_request_key uuid,p_digest text,p_input_digest text,
 p_command jsonb,p_items jsonb,p_columns jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 op text:=p_command->>'operation'; prior public.audit_log; tenant public.tenants;
 current_columns jsonb; current_items jsonb; target uuid; v public.content_calendar;
 command_hash text; result jsonb; ids jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 IF current_user<>'service_role' OR p_tenant IS DISTINCT FROM private.request_tenant_id()
  OR p_actor IS NULL OR p_request_key IS NULL OR p_digest IS NULL OR p_input_digest IS NULL
  OR p_digest !~ '^[a-f0-9]{64}$' OR p_input_digest !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Verified calendar host required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO tenant FROM public.tenants WHERE id=p_tenant FOR SHARE;
 IF NOT FOUND OR tenant.status<>'active' OR tenant.config#>>'{modules,content}'='false' THEN
  RAISE EXCEPTION 'Content workspace unavailable' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.tenant_memberships m JOIN auth.users u ON u.id=m.user_id
  WHERE m.tenant_id=p_tenant AND m.user_id=p_actor AND m.role='admin' AND m.status='active'
   AND lower(u.email)=lower(p_actor_email) FOR SHARE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>65536
  OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>250
  OR jsonb_typeof(p_columns) IS DISTINCT FROM 'array' OR jsonb_array_length(p_columns) NOT BETWEEN 1 AND 100
  OR op IS NULL OR op NOT IN ('create','delete','reorder') THEN
  RAISE EXCEPTION 'Invalid content calendar command';
 END IF;
 -- All calendar commands serialize per workspace. Other writers still conflict
 -- through row locks and updated_at snapshots; no partial reorder can commit.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':content-calendar',0));
 command_hash:=md5(jsonb_build_object('command',p_command,'items',p_items,'columns',p_columns)::text);
 SELECT * INTO prior FROM public.audit_log WHERE tenant_id=p_tenant
  AND action='content_calendar.command' AND entity_id=p_request_key::text;
 IF FOUND THEN
  IF prior.metadata->>'commandHash' IS DISTINCT FROM command_hash OR prior.metadata->>'digest' IS DISTINCT FROM p_digest THEN
   RAISE EXCEPTION 'Calendar request key reused for changed content' USING ERRCODE='40001';
  END IF;
  RETURN prior.metadata->'result'||jsonb_build_object('replayed',true);
 END IF;
 PERFORM 1 FROM public.kanban_columns WHERE tenant_id=p_tenant AND board_key='content' ORDER BY column_key FOR SHARE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',column_key,'label',label,'revision',updated_at::text) ORDER BY column_key),'[]')
  INTO current_columns FROM public.kanban_columns WHERE tenant_id=p_tenant AND board_key='content';
 -- Timestamp spellings from the REST client may differ; compare as timestamps.
 IF jsonb_array_length(current_columns)<>jsonb_array_length(p_columns) OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(current_columns) c WHERE NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_columns) e WHERE e->>'key'=c->>'key' AND e->>'label'=c->>'label'
    AND (e->>'revision')::timestamptz=(c->>'revision')::timestamptz
  )) THEN RAISE EXCEPTION 'Content columns changed' USING ERRCODE='40001'; END IF;
 IF op='create' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(p_command))<>3 OR jsonb_array_length(p_items)<>0
   OR jsonb_typeof(p_command->'values') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid calendar create'; END IF;
  target:=(p_command->>'id')::uuid;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_command->'values') k WHERE k NOT IN
   ('title','slug','status','category','target_keywords','pillar','funnel_stage','target_publish_date','actual_publish_date','author','notes','seo_title','seo_description','word_count_target'))
   OR length(btrim(p_command#>>'{values,title}')) NOT BETWEEN 1 AND 240
   OR NOT EXISTS(SELECT 1 FROM public.kanban_columns WHERE tenant_id=p_tenant AND board_key='content' AND column_key=p_command#>>'{values,status}')
   OR EXISTS(SELECT 1 FROM public.content_calendar WHERE id=target) THEN
   RAISE EXCEPTION 'Invalid or existing content item' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v FROM jsonb_populate_record(NULL::public.content_calendar,p_command->'values');
  INSERT INTO public.content_calendar(id,tenant_id,title,slug,status,category,target_keywords,pillar,funnel_stage,
   target_publish_date,actual_publish_date,author,notes,seo_title,seo_description,word_count_target,sort_order,created_at,updated_at)
   VALUES(target,p_tenant,v.title,v.slug,v.status,v.category,v.target_keywords,v.pillar,v.funnel_stage,
    v.target_publish_date,v.actual_publish_date,v.author,v.notes,v.seo_title,v.seo_description,v.word_count_target,1000,stamp,stamp);
  ids:=jsonb_build_array(target);
 ELSE
  IF jsonb_array_length(p_items)=0 OR
   (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_items) e) THEN
   RAISE EXCEPTION 'Invalid calendar targets';
  END IF;
  PERFORM 1 FROM public.content_calendar WHERE tenant_id=p_tenant
   AND id IN(SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_items) e) ORDER BY id FOR UPDATE;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'sortOrder',sort_order,'revision',updated_at::text) ORDER BY id),'[]')
   INTO current_items FROM public.content_calendar WHERE tenant_id=p_tenant AND id IN(SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_items) e);
  IF jsonb_array_length(current_items)<>jsonb_array_length(p_items) OR EXISTS(
   SELECT 1 FROM jsonb_array_elements(current_items) c WHERE NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_items) e WHERE e->>'id'=c->>'id' AND e->>'title'=c->>'title'
     AND e->>'status'=c->>'status' AND (e->>'sortOrder')::numeric=(c->>'sortOrder')::numeric
     AND (e->>'revision')::timestamptz=(c->>'revision')::timestamptz
   )) THEN RAISE EXCEPTION 'Content item changed' USING ERRCODE='40001'; END IF;
  IF op='delete' THEN
   IF (SELECT count(*) FROM jsonb_object_keys(p_command))<>2 OR jsonb_array_length(p_items)<>1
    OR p_items->0->>'id' IS DISTINCT FROM p_command->>'id' THEN RAISE EXCEPTION 'Invalid calendar delete'; END IF;
   target:=(p_command->>'id')::uuid;
   DELETE FROM public.content_calendar WHERE tenant_id=p_tenant AND id=target;
  ELSE
   IF (SELECT count(*) FROM jsonb_object_keys(p_command))<>2 OR jsonb_typeof(p_command->'updates') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command->'updates')<>jsonb_array_length(p_items)
    OR (SELECT count(*) FROM jsonb_array_elements(p_command->'updates'))<>(SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_command->'updates') e)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'updates') e WHERE
     (SELECT count(*) FROM jsonb_object_keys(e))<>3 OR jsonb_typeof(e->'sort_order') IS DISTINCT FROM 'number'
     OR abs((e->>'sort_order')::numeric)>1e12
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'id'=e->>'id')
     OR NOT EXISTS(SELECT 1 FROM public.kanban_columns k WHERE k.tenant_id=p_tenant AND k.board_key='content' AND k.column_key=e->>'column_key')
    ) THEN RAISE EXCEPTION 'Invalid calendar reorder'; END IF;
   UPDATE public.content_calendar c SET status=e->>'column_key',sort_order=(e->>'sort_order')::numeric,updated_at=stamp
    FROM jsonb_array_elements(p_command->'updates') e WHERE c.tenant_id=p_tenant AND c.id=(e->>'id')::uuid;
  END IF;
  SELECT jsonb_agg(e->'id' ORDER BY e->>'id') INTO ids FROM jsonb_array_elements(p_items) e;
 END IF;
 result:=jsonb_build_object('status','success','operation',op,'ids',ids,'count',jsonb_array_length(ids),
  'requestKey',p_request_key,'replayed',false,'published',false);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(p_tenant,p_actor_email,'content_calendar.command','content_calendar',p_request_key::text,'admin',
   jsonb_build_object('operation',op,'digest',p_digest,'inputDigest',p_input_digest,'commandHash',command_hash,'result',result));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.write_content_calendar_command(uuid,uuid,text,uuid,text,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_content_calendar_command(uuid,uuid,text,uuid,text,text,jsonb,jsonb,jsonb) TO service_role;
COMMIT;
