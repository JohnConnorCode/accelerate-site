BEGIN;
-- OAuth editor tokens cannot use the Data API as an unrestricted owner.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mcp_site_editor') THEN CREATE ROLE mcp_site_editor NOLOGIN NOINHERIT; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.site_editor_delegations (
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
CREATE INDEX IF NOT EXISTS site_editor_delegation_lookup ON public.site_editor_delegations(user_id,client_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS site_editor_one_active_delegation ON public.site_editor_delegations(tenant_id,user_id,client_id) WHERE revoked_at IS NULL;
ALTER TABLE public.site_editor_delegations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_editor_delegations FROM PUBLIC,anon,authenticated,mcp_site_editor;
GRANT SELECT ON public.site_editor_delegations TO service_role;

CREATE OR REPLACE FUNCTION public.manage_site_editor_delegation(
 p_operation text,p_user_id uuid,p_client_id text,p_resource text,p_actor_email text,p_grant_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; g public.site_editor_delegations;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF t IS DISTINCT FROM 'acce1e8e-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Installation owner context required'; END IF;
 PERFORM 1 FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Installation unavailable'; END IF;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=p_user_id AND role='admin' AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active owner membership required'; END IF;
 IF p_operation='grant' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':'||p_user_id::text||':'||p_client_id,0));
  UPDATE public.site_editor_delegations SET revoked_at=clock_timestamp() WHERE tenant_id=t AND user_id=p_user_id AND client_id=p_client_id AND revoked_at IS NULL;
  INSERT INTO public.site_editor_delegations(tenant_id,user_id,client_id,resource)
   VALUES(t,p_user_id,p_client_id,p_resource) RETURNING * INTO g;
 ELSIF p_operation='revoke' THEN
  UPDATE public.site_editor_delegations SET revoked_at=coalesce(revoked_at,clock_timestamp())
   WHERE tenant_id=t AND user_id=p_user_id AND id=p_grant_id RETURNING * INTO g;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delegation unavailable'; END IF;
 ELSE RAISE EXCEPTION 'Invalid delegation operation';
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'site_editor.delegation_'||p_operation,'site_editor_delegation',g.id::text,'admin',
   jsonb_build_object('clientId',g.client_id,'resource',g.resource,'expiresAt',g.expires_at,'scope','site-studio'));
 RETURN to_jsonb(g);
END $$;
REVOKE ALL ON FUNCTION public.manage_site_editor_delegation(text,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.manage_site_editor_delegation(text,uuid,text,text,text,uuid) TO service_role;

-- Configure this native Auth hook before connecting the pre-registered client.
-- This opt-in hook dedicates native OAuth issuance to Site Studio. Unknown
-- OAuth clients fail closed; ordinary first-party sign-ins remain unchanged.
-- Review existing native OAuth clients before enabling this hook.
CREATE OR REPLACE FUNCTION public.site_editor_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE claims jsonb:=event->'claims'; client text:=coalesce(event->>'client_id',event#>>'{claims,client_id}'); audience text;
BEGIN
 IF client IS NOT NULL THEN
  SELECT resource INTO audience FROM public.site_editor_delegations
   WHERE client_id=client ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'OAuth client has no scoped Site Studio registration'; END IF;
  IF FOUND THEN
   claims:=claims || jsonb_build_object('aud',audience,'role','mcp_site_editor','client_id',client);
  END IF;
 END IF;
 RETURN jsonb_set(event,'{claims}',claims);
END $$;
REVOKE ALL ON FUNCTION public.site_editor_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.site_editor_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.authorize_site_editor_delegation(
 p_grant_id uuid,p_user_id uuid,p_client_id text,p_session_id uuid
) RETURNS public.site_editor_delegations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; g public.site_editor_delegations;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF t IS DISTINCT FROM 'acce1e8e-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Installation context required'; END IF;
 PERFORM 1 FROM public.tenants WHERE id=t AND status='active'
  AND coalesce(config->'modules'->>'site-studio','true')='true' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Site Studio disabled or tenant suspended'; END IF;
 SELECT * INTO g FROM public.site_editor_delegations WHERE id=p_grant_id AND tenant_id=t
  AND user_id=p_user_id AND client_id=p_client_id AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Site Studio delegation expired or revoked'; END IF;
 PERFORM 1 FROM auth.sessions WHERE id=p_session_id AND user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OAuth session revoked'; END IF;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=p_user_id AND role='admin' AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner membership revoked'; END IF;
 RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.authorize_site_editor_delegation(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.authorize_site_editor_delegation(uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.execute_delegated_site_change(
 p_grant_id uuid,p_user_id uuid,p_client_id text,p_session_id uuid,p_action_id uuid,
 p_digest text,p_summary text,p_actor_email text,p_command jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; g public.site_editor_delegations; a public.action_queue; output jsonb; policy record; previous_source text;
BEGIN
 t:=private.authorized_request_tenant_id();
 g:=public.authorize_site_editor_delegation(p_grant_id,p_user_id,p_client_id,p_session_id);
 SELECT * INTO policy FROM public.check_autonomy('site_website_change',null);
 IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Website action prohibited by policy'; END IF;
 SELECT * INTO a FROM public.action_queue WHERE id=p_action_id AND tenant_id=t AND action_type='site_website_change' FOR UPDATE;
 IF NOT FOUND OR a.payload->>'tenantId' IS DISTINCT FROM t::text
  OR a.payload->>'digest' IS DISTINCT FROM p_digest OR a.payload->>'summary' IS DISTINCT FROM p_summary
  OR a.payload->'command' IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'Exact website proposal required'; END IF;
 -- Revocation checks precede receipt replay; old success never grants authority.
 IF a.status='executed' THEN RETURN a.result; END IF;
 IF a.status<>'pending' OR a.expires_at IS NULL OR a.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Website proposal unavailable or expired'; END IF;
 previous_source:=current_setting('app.site_editor_delegation',true);
 PERFORM set_config('app.site_editor_delegation','true',true);
 output:=public.write_site_website(
  p_command->>'operation',(p_command->>'requestKey')::uuid,(p_command->>'expectedVersion')::integer,
  (p_command->>'revisionId')::uuid,p_command->'document',p_actor_email);
 PERFORM set_config('app.site_editor_delegation',coalesce(previous_source,''),true);
 output:=jsonb_build_object('id',a.id,'action_type','site_website_change','receipt',output,
  'authorization',jsonb_build_object('mode','delegated','scope','site-studio','grantId',g.id,'clientId',g.client_id,'userId',g.user_id));
 UPDATE public.action_queue SET status='executed',result=output,executed_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=a.id AND tenant_id=t;
 -- Never populate approved_by/approved_at: a client confirmation is not a
 -- cryptographically verified per-call human approval on this server.
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'site_editor.delegated_execution','action_queue',a.id::text,'ai',output->'authorization');
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.execute_delegated_site_change(uuid,uuid,text,uuid,uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,mcp_site_editor;
GRANT EXECUTE ON FUNCTION public.execute_delegated_site_change(uuid,uuid,text,uuid,uuid,text,text,text,jsonb) TO service_role;
COMMIT;
