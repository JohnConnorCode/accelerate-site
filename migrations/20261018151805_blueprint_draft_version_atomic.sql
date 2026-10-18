-- Append a validated Blueprint version, reset its approval and retain its audit
-- in one transaction. Request identity recovers a lost response without a new version.
ALTER TABLE public.workspace_blueprint_versions ADD COLUMN IF NOT EXISTS request_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_blueprint_version_request
  ON public.workspace_blueprint_versions(tenant_id,request_key) WHERE request_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.save_workspace_blueprint_version(
  p_tenant_id uuid,p_blueprint_id uuid,p_document jsonb,p_change_summary text,
  p_actor_email text,p_expected_version integer DEFAULT NULL,p_request_key uuid DEFAULT NULL,
  p_title text DEFAULT 'Workspace Blueprint',p_source_agent_run_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  bp public.workspace_blueprints%ROWTYPE;
  saved public.workspace_blueprint_versions%ROWTYPE;
  receipt jsonb;
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active') THEN
    RAISE EXCEPTION 'Blueprint save forbidden' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object'
    OR p_document->>'schemaVersion' IS DISTINCT FROM 'workspace-blueprint.v1'
    OR octet_length(p_document::text)>1048576
    OR p_change_summary IS NULL OR char_length(btrim(p_change_summary)) NOT BETWEEN 1 AND 2000
    OR p_expected_version<0 OR char_length(coalesce(p_actor_email,''))>320
    OR char_length(coalesce(p_title,'')) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid Blueprint version input';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('blueprint_versions:'||p_tenant_id::text,0));
  IF p_request_key IS NOT NULL THEN
    SELECT * INTO saved FROM public.workspace_blueprint_versions
      WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
    IF FOUND THEN
      IF (p_blueprint_id IS NOT NULL AND saved.blueprint_id<>p_blueprint_id)
        OR saved.document<>p_document OR saved.change_summary<>btrim(p_change_summary)
        OR saved.created_by IS DISTINCT FROM p_actor_email THEN
        RAISE EXCEPTION 'Blueprint request identity conflict';
      END IF;
      RETURN jsonb_build_object('blueprintId',saved.blueprint_id,'version',to_jsonb(saved));
    END IF;
  END IF;
  IF p_blueprint_id IS NULL THEN
    IF p_expected_version IS NOT NULL AND p_expected_version<>0 THEN RAISE EXCEPTION 'Blueprint version conflict'; END IF;
    INSERT INTO public.workspace_blueprints(tenant_id,title,status,latest_version,created_by,source_agent_run_id)
      VALUES(p_tenant_id,p_title,'draft',0,p_actor_email,p_source_agent_run_id) RETURNING * INTO bp;
  ELSE
    SELECT * INTO bp FROM public.workspace_blueprints WHERE tenant_id=p_tenant_id AND id=p_blueprint_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Blueprint not found in this workspace'; END IF;
    IF p_expected_version IS NOT NULL AND bp.latest_version<>p_expected_version THEN RAISE EXCEPTION 'Blueprint version conflict'; END IF;
  END IF;
  INSERT INTO public.workspace_blueprint_versions(tenant_id,blueprint_id,version,parent_version,document,change_summary,created_by,source_agent_run_id,request_key)
    VALUES(p_tenant_id,bp.id,bp.latest_version+1,nullif(bp.latest_version,0),p_document,btrim(p_change_summary),p_actor_email,p_source_agent_run_id,p_request_key)
    RETURNING * INTO saved;
  UPDATE public.workspace_blueprints SET latest_version=saved.version,status='draft',updated_at=now()
    WHERE tenant_id=p_tenant_id AND id=bp.id;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
    VALUES(p_tenant_id,p_actor_email,'blueprint.version_saved','workspace_blueprint',bp.id,'admin',
      jsonb_build_object('version',saved.version,'parentVersion',saved.parent_version,'changeSummary',saved.change_summary));
  RETURN jsonb_build_object('blueprintId',bp.id,'version',to_jsonb(saved));
END;
$$;
REVOKE ALL ON FUNCTION public.save_workspace_blueprint_version(uuid,uuid,jsonb,text,text,integer,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_workspace_blueprint_version(uuid,uuid,jsonb,text,text,integer,uuid,text,uuid) TO service_role;
