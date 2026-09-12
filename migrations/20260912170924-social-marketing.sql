-- Social publishing keeps approval and scheduling in Accelerate. Postiz accepts
-- immediate publications only after a durable, non-retryable submission claim.
CREATE UNIQUE INDEX IF NOT EXISTS integration_postiz_organization_unique
ON public.integration_connections(account_email) WHERE provider='postiz' AND account_email IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.media_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 storage_path text NOT NULL, content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg')), size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 3000000),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,storage_path)
);
CREATE TABLE IF NOT EXISTS public.social_posts (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id), revision integer NOT NULL DEFAULT 1,
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','scheduled','cancelled','needs_review','submitting','unknown','submitted','published','failed')),
 scheduled_at timestamptz NOT NULL, media_id uuid, approval_id uuid, approved_by text,
 approved_config_updated_at timestamptz, connection_version integer, organization_id text, approved_origin text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,media_id) REFERENCES public.media_assets(tenant_id,id),
 FOREIGN KEY(tenant_id,approval_id) REFERENCES public.action_queue(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.social_post_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), post_id uuid NOT NULL,
 revision integer NOT NULL, draft jsonb NOT NULL, actor_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,post_id,revision), FOREIGN KEY(tenant_id,post_id) REFERENCES public.social_posts(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.social_publication_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), post_id uuid NOT NULL, post_revision integer NOT NULL,
 state text NOT NULL CHECK(state IN ('submitting','unknown','submitted','published','failed')), provider_post_id text, release_url text,
 reason text, started_at timestamptz NOT NULL DEFAULT now(), reconciled_at timestamptz, metrics jsonb, metrics_at timestamptz,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,post_id,post_revision),
 FOREIGN KEY(tenant_id,post_id) REFERENCES public.social_posts(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS social_provider_post_unique ON public.social_publication_attempts(tenant_id,provider_post_id) WHERE provider_post_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.social_operation_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), operation_key uuid NOT NULL,
 input_hash text NOT NULL, operation text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL, actor_email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,operation_key)
);
CREATE OR REPLACE FUNCTION private.social_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Media, social revisions and receipts are immutable'; END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['media_assets','social_posts','social_post_revisions','social_publication_attempts','social_operation_receipts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS social_tenant_read ON public.%I',tab);
  EXECUTE format('CREATE POLICY social_tenant_read ON public.%I FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',tab);
  IF tab IN ('media_assets','social_post_revisions','social_operation_receipts') THEN
   EXECUTE format('DROP TRIGGER IF EXISTS social_immutable ON public.%I',tab);
   EXECUTE format('CREATE TRIGGER social_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.social_immutable()',tab);
  END IF;
 END LOOP;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('workspace-media','workspace-media',false,3000000,ARRAY['image/png','image/jpeg']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='workspace-media' AND public=false AND file_size_limit=3000000 AND allowed_mime_types=ARRAY['image/png','image/jpeg']) THEN RAISE EXCEPTION 'Existing workspace-media bucket differs from required private image policy'; END IF; END $$;
DROP POLICY IF EXISTS workspace_media_read ON storage.objects;
CREATE POLICY workspace_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='workspace-media' AND (storage.foldername(name))[1]=private.request_tenant_id()::text AND private.has_active_tenant_membership(private.request_tenant_id()));
DROP POLICY IF EXISTS workspace_media_insert ON storage.objects;
CREATE POLICY workspace_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='workspace-media' AND (storage.foldername(name))[1]=private.request_tenant_id()::text AND private.has_active_tenant_membership(private.request_tenant_id()));

