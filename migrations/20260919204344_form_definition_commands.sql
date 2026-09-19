BEGIN;
CREATE OR REPLACE FUNCTION public.write_form_definition(
 p_operation text,p_id uuid,p_expected_updated_at timestamptz,p_patch jsonb,p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; cfg jsonb; previous public.form_definitions; saved public.form_definitions;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR cfg->'modules'->>'form-builder' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Form builder is disabled'; END IF;
 IF p_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('create','save','status')
  OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320
  OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR octet_length(p_patch::text)>65536
  THEN RAISE EXCEPTION 'Invalid form command'; END IF;
 IF p_operation='create' THEN
  IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'New form has no previous revision'; END IF;
  INSERT INTO public.form_definitions(id,tenant_id,name,description,schema,share_token)
   VALUES(p_id,t,p_patch->>'name',coalesce(p_patch->>'description',''),coalesce(p_patch->'schema','{"elements":[]}'::jsonb),p_patch->>'share_token')
   RETURNING * INTO saved;
 ELSE
  SELECT * INTO previous FROM public.form_definitions WHERE tenant_id=t AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Form not found'; END IF;
  IF p_expected_updated_at IS NULL OR previous.updated_at IS DISTINCT FROM p_expected_updated_at
   THEN RAISE EXCEPTION 'Form changed; reload before editing'; END IF;
  IF p_operation='save' THEN
   IF previous.status<>'draft' THEN RAISE EXCEPTION 'Unpublish a live form before editing it'; END IF;
   IF p_patch->'schema' IS NULL THEN RAISE EXCEPTION 'Form schema required'; END IF;
   UPDATE public.form_definitions SET schema=p_patch->'schema',
    name=coalesce(p_patch->>'name',name),description=coalesce(p_patch->>'description',description),
    updated_at=greatest(clock_timestamp(),previous.updated_at+interval '1 microsecond')
    WHERE tenant_id=t AND id=p_id RETURNING * INTO saved;
  ELSE
   IF p_patch->>'status' IS NULL OR p_patch->>'status' NOT IN ('draft','published','archived') THEN RAISE EXCEPTION 'Invalid form status'; END IF;
   IF previous.status='archived' AND p_patch->>'status'='published' THEN RAISE EXCEPTION 'Archived forms stay archived'; END IF;
   IF p_patch->>'status'='published' AND (previous.schema IS DISTINCT FROM p_patch->'schema' OR jsonb_array_length(previous.schema->'elements')<1) THEN RAISE EXCEPTION 'Form schema changed or empty'; END IF;
   UPDATE public.form_definitions SET status=p_patch->>'status',
    published_at=CASE WHEN p_patch->>'status'='published' THEN clock_timestamp() ELSE NULL END,
    updated_at=greatest(clock_timestamp(),previous.updated_at+interval '1 microsecond')
    WHERE tenant_id=t AND id=p_id RETURNING * INTO saved;
  END IF;
 END IF;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'form_builder.'||p_operation,'form_definition',p_id::text,'admin',
   jsonb_build_object('status',saved.status,'updatedAt',saved.updated_at));
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.write_form_definition(text,uuid,timestamptz,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_form_definition(text,uuid,timestamptz,jsonb,text) TO service_role;
COMMIT;
