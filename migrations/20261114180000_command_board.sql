-- Command Board definitions: tenant-scoped board configuration, one document per
-- business anchor. Station status is computed from source records at read time
-- and is never stored here.
CREATE TABLE IF NOT EXISTS public.command_board_definitions (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  board_key text NOT NULL CHECK (board_key ~ '^[a-z0-9][a-z0-9-]{0,47}$'),
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 99),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object' AND octet_length(document::text) <= 262144),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, board_key)
);
CREATE TABLE IF NOT EXISTS public.command_board_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  board_key text NOT NULL,
  request_payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, actor_id, request_id)
);
CREATE TABLE IF NOT EXISTS public.command_board_proposals (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  preview jsonb NOT NULL CHECK (octet_length(preview::text) <= 524288),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, actor_id, digest)
);
ALTER TABLE public.command_board_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_board_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_board_proposals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.command_board_definitions, public.command_board_receipts, public.command_board_proposals FROM anon, authenticated;
GRANT SELECT ON public.command_board_definitions, public.command_board_receipts TO authenticated;
GRANT SELECT, INSERT ON public.command_board_proposals TO authenticated;
GRANT ALL ON public.command_board_definitions, public.command_board_receipts, public.command_board_proposals TO service_role;

-- Members read their workspace's boards; every change goes through the writer below.
DROP POLICY IF EXISTS command_board_read ON public.command_board_definitions;
CREATE POLICY command_board_read ON public.command_board_definitions FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS command_board_receipt_access ON public.command_board_receipts;
CREATE POLICY command_board_receipt_access ON public.command_board_receipts FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()));
-- A member records only their own proposal; any workspace administrator can read it to review and approve.
DROP POLICY IF EXISTS command_board_proposal_insert ON public.command_board_proposals;
CREATE POLICY command_board_proposal_insert ON public.command_board_proposals FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id) AND actor_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS command_board_proposal_read ON public.command_board_proposals;
CREATE POLICY command_board_proposal_read ON public.command_board_proposals FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND (actor_id = (SELECT auth.uid()) OR EXISTS (
  SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = command_board_proposals.tenant_id
    AND m.user_id = (SELECT auth.uid()) AND m.role = 'admin' AND m.status = 'active')));

-- Narrow transaction writer: caller identity and tenant are derived, never supplied.
CREATE OR REPLACE FUNCTION private.save_command_board(p_board_key text, p_revision bigint, p_position integer, p_document jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tid uuid := private.request_tenant_id();
  uid uuid := auth.uid();
  prior public.command_board_definitions%ROWTYPE;
  receipt public.command_board_receipts%ROWTYPE;
  request jsonb := jsonb_build_object('board',p_board_key,'revision',p_revision,'position',p_position,'document',p_document);
  result jsonb;
BEGIN
  IF tid IS NULL OR uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships WHERE tenant_id=tid AND user_id=uid AND role='admin' AND status='active') THEN
    RAISE EXCEPTION 'Workspace administrator access required' USING ERRCODE='42501';
  END IF;
  IF p_board_key IS NULL OR p_board_key !~ '^[a-z0-9][a-z0-9-]{0,47}$'
    OR p_revision IS NULL OR p_revision < 0 OR p_request_id IS NULL
    OR p_position IS NULL OR p_position NOT BETWEEN 0 AND 99
    OR p_document->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_document->'anchor') IS DISTINCT FROM 'object'
    OR length(coalesce(p_document->'anchor'->>'label','')) NOT BETWEEN 1 AND 60
    OR jsonb_typeof(p_document->'mode') IS DISTINCT FROM 'object'
    OR coalesce(p_document->'mode'->>'key','') !~ '^[a-z0-9][a-z0-9-]{0,47}$'
    OR jsonb_typeof(p_document->'satellites') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_document->'satellites') > 3
    OR jsonb_typeof(p_document->'phases') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_document->'phases') NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'Invalid Command Board document';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'phases') p
    WHERE jsonb_typeof(p) <> 'object'
    OR coalesce(p->>'key','') !~ '^[a-z0-9][a-z0-9-]{0,47}$'
    OR length(coalesce(p->>'label','')) NOT BETWEEN 1 AND 60
    OR jsonb_typeof(p->'segments') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'stations') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p->'segments') > 6
    OR jsonb_array_length(p->'stations') > 6
    OR (jsonb_array_length(p->'segments') = 0) = (jsonb_array_length(p->'stations') = 0)) THEN
    RAISE EXCEPTION 'Invalid Command Board phase';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text || ':' || uid::text || ':' || p_request_id::text,0));
  SELECT * INTO receipt FROM public.command_board_receipts WHERE tenant_id=tid AND actor_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.request_payload <> request THEN RAISE EXCEPTION 'Request key reused with different content' USING ERRCODE='40001'; END IF;
    RETURN receipt.result;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text || ':command-board:' || p_board_key,0));
  SELECT * INTO prior FROM public.command_board_definitions WHERE tenant_id=tid AND board_key=p_board_key FOR UPDATE;
  IF coalesce(prior.revision,0) <> p_revision THEN
    RAISE EXCEPTION 'This board changed in another session. Reload before saving.' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.command_board_definitions(tenant_id,board_key,position,revision,document)
  VALUES(tid,p_board_key,p_position,p_revision+1,p_document)
  ON CONFLICT(tenant_id,board_key) DO UPDATE SET position=EXCLUDED.position,revision=EXCLUDED.revision,document=EXCLUDED.document,updated_at=now();
  result := jsonb_build_object('boardKey',p_board_key,'revision',p_revision+1,'position',p_position,'document',p_document);
  INSERT INTO public.command_board_receipts(tenant_id,actor_id,request_id,board_key,request_payload,result)
  VALUES(tid,uid,p_request_id,p_board_key,request,result);
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
  VALUES(tid,auth.jwt()->>'email','command_board.saved','command_board',p_board_key,'admin',
    jsonb_build_object('revision',coalesce(prior.revision,0),'mode',prior.document->'mode'->>'key'),
    jsonb_build_object('revision',p_revision+1,'mode',p_document->'mode'->>'key'),
    jsonb_build_object('requestId',p_request_id,'phases',jsonb_array_length(p_document->'phases')));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.save_command_board(text,bigint,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.save_command_board(text,bigint,integer,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_command_board(p_board_key text, p_revision bigint, p_position integer, p_document jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.save_command_board(p_board_key,p_revision,p_position,p_document,p_request_id);
$$;
REVOKE ALL ON FUNCTION public.save_command_board(text,bigint,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_command_board(text,bigint,integer,jsonb,uuid) TO authenticated;
