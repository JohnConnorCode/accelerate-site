BEGIN;
CREATE TABLE IF NOT EXISTS public.campaign_duplicate_receipts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), request_id uuid NOT NULL,
 request_hash text NOT NULL, source_id uuid NOT NULL, source_version integer NOT NULL,
 copy_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,request_id),
 FOREIGN KEY(tenant_id,copy_id) REFERENCES public.campaigns(tenant_id,id)
);
ALTER TABLE public.campaign_duplicate_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_duplicate_receipt_read ON public.campaign_duplicate_receipts;
CREATE POLICY campaign_duplicate_receipt_read ON public.campaign_duplicate_receipts FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.campaign_duplicate_receipts TO authenticated,service_role;
DROP TRIGGER IF EXISTS campaign_duplicate_receipt_immutable ON public.campaign_duplicate_receipts;
CREATE TRIGGER campaign_duplicate_receipt_immutable BEFORE UPDATE OR DELETE ON public.campaign_duplicate_receipts FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();

CREATE OR REPLACE FUNCTION public.duplicate_campaign_draft(p_source uuid,p_expected_version integer,p_request uuid,p_name text,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; source campaigns; copy campaigns; receipt campaign_duplicate_receipts; fingerprint text; steps jsonb;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce(cfg->'modules'->>'campaigns','true')<>'true' THEN RAISE EXCEPTION 'Campaigns disabled'; END IF;
 IF p_source IS NULL OR p_request IS NULL OR p_expected_version IS NULL OR p_expected_version<1 OR nullif(btrim(p_actor),'') IS NULL OR length(p_actor)>320 OR (p_name IS NOT NULL AND length(btrim(p_name)) NOT BETWEEN 1 AND 200) THEN RAISE EXCEPTION 'Invalid duplication request'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_source,p_expected_version,p_name)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':'||p_request::text,0));
 SELECT * INTO receipt FROM campaign_duplicate_receipts WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN
   IF receipt.request_hash<>fingerprint THEN RAISE EXCEPTION 'Duplication request identity conflict'; END IF;
   SELECT * INTO copy FROM campaigns WHERE tenant_id=t AND id=receipt.copy_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Previously duplicated draft unavailable'; END IF;
 ELSE
   SELECT * INTO source FROM campaigns WHERE tenant_id=t AND id=p_source FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Campaign source unavailable'; END IF;
   IF source.version<>p_expected_version THEN RAISE EXCEPTION 'Campaign source version changed; review the current source'; END IF;
   SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.step_order),'[]') INTO steps FROM
    (SELECT step_order,delay_days,subject_template,body_template,active FROM campaign_steps WHERE tenant_id=t AND campaign_id=p_source ORDER BY step_order FOR SHARE) s;
   IF jsonb_array_length(steps)>100 OR pg_column_size(steps)>1048576 THEN RAISE EXCEPTION 'Campaign source exceeds duplication limits'; END IF;
   INSERT INTO campaigns(tenant_id,name,channel,status,version,approved_version,approved_at,approved_by,sender_name,sender_email,audience_definition,policy,stats)
   VALUES(t,coalesce(btrim(p_name),left(source.name,193)||' (copy)'),source.channel,'draft',1,NULL,NULL,NULL,source.sender_name,source.sender_email,source.audience_definition,source.policy,jsonb_build_object('duplicated_from',source.id,'duplicated_from_version',source.version)) RETURNING * INTO copy;
   INSERT INTO campaign_steps(tenant_id,campaign_id,step_order,delay_days,subject_template,body_template,active)
   SELECT t,copy.id,s.step_order,s.delay_days,s.subject_template,s.body_template,s.active FROM jsonb_to_recordset(steps) AS s(step_order integer,delay_days integer,subject_template text,body_template text,active boolean);
   INSERT INTO campaign_duplicate_receipts(tenant_id,request_id,request_hash,source_id,source_version,copy_id) VALUES(t,p_request,fingerprint,p_source,source.version,copy.id);
   INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata) VALUES(t,p_actor,'campaign.duplicated','campaign',copy.id::text,'admin',jsonb_build_object('source_id',p_source,'source_version',source.version,'request_id',p_request));
 END IF;
 RETURN to_jsonb(copy);
END $$;
REVOKE ALL ON FUNCTION public.duplicate_campaign_draft(uuid,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_campaign_draft(uuid,integer,uuid,text,text) TO service_role;
COMMIT;
