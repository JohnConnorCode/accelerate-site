BEGIN;
-- Whole-installation content snapshots. Drafts and receipts never have a public
-- grant. The server exposes only the revision selected by published_revision_id.
CREATE TABLE IF NOT EXISTS public.site_websites (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 version integer NOT NULL DEFAULT 0 CHECK(version >= 0),
 draft_revision_id uuid,
 published_revision_id uuid,
 has_published boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_website_revisions (
 tenant_id uuid NOT NULL REFERENCES public.site_websites(tenant_id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=8000000),
 checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
 actor_email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='site_website_draft_revision_fk' AND conrelid='public.site_websites'::regclass) THEN
 ALTER TABLE public.site_websites ADD CONSTRAINT site_website_draft_revision_fk FOREIGN KEY(tenant_id,draft_revision_id) REFERENCES public.site_website_revisions(tenant_id,id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='site_website_published_revision_fk' AND conrelid='public.site_websites'::regclass) THEN
 ALTER TABLE public.site_websites ADD CONSTRAINT site_website_published_revision_fk FOREIGN KEY(tenant_id,published_revision_id) REFERENCES public.site_website_revisions(tenant_id,id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.site_website_receipts (
 tenant_id uuid NOT NULL REFERENCES public.site_websites(tenant_id),
 request_key uuid NOT NULL,
 request_hash text NOT NULL,
 receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,request_key)
);
CREATE INDEX IF NOT EXISTS site_website_revision_history ON public.site_website_revisions(tenant_id,created_at DESC);
ALTER TABLE public.site_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_website_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_website_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_websites,public.site_website_revisions,public.site_website_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_websites,public.site_website_revisions,public.site_website_receipts TO service_role;
DROP TRIGGER IF EXISTS site_website_revision_immutable ON public.site_website_revisions;
CREATE TRIGGER site_website_revision_immutable BEFORE UPDATE OR DELETE ON public.site_website_revisions FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();
DROP TRIGGER IF EXISTS site_website_receipt_immutable ON public.site_website_receipts;
CREATE TRIGGER site_website_receipt_immutable BEFORE UPDATE OR DELETE ON public.site_website_receipts FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();

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
 IF cfg->'modules'->>'site-studio' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Site Studio disabled'; END IF;
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
COMMIT;
