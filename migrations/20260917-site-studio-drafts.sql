BEGIN;
CREATE TABLE IF NOT EXISTS public.site_drafts (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 slug text NOT NULL, draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object' AND pg_column_size(draft)<=262144),
 version integer NOT NULL CHECK(version>0), checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), discarded_at timestamptz,
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS site_drafts_live_slug ON public.site_drafts(tenant_id,slug) WHERE discarded_at IS NULL;
CREATE INDEX IF NOT EXISTS site_drafts_recent ON public.site_drafts(tenant_id,updated_at DESC) WHERE discarded_at IS NULL;
CREATE TABLE IF NOT EXISTS public.site_draft_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 draft_id uuid NOT NULL, version integer NOT NULL, operation text NOT NULL CHECK(operation IN ('create','revise','discard')),
 draft jsonb NOT NULL, actor_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,draft_id) REFERENCES public.site_drafts(tenant_id,id), UNIQUE(tenant_id,draft_id,version)
);
ALTER TABLE public.site_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_draft_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_draft_read ON public.site_drafts;
CREATE POLICY site_draft_read ON public.site_drafts FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS site_revision_read ON public.site_draft_revisions;
CREATE POLICY site_revision_read ON public.site_draft_revisions FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.site_drafts,public.site_draft_revisions TO authenticated,service_role;
DROP TRIGGER IF EXISTS site_revision_immutable ON public.site_draft_revisions;
CREATE TRIGGER site_revision_immutable BEFORE UPDATE OR DELETE ON public.site_draft_revisions FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();

CREATE OR REPLACE FUNCTION public.write_site_draft(p_operation text,p_id uuid,p_expected_checksum text,p_draft jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; previous public.site_drafts; saved jsonb; n integer; stamp timestamptz:=clock_timestamp();
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF cfg->'modules'->>'site-studio' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Site Studio disabled'; END IF;
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