CREATE OR REPLACE FUNCTION public.execute_social_command(p_operation_key uuid,p_change jsonb,p_config_updated_at timestamptz,p_actor_email text,p_action_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg public.tenants; op text; h text; r public.social_operation_receipts; item jsonb; p public.social_posts;
 before_rows jsonb:='[]'; after_rows jsonb:='[]'; c public.integration_connections; a public.action_queue;
BEGIN
 t:=private.authorized_request_tenant_id(); op:=p_change->>'operation';
 IF p_operation_key IS NULL OR op NOT IN ('save','schedule','cancel','register_media') OR pg_column_size(p_change)>50000 OR nullif(btrim(p_actor_email),'') IS NULL THEN RAISE EXCEPTION 'Invalid social command'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':social',0));
 h:=encode(sha256(convert_to(p_change::text,'UTF8')),'hex');
 SELECT * INTO r FROM social_operation_receipts WHERE tenant_id=t AND operation_key=p_operation_key;
 IF FOUND THEN IF r.input_hash<>h THEN RAISE EXCEPTION 'Operation identity conflict'; END IF; RETURN to_jsonb(r); END IF;
 SELECT * INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR cfg.updated_at IS DISTINCT FROM p_config_updated_at OR cfg.config->'modules'->>'social-marketing' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Social configuration changed or plugin disabled'; END IF;
 IF op='register_media' THEN
  IF p_change->>'storagePath' NOT LIKE t::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='workspace-media' AND name=p_change->>'storagePath') THEN RAISE EXCEPTION 'Private media object missing'; END IF;
  INSERT INTO media_assets(id,tenant_id,storage_path,content_hash,mime_type,size_bytes) VALUES((p_change->>'id')::uuid,t,p_change->>'storagePath',p_change->>'hash',p_change->>'mime',(p_change->>'size')::int);
  after_rows:=jsonb_build_array(jsonb_build_object('id',p_change->>'id'));
 ELSE
  IF op='schedule' THEN
   SELECT * INTO a FROM action_queue WHERE tenant_id=t AND id=p_action_id AND action_type='social_marketing_change' AND status='executing' AND approved_by=p_actor_email AND approved_at IS NOT NULL AND payload->'change'=p_change;
   IF NOT FOUND THEN RAISE EXCEPTION 'Exact human approval is required'; END IF;
   SELECT * INTO c FROM integration_connections WHERE tenant_id=t AND provider='postiz' AND status='connected' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Postiz connection missing'; END IF;
   IF (a.payload->'connection'->>'version')::integer IS DISTINCT FROM c.credential_version OR a.payload->'connection'->>'organizationId' IS DISTINCT FROM c.account_email THEN RAISE EXCEPTION 'Postiz connection changed'; END IF;
  END IF;
  IF jsonb_array_length(CASE WHEN op='save' THEN p_change->'drafts' ELSE p_change->'posts' END) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(CASE WHEN op='save' THEN p_change->'drafts' ELSE p_change->'posts' END) LOOP
   SELECT * INTO p FROM social_posts WHERE tenant_id=t AND id=(item->>'id')::uuid FOR UPDATE;
   IF FOUND THEN
    IF p.revision IS DISTINCT FROM (item->>'revision')::integer OR p.state NOT IN ('draft','scheduled','cancelled','needs_review') THEN RAISE EXCEPTION 'Post changed or has already reached publication dispatch'; END IF;
    before_rows:=before_rows||jsonb_build_array(to_jsonb(p));
   ELSE
    IF op<>'save' OR (item->>'revision')::integer<>0 THEN RAISE EXCEPTION 'Post unavailable in this workspace'; END IF;
    p:=NULL;
   END IF;
   IF op='save' THEN
    IF coalesce(length(item->>'content'),0) NOT BETWEEN 1 AND 3000 OR coalesce(length(item->>'title'),0) NOT BETWEEN 1 AND 200 OR jsonb_array_length(item->'sources') NOT BETWEEN 1 AND 5 OR item->>'channelId' !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'Invalid draft'; END IF;
    INSERT INTO social_posts(id,tenant_id,revision,draft,scheduled_at,media_id) VALUES((item->>'id')::uuid,t,coalesce(p.revision,0)+1,item,(item->>'scheduledAt')::timestamptz,(item->>'mediaId')::uuid)
    ON CONFLICT(id) DO UPDATE SET revision=EXCLUDED.revision,draft=EXCLUDED.draft,scheduled_at=EXCLUDED.scheduled_at,media_id=EXCLUDED.media_id,state='draft',approval_id=NULL,approved_by=NULL,approved_config_updated_at=NULL,connection_version=NULL,organization_id=NULL,updated_at=now() WHERE social_posts.tenant_id=t RETURNING * INTO p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Post identity unavailable'; END IF;
    INSERT INTO social_post_revisions(tenant_id,post_id,revision,draft,actor_email) VALUES(t,p.id,p.revision,p.draft,p_actor_email);
   ELSIF op='schedule' THEN
    IF p.scheduled_at<=now()+interval '1 minute' THEN RAISE EXCEPTION 'Schedule at least one minute ahead'; END IF;
    UPDATE social_posts SET state='scheduled',approval_id=p_action_id,approved_by=p_actor_email,approved_config_updated_at=cfg.updated_at,connection_version=c.credential_version,organization_id=c.account_email,approved_origin=a.payload->'connection'->>'origin',updated_at=now() WHERE tenant_id=t AND id=p.id RETURNING * INTO p;
    INSERT INTO work_items(tenant_id,kind,objective,reason,source,entity_type,entity_id,dedupe_key,due_at,next_check_at,next_check_reason,max_attempts)
    VALUES(t,'social_publish','Publish approved LinkedIn post','Exact approved content is due','social-marketing','social_post',p.id,'social-publish:'||p.id||':'||p.revision,p.scheduled_at,p.scheduled_at,'Approved publication time',1) ON CONFLICT DO NOTHING;
   ELSE
    UPDATE social_posts SET state='cancelled',approval_id=NULL,approved_by=NULL,updated_at=now() WHERE tenant_id=t AND id=p.id RETURNING * INTO p;
   END IF;
   after_rows:=after_rows||jsonb_build_array(to_jsonb(p));
  END LOOP;
 END IF;
 INSERT INTO social_operation_receipts(tenant_id,operation_key,input_hash,operation,before_state,after_state,actor_email) VALUES(t,p_operation_key,h,op,before_rows,after_rows,p_actor_email) RETURNING * INTO r;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata) VALUES(t,p_actor_email,'social.'||op,'social_operation',r.id::text,'social-marketing',jsonb_build_object('receiptId',r.id,'count',jsonb_array_length(after_rows)));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.execute_social_command(uuid,jsonb,timestamptz,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_social_command(uuid,jsonb,timestamptz,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_social_publication(p_post_id uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; p public.social_posts; a public.social_publication_attempts; cfg public.tenants; c public.integration_connections;
BEGIN
 t:=private.authorized_request_tenant_id();
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':social',0));
 SELECT * INTO p FROM social_posts WHERE tenant_id=t AND id=p_post_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Post unavailable'; END IF;
 SELECT * INTO a FROM social_publication_attempts WHERE tenant_id=t AND post_id=p.id AND post_revision=p_revision;
 IF FOUND THEN RETURN jsonb_build_object('claimed',false,'attempt',to_jsonb(a)); END IF;
 IF p.state<>'scheduled' OR p.revision<>p_revision OR p.scheduled_at>now() THEN RETURN jsonb_build_object('claimed',false); END IF;
 SELECT * INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 SELECT * INTO c FROM integration_connections WHERE tenant_id=t AND provider='postiz' AND status='connected' FOR SHARE;
 IF cfg.id IS NULL OR cfg.config->'modules'->>'social-marketing' IS DISTINCT FROM 'true' OR cfg.updated_at IS DISTINCT FROM p.approved_config_updated_at OR c.credential_version IS DISTINCT FROM p.connection_version OR c.account_email IS DISTINCT FROM p.organization_id OR p.scheduled_at<now()-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM tenant_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.tenant_id=t AND m.status='active' AND m.role='admin' AND lower(u.email)=lower(p.approved_by)) THEN
  UPDATE social_posts SET state='needs_review',updated_at=now() WHERE tenant_id=t AND id=p.id;
  RETURN jsonb_build_object('claimed',false,'reason','Configuration, connection, membership or schedule changed; reschedule and approve again');
 END IF;
 INSERT INTO social_publication_attempts(tenant_id,post_id,post_revision,state) VALUES(t,p.id,p.revision,'submitting') RETURNING * INTO a;
 UPDATE social_posts SET state='submitting',updated_at=now() WHERE tenant_id=t AND id=p.id;
 RETURN jsonb_build_object('claimed',true,'attempt',to_jsonb(a),'post',to_jsonb(p));
