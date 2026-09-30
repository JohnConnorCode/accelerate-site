BEGIN;
-- Narrow configuration writes and their content-safe audit commit together.
-- Invoker security retains the existing table grants and tenant RLS.
CREATE OR REPLACE FUNCTION public.save_workspace_configuration(p_change jsonb,p_expected jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE tid uuid:=private.request_tenant_id(); op text:=p_change->>'operation'; target text;
 c public.integration_connections; s public.admin_settings; snapshot jsonb; before_values jsonb; after_values jsonb;
 result jsonb; stamp timestamptz:=clock_timestamp(); ids jsonb; value text;
BEGIN
 IF NOT private.has_active_tenant_membership(tid) OR NOT EXISTS(
  SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=tid AND m.user_id=auth.uid() AND m.role='admin' AND m.status='active'
 ) OR lower(p_actor_email) IS DISTINCT FROM lower(auth.jwt()->>'email') THEN
  RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_change) IS DISTINCT FROM 'object' OR octet_length(p_change::text)>8192
  OR octet_length(p_expected::text)>65536 OR op IS NULL OR op NOT IN ('disconnect_provider','set_drive_folders','set_workspace_setting') THEN RAISE EXCEPTION 'Invalid configuration change'; END IF;
 IF op='set_workspace_setting' THEN
  target:=p_change->>'key'; value:=p_change->>'value';
  IF (SELECT count(*) FROM jsonb_object_keys(p_change))<>3 OR jsonb_typeof(p_change->'value') IS DISTINCT FROM 'string'
   OR target IS NULL OR target NOT IN ('RESEND_FROM_EMAIL','NEXT_PUBLIC_PLAUSIBLE_DOMAIN','SITE_URL','BUSINESS_NAME','NOTIFY_NEW_LEADS','NOTIFY_NEW_CONTACTS','NOTIFY_HOT_LEADS','NOTIFY_PROPOSAL_VIEWED','NOTIFY_TASK_OVERDUE','NOTIFY_CONTRACT_EXPIRING')
   OR value IS NULL OR length(value)>500 OR value ~ '[[:cntrl:]]'
   OR (target LIKE 'NOTIFY_%' AND value NOT IN ('true','false'))
   OR (target='BUSINESS_NAME' AND length(btrim(value))=0)
   OR (target='RESEND_FROM_EMAIL' AND value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   OR (target='SITE_URL' AND value !~ '^https://[^[:space:]@?#]+$')
   OR (target='NEXT_PUBLIC_PLAUSIBLE_DOMAIN' AND value !~* '^[a-z0-9.-]+\.[a-z]{2,}$') THEN RAISE EXCEPTION 'Invalid public preference'; END IF;
  -- Serialize an absent-row create with concurrent saves of the same key.
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':workspace-setting:'||target,0));
  SELECT * INTO s FROM public.admin_settings WHERE tenant_id=tid AND key=target FOR UPDATE;
  snapshot:=CASE WHEN FOUND THEN jsonb_build_object('key',s.key,'value',s.value,'is_secret',s.is_secret,'updated_at',s.updated_at) ELSE 'null'::jsonb END;
  IF snapshot IS DISTINCT FROM coalesce(p_expected,'null'::jsonb) OR s.is_secret IS TRUE THEN RAISE EXCEPTION 'Workspace preference changed' USING ERRCODE='40001'; END IF;
  IF s.value IS NOT DISTINCT FROM value THEN RAISE EXCEPTION 'No preference would change'; END IF;
  before_values:=jsonb_build_object('key',target,'value',s.value);
  after_values:=jsonb_build_object('key',target,'value',value);
  INSERT INTO public.admin_settings(tenant_id,key,value,is_secret,updated_at) VALUES(tid,target,value,false,stamp)
   ON CONFLICT(tenant_id,key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at;
 ELSE
  target:=CASE WHEN op='set_drive_folders' THEN 'google' ELSE p_change->>'provider' END;
  IF (SELECT count(*) FROM jsonb_object_keys(p_change))<>2 OR target IS NULL OR target NOT IN ('resend','google','calendly','openrouter','mcp','whatsapp','hubspot','stripe','postiz') THEN RAISE EXCEPTION 'Invalid provider change'; END IF;
  SELECT * INTO c FROM public.integration_connections WHERE tenant_id=tid AND provider=target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider connection missing'; END IF;
  snapshot:=jsonb_build_object('id',c.id,'status',c.status,'accountEmail',c.account_email,'scopes',coalesce(to_jsonb(c.scopes),'[]'::jsonb),'credentialVersion',coalesce(c.credential_version,1),'updatedAt',c.updated_at,'settings',coalesce(c.settings,'{}'::jsonb));
  IF snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Provider configuration changed' USING ERRCODE='40001'; END IF;
  IF op='disconnect_provider' THEN
   IF c.status NOT IN ('connected','degraded') THEN RAISE EXCEPTION 'Provider is not connected'; END IF;
   before_values:=jsonb_build_object('provider',target,'status',c.status,'credentialVersion',c.credential_version);
   after_values:=jsonb_build_object('provider',target,'status','revoked','credentialVersion',coalesce(c.credential_version,1)+1);
   UPDATE public.integration_connections SET status='revoked',encrypted_credentials='{}'::jsonb,encrypted_access_token=NULL,encrypted_refresh_token=NULL,token_expires_at=NULL,scopes=ARRAY[]::text[],environment_fallback_allowed=false,credential_version=coalesce(c.credential_version,1)+1,last_error=NULL,updated_at=stamp WHERE tenant_id=tid AND id=c.id;
  ELSE
   ids:=p_change->'folderIds';
   IF c.status<>'connected' OR jsonb_typeof(ids) IS DISTINCT FROM 'array' OR jsonb_array_length(ids)>10
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(ids) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>256 OR x#>>'{}' !~ '^[A-Za-z0-9_-]{8,}$')
    OR (SELECT count(*) FROM jsonb_array_elements(ids))<>(SELECT count(DISTINCT x) FROM jsonb_array_elements(ids) x) THEN RAISE EXCEPTION 'Invalid Drive folders'; END IF;
   before_values:=jsonb_build_object('folderIds',coalesce(c.settings->'drive_folder_ids','[]'::jsonb));
   after_values:=jsonb_build_object('folderIds',ids);
   IF before_values=after_values THEN RAISE EXCEPTION 'No Drive folders would change'; END IF;
   UPDATE public.integration_connections SET settings=coalesce(c.settings,'{}'::jsonb)||jsonb_build_object('drive_folder_ids',ids),updated_at=stamp WHERE tenant_id=tid AND id=c.id;
  END IF;
 END IF;
 result:=jsonb_build_object('status','success','operation',op,'target',target,'before',before_values,'after',after_values,'updatedAt',stamp);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
  VALUES(tid,p_actor_email,'workspace_configuration.'||op,CASE WHEN op='set_workspace_setting' THEN 'admin_settings' ELSE 'integration_connection' END,target,'admin',before_values,after_values,jsonb_build_object('operation',op));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_workspace_configuration(jsonb,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_workspace_configuration(jsonb,jsonb,text) TO authenticated;
COMMIT;
