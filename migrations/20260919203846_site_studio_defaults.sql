BEGIN;
-- Default-enabled Site Studio must agree with the module registry. Missing or
-- inactive tenants still fail closed; explicit false remains disabled.
CREATE OR REPLACE FUNCTION public.write_site_website(
 p_operation text,p_request_key uuid,p_expected_version integer,p_revision_id uuid,
 p_document jsonb,p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 t uuid; cfg jsonb; current_site public.site_websites; old_receipt public.site_website_receipts;
 request_hash text; result jsonb; new_revision uuid; fingerprint text;
BEGIN
 t:=private.authorized_request_tenant_id();
 -- Only the bootstrap workspace owns this installation's marketing site.
 -- Other tenant administrators cannot change the shared public website.
 IF t IS DISTINCT FROM 'acce1e8e-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Installation website context required'; END IF;
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce(cfg->'modules'->>'site-studio','true') <> 'true' THEN RAISE EXCEPTION 'Site Studio disabled'; END IF;
 IF p_operation IS NULL OR p_operation NOT IN ('save','publish','unpublish','rollback') OR p_request_key IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid website command'; END IF;
 IF p_operation='save' THEN
  IF p_revision_id IS NOT NULL OR p_document IS NULL OR jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>8000000 OR p_document->>'schemaVersion' IS DISTINCT FROM '1' OR jsonb_typeof(p_document->'pages') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'pages')<1 THEN RAISE EXCEPTION 'Invalid website snapshot'; END IF;
 ELSE
  IF p_document IS NOT NULL OR (p_operation IN ('publish','rollback') AND p_revision_id IS NULL) OR (p_operation='unpublish' AND p_revision_id IS NOT NULL) THEN RAISE EXCEPTION 'Invalid publication command'; END IF;
 END IF;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('operation',p_operation,'expectedVersion',p_expected_version,'revision',p_revision_id,'document',p_document,'actor',p_actor_email)::text,'UTF8')),'hex');
 -- The insert serializes the first save; the row lock serializes every later
 -- state transition, including concurrent publication and interrupted retries.
 INSERT INTO public.site_websites(tenant_id) VALUES(t) ON CONFLICT DO NOTHING;
 SELECT * INTO current_site FROM public.site_websites WHERE tenant_id=t FOR UPDATE;
 SELECT * INTO old_receipt FROM public.site_website_receipts WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN
  IF old_receipt.request_hash<>request_hash THEN RAISE EXCEPTION 'Website request key reused with different content'; END IF;
  RETURN old_receipt.receipt;
 END IF;
 IF current_site.version<>p_expected_version THEN RAISE EXCEPTION 'Stale website version'; END IF;
 IF current_site.draft_revision_id IS NULL AND p_operation<>'save' THEN RAISE EXCEPTION 'Save the website before publication'; END IF;
 new_revision:=current_site.draft_revision_id;
 IF p_operation='save' THEN
  new_revision:=gen_random_uuid();
  fingerprint:=encode(sha256(convert_to(p_document::text,'UTF8')),'hex');
  INSERT INTO public.site_website_revisions(tenant_id,id,document,checksum,actor_email) VALUES(t,new_revision,p_document,fingerprint,p_actor_email);
 ELSE
  IF p_operation IN ('publish','rollback') THEN
   PERFORM 1 FROM public.site_website_revisions WHERE tenant_id=t AND id=p_revision_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Website revision unavailable'; END IF;
   IF p_operation='publish' AND p_revision_id IS DISTINCT FROM current_site.draft_revision_id THEN RAISE EXCEPTION 'Publish requires the current saved draft'; END IF;
   IF p_operation='rollback' AND NOT EXISTS(SELECT 1 FROM public.site_website_receipts WHERE tenant_id=t AND receipt->>'publishedRevisionId'=p_revision_id::text) THEN RAISE EXCEPTION 'Rollback requires a previously published revision'; END IF;
  END IF;
 END IF;
 UPDATE public.site_websites SET version=version+1,draft_revision_id=new_revision,
  published_revision_id=CASE WHEN p_operation='save' THEN current_site.published_revision_id WHEN p_operation='unpublish' THEN NULL ELSE p_revision_id END,
  has_published=current_site.has_published OR p_operation IN ('publish','rollback'),
  updated_at=clock_timestamp() WHERE tenant_id=t;
 SELECT jsonb_build_object('requestKey',p_request_key,'operation',p_operation,'version',version,'draftRevisionId',draft_revision_id,'publishedRevisionId',published_revision_id,'previousPublishedRevisionId',current_site.published_revision_id,'createdAt',updated_at) INTO result FROM public.site_websites WHERE tenant_id=t;
 INSERT INTO public.site_website_receipts(tenant_id,request_key,request_hash,receipt) VALUES(t,p_request_key,request_hash,result);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor_email,'site_website.'||p_operation,'site_website',t::text,'admin',result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.write_site_website(text,uuid,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_site_website(text,uuid,integer,uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.write_site_draft(p_operation text,p_id uuid,p_expected_checksum text,p_draft jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; previous public.site_drafts; saved jsonb; n integer; stamp timestamptz:=clock_timestamp();
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce(cfg->'modules'->>'site-studio','true') <> 'true' THEN RAISE EXCEPTION 'Site Studio disabled'; END IF;
 IF p_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('create','revise','discard') OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid draft command'; END IF;
 IF p_operation <> 'discard' AND (p_draft IS NULL OR jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR pg_column_size(p_draft)>262144 OR
   p_draft->>'id' IS DISTINCT FROM p_id::text OR p_draft->>'status' IS DISTINCT FROM 'draft' OR
   coalesce(p_draft->>'checksum','') !~ '^[a-f0-9]{64}$' OR coalesce(p_draft->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR
   length(p_draft->>'slug')>160 OR length(p_draft->>'title') NOT BETWEEN 1 AND 120 OR
   p_draft#>>'{document,metadata,slug}' IS DISTINCT FROM p_draft->>'slug' OR
   p_draft#>>'{document,metadata,title}' IS DISTINCT FROM p_draft->>'title') THEN RAISE EXCEPTION 'Invalid draft document'; END IF;
 IF p_operation='create' THEN
   IF p_expected_checksum IS NOT NULL THEN RAISE EXCEPTION 'New draft has no prior checksum'; END IF;
   n:=1;
   saved:=p_draft || jsonb_build_object('version',n,'createdAt',to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
   INSERT INTO site_drafts(id,tenant_id,slug,draft,version,checksum,created_at,updated_at) VALUES(p_id,t,saved->>'slug',saved,n,saved->>'checksum',stamp,stamp);
 ELSE
   SELECT * INTO previous FROM site_drafts WHERE tenant_id=t AND id=p_id AND discarded_at IS NULL FOR UPDATE;
   IF NOT FOUND OR p_expected_checksum IS NULL OR previous.checksum<>p_expected_checksum THEN RAISE EXCEPTION 'Stale or unavailable draft'; END IF;
   n:=previous.version+1;
   saved:=CASE WHEN p_operation='discard' THEN previous.draft ELSE p_draft END || jsonb_build_object('version',n,'createdAt',previous.draft->>'createdAt','updatedAt',to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
   UPDATE site_drafts SET slug=saved->>'slug',draft=saved,version=n,checksum=saved->>'checksum',updated_at=stamp,discarded_at=CASE WHEN p_operation='discard' THEN stamp ELSE NULL END WHERE tenant_id=t AND id=p_id;
 END IF;
 INSERT INTO site_draft_revisions(tenant_id,draft_id,version,operation,draft,actor_email) VALUES(t,p_id,n,p_operation,saved,p_actor_email);
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor_email,'site_draft.'||p_operation,'site_draft',p_id::text,'admin',jsonb_build_object('version',n,'checksum',saved->>'checksum','slug',saved->>'slug'));
 IF p_operation='discard' THEN RETURN 'true'::jsonb; END IF;
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.write_site_draft(text,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_site_draft(text,uuid,text,jsonb,text) TO service_role;

COMMIT;
