BEGIN;

-- Native OAuth tokens for workspace MCP have no Data API privileges. The
-- application verifies a live admin membership and a revocable grant on every call.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mcp_workspace') THEN
  CREATE ROLE mcp_workspace NOLOGIN NOINHERIT;
 END IF;
END $$;

CREATE TABLE public.workspace_mcp_delegations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 client_id text NOT NULL CHECK(length(client_id) BETWEEN 1 AND 128),
 resource text NOT NULL CHECK(length(resource) BETWEEN 1 AND 2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 revoked_at timestamptz,
 UNIQUE(tenant_id,id)
);
CREATE INDEX workspace_mcp_delegation_lookup
 ON public.workspace_mcp_delegations(tenant_id,user_id,client_id,created_at DESC);
CREATE UNIQUE INDEX workspace_mcp_one_active_delegation
 ON public.workspace_mcp_delegations(tenant_id,user_id,client_id) WHERE revoked_at IS NULL;
ALTER TABLE public.workspace_mcp_delegations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_mcp_delegations FROM PUBLIC,anon,authenticated,mcp_workspace,mcp_site_editor;
GRANT SELECT ON public.workspace_mcp_delegations TO service_role;

CREATE FUNCTION public.manage_workspace_mcp_delegation(
 p_operation text,p_user_id uuid,p_client_id text,p_resource text,p_actor_email text,p_grant_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; g public.workspace_mcp_delegations;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF t IS NULL THEN RAISE EXCEPTION 'Workspace context required'; END IF;
 PERFORM 1 FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 PERFORM 1 FROM public.tenant_memberships
  WHERE tenant_id=t AND user_id=p_user_id AND role='admin' AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active admin membership required'; END IF;
 IF p_operation='grant' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id,0));
  IF EXISTS(SELECT 1 FROM public.site_editor_delegations WHERE client_id=p_client_id)
   OR EXISTS(SELECT 1 FROM public.workspace_mcp_delegations
    WHERE client_id=p_client_id AND resource<>p_resource) THEN
   RAISE EXCEPTION 'OAuth client already belongs to another MCP resource';
  END IF;
  UPDATE public.workspace_mcp_delegations SET revoked_at=clock_timestamp()
   WHERE tenant_id=t AND user_id=p_user_id AND client_id=p_client_id AND revoked_at IS NULL;
  INSERT INTO public.workspace_mcp_delegations(tenant_id,user_id,client_id,resource)
   VALUES(t,p_user_id,p_client_id,p_resource) RETURNING * INTO g;
 ELSIF p_operation='revoke' THEN
  UPDATE public.workspace_mcp_delegations SET revoked_at=coalesce(revoked_at,clock_timestamp())
   WHERE tenant_id=t AND user_id=p_user_id AND id=p_grant_id AND client_id=p_client_id
   RETURNING * INTO g;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delegation unavailable'; END IF;
 ELSE RAISE EXCEPTION 'Invalid delegation operation';
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'workspace_mcp.delegation_'||p_operation,'workspace_mcp_delegation',g.id::text,'admin',
   jsonb_build_object('clientId',g.client_id,'resource',g.resource,'expiresAt',g.expires_at));
 RETURN to_jsonb(g);
END $$;
REVOKE ALL ON FUNCTION public.manage_workspace_mcp_delegation(text,uuid,text,text,text,uuid)
 FROM PUBLIC,anon,authenticated,mcp_workspace,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.manage_workspace_mcp_delegation(text,uuid,text,text,text,uuid)
 TO service_role;

-- Extend the existing opt-in native Auth hook. One client may have one resource
-- across both connections; unknown or ambiguous OAuth clients fail closed.
CREATE OR REPLACE FUNCTION public.site_editor_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE claims jsonb:=event->'claims'; client text:=coalesce(event->>'client_id',event#>>'{claims,client_id}');
 site_resource text; workspace_resource text; workspace_resources integer;
BEGIN
 IF client IS NOT NULL THEN
  SELECT resource INTO site_resource FROM public.site_editor_delegations
   WHERE client_id=client ORDER BY created_at DESC LIMIT 1;
  SELECT count(DISTINCT resource),max(resource) INTO workspace_resources,workspace_resource
   FROM public.workspace_mcp_delegations WHERE client_id=client;
  IF workspace_resources>1 OR (site_resource IS NOT NULL AND workspace_resource IS NOT NULL) THEN
   RAISE EXCEPTION 'OAuth client has ambiguous MCP resources';
  END IF;
  IF site_resource IS NOT NULL THEN
   claims:=claims || jsonb_build_object('aud',site_resource,'role','mcp_site_editor','client_id',client);
  ELSIF workspace_resource IS NOT NULL THEN
   claims:=claims || jsonb_build_object('aud',workspace_resource,'role','mcp_workspace','client_id',client);
  ELSE RAISE EXCEPTION 'OAuth client has no scoped MCP registration';
  END IF;
 END IF;
 RETURN jsonb_set(event,'{claims}',claims);
END $$;
REVOKE ALL ON FUNCTION public.site_editor_access_token_hook(jsonb)
 FROM PUBLIC,anon,authenticated,service_role,mcp_workspace,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.site_editor_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE FUNCTION public.authorize_workspace_mcp_delegation(
 p_grant_id uuid,p_user_id uuid,p_client_id text,p_session_id uuid,p_resource text
) RETURNS public.workspace_mcp_delegations
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; g public.workspace_mcp_delegations;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF t IS NULL THEN RAISE EXCEPTION 'Workspace context required'; END IF;
 PERFORM 1 FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 SELECT * INTO g FROM public.workspace_mcp_delegations
  WHERE id=p_grant_id AND tenant_id=t AND user_id=p_user_id AND client_id=p_client_id
   AND resource=p_resource AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace MCP delegation expired or revoked'; END IF;
 PERFORM 1 FROM auth.sessions WHERE id=p_session_id AND user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OAuth session revoked'; END IF;
 PERFORM 1 FROM public.tenant_memberships
  WHERE tenant_id=t AND user_id=p_user_id AND role='admin' AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admin membership revoked'; END IF;
 RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.authorize_workspace_mcp_delegation(uuid,uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated,mcp_workspace,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.authorize_workspace_mcp_delegation(uuid,uuid,text,uuid,text)
 TO service_role;

COMMIT;
