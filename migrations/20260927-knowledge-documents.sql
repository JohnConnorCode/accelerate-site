BEGIN;
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 240),
 mime_type text NOT NULL,
 storage_path text NOT NULL,
 content_hash text NOT NULL,
 owner_email text NOT NULL,
 visibility text NOT NULL DEFAULT 'workspace' CHECK(visibility='workspace'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','indexed','failed','archived')),
 extracted_text text,
 locations jsonb NOT NULL DEFAULT '[]',
 extraction_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 indexed_at timestamptz,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,content_hash)
);
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_documents_tenant ON public.knowledge_documents;
CREATE POLICY knowledge_documents_tenant ON public.knowledge_documents FOR ALL TO authenticated,service_role
 USING(tenant_id=private.authorized_request_tenant_id()) WITH CHECK(tenant_id=private.authorized_request_tenant_id());
GRANT SELECT,INSERT,UPDATE ON public.knowledge_documents TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS knowledge_documents_search ON public.knowledge_documents
 USING gin(to_tsvector('simple',coalesce(title,'')||' '||coalesce(extracted_text,''))) WHERE status='indexed';
CREATE INDEX IF NOT EXISTS drive_documents_search ON public.drive_documents
 USING gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(extracted_text,''))) WHERE indexed_status='indexed';
CREATE INDEX IF NOT EXISTS messages_knowledge_search ON public.messages
 USING gin(to_tsvector('simple',coalesce(subject,'')||' '||coalesce(body_text,'')));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('workspace-knowledge','workspace-knowledge',false,4194304,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown'])
 ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS workspace_knowledge_access ON storage.objects;
CREATE POLICY workspace_knowledge_access ON storage.objects FOR ALL TO authenticated,service_role
 USING(bucket_id='workspace-knowledge' AND (storage.foldername(name))[1]=private.authorized_request_tenant_id()::text)
 WITH CHECK(bucket_id='workspace-knowledge' AND (storage.foldername(name))[1]=private.authorized_request_tenant_id()::text);

CREATE OR REPLACE FUNCTION public.search_document_knowledge(p_query text,p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); q tsquery; result jsonb;
BEGIN
 IF p_query IS NULL OR p_limit IS NULL OR length(btrim(p_query)) NOT BETWEEN 2 AND 200 OR p_limit NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'Use a 2–200 character query and a limit of 1–25'; END IF;
 q:=websearch_to_tsquery('simple',p_query);
 WITH sources AS (
  SELECT d.id,'upload'::text kind,d.title,d.extracted_text content,d.content_hash revision,
   d.created_at occurred_at,d.owner_email author,NULL::text url,NULL::text external_id,NULL::text folder_id,NULL::text provider_revision,
   ts_rank(to_tsvector('simple',coalesce(d.title,'')||' '||coalesce(d.extracted_text,'')),q) score
  FROM knowledge_documents d WHERE d.tenant_id=t AND d.status='indexed'
   AND to_tsvector('simple',coalesce(d.title,'')||' '||coalesce(d.extracted_text,''))@@q
  UNION ALL
  SELECT d.id,'drive',d.name,d.extracted_text,d.content_hash,d.modified_at,NULL,d.web_view_link,d.external_id,d.folder_id,d.provider_revision,
   ts_rank(to_tsvector('simple',coalesce(d.name,'')||' '||coalesce(d.extracted_text,'')),q)
  FROM drive_documents d WHERE d.tenant_id=t AND d.indexed_status='indexed'
   AND coalesce(d.metadata->>'canDownload','true')<>'false'
   AND EXISTS(SELECT 1 FROM integration_connections c WHERE c.tenant_id=t AND c.provider='google' AND c.status='connected'
     AND coalesce(c.settings->'drive_folder_ids','[]') ? d.folder_id)
   AND to_tsvector('simple',coalesce(d.name,'')||' '||coalesce(d.extracted_text,''))@@q
  UNION ALL
  SELECT m.id,'conversation',coalesce(m.subject,'Conversation message'),m.body_text,md5(coalesce(m.body_text,'')),m.created_at,NULL,NULL,NULL,NULL,NULL,
   ts_rank(to_tsvector('simple',coalesce(m.subject,'')||' '||coalesce(m.body_text,'')),q)
  FROM messages m WHERE m.tenant_id=t AND to_tsvector('simple',coalesce(m.subject,'')||' '||coalesce(m.body_text,''))@@q
 ), selected AS (SELECT * FROM sources ORDER BY score DESC,id LIMIT p_limit)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,
  'content',ts_headline('simple',left(content,500000),q,'MaxWords=120,MinWords=30,StartSel=[,StopSel=]'),
  'revision',revision,'occurredAt',occurred_at,'author',author,'url',url,'externalId',external_id,'folderId',folder_id,'providerRevision',provider_revision) ORDER BY score DESC,id),'[]') INTO result FROM selected;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.search_document_knowledge(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_document_knowledge(text,integer) TO authenticated,service_role;
COMMIT;