END $$;
REVOKE ALL ON FUNCTION public.claim_social_publication(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_social_publication(uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.record_social_publication(p_attempt_id uuid,p_state text,p_provider_post_id text DEFAULT NULL,p_release_url text DEFAULT NULL,p_reason text DEFAULT NULL,p_metrics jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; a public.social_publication_attempts;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT * INTO a FROM social_publication_attempts WHERE tenant_id=t AND id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR p_state NOT IN ('unknown','submitted','published','failed') OR (a.state IN ('published','failed') AND p_state<>a.state) THEN RAISE EXCEPTION 'Invalid publication receipt'; END IF;
 IF a.provider_post_id IS NOT NULL AND p_provider_post_id IS DISTINCT FROM a.provider_post_id THEN RAISE EXCEPTION 'Provider receipt identity changed'; END IF;
 IF p_state IN ('submitted','published') AND nullif(p_provider_post_id,'') IS NULL THEN RAISE EXCEPTION 'Provider post identity required'; END IF;
 IF p_state='published' AND (p_release_url IS NULL OR p_release_url !~ '^https://([a-z]+\.)?linkedin\.com/') THEN RAISE EXCEPTION 'Verified LinkedIn publication URL required'; END IF;
 UPDATE social_publication_attempts SET state=p_state,provider_post_id=p_provider_post_id,release_url=p_release_url,reason=left(p_reason,500),reconciled_at=now(),metrics=coalesce(p_metrics,metrics),metrics_at=CASE WHEN p_metrics IS NOT NULL THEN now() ELSE metrics_at END WHERE tenant_id=t AND id=a.id RETURNING * INTO a;
 UPDATE social_posts SET state=p_state,updated_at=now() WHERE tenant_id=t AND id=a.post_id;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata) VALUES(t,'system','social.publication_receipt','social_attempt',a.id::text,'postiz',jsonb_build_object('state',p_state,'providerPostId',p_provider_post_id,'releaseURL',p_release_url));
 RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.record_social_publication(uuid,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_social_publication(uuid,text,text,text,text,jsonb) TO service_role;

-- Recheck after private image upload and immediately before the external send.
CREATE OR REPLACE FUNCTION public.assert_social_dispatch(p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid;
BEGIN
 t:=private.authorized_request_tenant_id();
 RETURN EXISTS(SELECT 1 FROM social_publication_attempts a JOIN social_posts p ON p.tenant_id=a.tenant_id AND p.id=a.post_id
 JOIN tenants cfg ON cfg.id=p.tenant_id JOIN integration_connections c ON c.tenant_id=p.tenant_id AND c.provider='postiz'
 WHERE a.tenant_id=t AND a.id=p_attempt_id AND a.state='submitting' AND p.state='submitting' AND p.revision=a.post_revision
 AND cfg.status='active' AND cfg.config->'modules'->>'social-marketing'='true' AND cfg.updated_at=p.approved_config_updated_at
 AND c.status='connected' AND c.credential_version=p.connection_version AND c.account_email=p.organization_id
 AND EXISTS(SELECT 1 FROM tenant_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.tenant_id=t AND m.status='active' AND m.role='admin' AND lower(u.email)=lower(p.approved_by)));
END $$;
REVOKE ALL ON FUNCTION public.assert_social_dispatch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_social_dispatch(uuid) TO service_role;
