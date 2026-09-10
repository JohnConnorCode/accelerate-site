-- Private personal layouts and shared workspace defaults. Business state stays in its source.
CREATE TABLE IF NOT EXISTS public.today_workspace_views (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  owner_key text NOT NULL CHECK (owner_key = 'workspace' OR owner_key ~ '^[a-f0-9-]{36}$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object' AND octet_length(document::text) <= 131072),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, owner_key)
);
CREATE TABLE IF NOT EXISTS public.today_view_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  owner_key text NOT NULL,
  request_payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, actor_id, request_id)
);
ALTER TABLE public.today_workspace_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_view_receipts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.today_view_proposals (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  preview jsonb NOT NULL CHECK (octet_length(preview::text) <= 262144),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,actor_id,digest)
);
ALTER TABLE public.today_view_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.today_view_proposals FROM anon, authenticated;
GRANT SELECT, INSERT ON public.today_view_proposals TO authenticated;
GRANT ALL ON public.today_view_proposals TO service_role;
DROP POLICY IF EXISTS today_proposal_private ON public.today_view_proposals;
CREATE POLICY today_proposal_private ON public.today_view_proposals FOR ALL TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()))
WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()));
REVOKE ALL ON public.today_workspace_views, public.today_view_receipts FROM anon, authenticated;
GRANT SELECT ON public.today_workspace_views TO authenticated;
GRANT SELECT ON public.today_view_receipts TO authenticated;
GRANT ALL ON public.today_workspace_views, public.today_view_receipts TO service_role;
DROP POLICY IF EXISTS today_view_read ON public.today_workspace_views;
CREATE POLICY today_view_read ON public.today_workspace_views FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)
  AND (owner_key = 'workspace' OR owner_key = (SELECT auth.uid())::text));
DROP POLICY IF EXISTS today_view_write ON public.today_workspace_views;
CREATE POLICY today_view_write ON public.today_workspace_views FOR ALL TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)
  AND (owner_key = (SELECT auth.uid())::text OR (owner_key = 'workspace' AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = today_workspace_views.tenant_id AND m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'active'))))
WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)
  AND (owner_key = (SELECT auth.uid())::text OR (owner_key = 'workspace' AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = today_workspace_views.tenant_id AND m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'active'))));
DROP POLICY IF EXISTS today_receipt_access ON public.today_view_receipts;
CREATE POLICY today_receipt_access ON public.today_view_receipts FOR ALL TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()))
WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()));

-- Narrow transaction writer: caller identity and tenant are derived, never supplied.
CREATE OR REPLACE FUNCTION private.save_today_views(p_owner_key text, p_revision bigint, p_document jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tid uuid := private.request_tenant_id();
  uid uuid := auth.uid();
  prior public.today_workspace_views%ROWTYPE;
  receipt public.today_view_receipts%ROWTYPE;
  request jsonb := jsonb_build_object('owner',p_owner_key,'revision',p_revision,'document',p_document);
  result jsonb;
BEGIN
  IF tid IS NULL OR uid IS NULL OR NOT private.has_active_tenant_membership(tid) THEN
    RAISE EXCEPTION 'Active workspace membership required' USING ERRCODE='42501';
  END IF;
  IF p_owner_key <> uid::text AND (p_owner_key <> 'workspace' OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships WHERE tenant_id=tid AND user_id=uid AND role='admin' AND status='active')) THEN
    RAISE EXCEPTION 'Cannot change this Today workspace' USING ERRCODE='42501';
  END IF;
  IF p_owner_key IS NULL OR p_revision IS NULL OR p_revision < 0 OR p_request_id IS NULL OR p_document->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_document->'views') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_document->'pins') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'muted') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_document->'views') > 12
    OR jsonb_array_length(p_document->'pins') > 100
    OR jsonb_array_length(p_document->'muted') > 100 THEN
    RAISE EXCEPTION 'Invalid Today document';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'views') v
    WHERE jsonb_typeof(v) <> 'object' OR coalesce(v->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
    OR length(coalesce(v->>'name','')) NOT BETWEEN 1 AND 60
    OR coalesce(v->>'density','') NOT IN ('comfortable','compact')
    OR jsonb_typeof(v->'modules') IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'Invalid Today view';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'views') v
    WHERE jsonb_array_length(v->'modules') NOT BETWEEN 1 AND 16)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'views') v, jsonb_array_elements(v->'modules') m
      WHERE coalesce(m->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
      OR coalesce(m->>'type','') NOT IN ('brief','attention','handling','upcoming','changes','metrics','activity','apps','ai')
      OR coalesce(m->>'width','') NOT IN ('full','primary','support')
      OR coalesce(m->>'limit','') !~ '^([1-9]|1[0-9]|20)$'
      OR coalesce(m->>'filter','') NOT IN ('all','decision','work','watch','upcoming')
      OR coalesce(m->>'horizon','') NOT IN ('all','today','week')) THEN
    RAISE EXCEPTION 'Invalid Today module';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text || ':' || uid::text || ':' || p_request_id::text,0));
  SELECT * INTO receipt FROM public.today_view_receipts WHERE tenant_id=tid AND actor_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.request_payload <> request THEN RAISE EXCEPTION 'Request key reused with different content' USING ERRCODE='40001'; END IF;
    RETURN receipt.result;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text || ':' || p_owner_key,0));
  SELECT * INTO prior FROM public.today_workspace_views WHERE tenant_id=tid AND owner_key=p_owner_key FOR UPDATE;
  IF coalesce(prior.revision,0) <> p_revision THEN
    RAISE EXCEPTION 'Today views changed in another session. Reload before saving.' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.today_workspace_views(tenant_id,owner_key,revision,document)
  VALUES(tid,p_owner_key,p_revision+1,p_document)
  ON CONFLICT(tenant_id,owner_key) DO UPDATE SET revision=EXCLUDED.revision,document=EXCLUDED.document,updated_at=now();
  result := jsonb_build_object('revision',p_revision+1,'document',p_document);
  INSERT INTO public.today_view_receipts(tenant_id,actor_id,request_id,owner_key,request_payload,result)
  VALUES(tid,uid,p_request_id,p_owner_key,request,result);
  -- Personal layout contents remain private in their immutable receipt.
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
  VALUES(tid,auth.jwt()->>'email','today.views_saved','today_view',p_owner_key,'admin',
    jsonb_build_object('revision',coalesce(prior.revision,0)),jsonb_build_object('revision',p_revision+1),
    jsonb_build_object('requestId',p_request_id,'scope',CASE WHEN p_owner_key='workspace' THEN 'workspace' ELSE 'personal' END));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.save_today_views(text,bigint,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.save_today_views(text,bigint,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_today_views(p_owner_key text, p_revision bigint, p_document jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.save_today_views(p_owner_key,p_revision,p_document,p_request_id);
$$;
REVOKE ALL ON FUNCTION public.save_today_views(text,bigint,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_today_views(text,bigint,jsonb,uuid) TO authenticated;
