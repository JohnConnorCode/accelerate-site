BEGIN;
-- Client API roles may append audit rows. A separate private, server-owned
-- receipt prevents such inserts from forging or reserving a creation result.
CREATE TABLE IF NOT EXISTS private.opportunity_create_receipts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 request_id text NOT NULL,
 actor_email text NOT NULL,
 input jsonb NOT NULL,
 opportunity jsonb NOT NULL,
 PRIMARY KEY(tenant_id,request_id)
);
ALTER TABLE private.opportunity_create_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.opportunity_create_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.opportunity_create_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.create_opportunity_with_receipt(
 p_tenant uuid,p_actor uuid,p_actor_email text,p_request_id text,p_input jsonb,
 p_contact uuid,p_company uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 prior private.opportunity_create_receipts; opportunity public.opportunities; company_name text;
 requested public.tenants; stamp timestamptz:=clock_timestamp();
BEGIN
 IF current_user<>'service_role' OR p_tenant IS DISTINCT FROM private.request_tenant_id()
  OR p_tenant IS NULL OR length(btrim(p_request_id)) NOT BETWEEN 1 AND 200
  OR p_request_id IS NULL OR p_actor_email IS NULL THEN
  RAISE EXCEPTION 'Verified opportunity host required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO requested FROM public.tenants WHERE id=p_tenant FOR SHARE;
 IF NOT FOUND OR requested.status<>'active' THEN
  RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE='42501';
 END IF;
 -- Interactive hosts supply the authenticated actor. Background hosts remain
 -- server-only and carry an explicit tenant, as with existing host commands.
 IF p_actor IS NOT NULL THEN
  PERFORM 1 FROM public.tenant_memberships m JOIN auth.users u ON u.id=m.user_id
   WHERE m.tenant_id=p_tenant AND m.user_id=p_actor AND m.role='admin' AND m.status='active'
    AND lower(u.email)=lower(p_actor_email) FOR SHARE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 END IF;
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN
   ('name','email','phone','companyName','website','industry','opportunityName','estimatedValue','nextAction','nextActionAt','source'))
  OR coalesce(length(btrim(p_input->>'name')),0) NOT BETWEEN 1 AND 200
  OR coalesce(length(p_input->>'email'),0) NOT BETWEEN 3 AND 320
  OR p_input->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+$'
  OR jsonb_typeof(p_input->'estimatedValue') IS DISTINCT FROM 'number'
  OR (p_input->>'estimatedValue')::numeric NOT BETWEEN 0 AND 1000000000
  OR p_input->>'source' IS NULL OR p_input->>'source' !~ '^[a-z][a-z0-9_-]{0,79}$'
  OR coalesce(length(p_input->>'opportunityName'),0)>200
  OR coalesce(length(p_input->>'nextAction'),0)>500 THEN
  RAISE EXCEPTION 'Invalid opportunity input';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':opportunity-create:'||p_request_id,0));
 SELECT * INTO prior FROM private.opportunity_create_receipts WHERE tenant_id=p_tenant AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.input IS DISTINCT FROM p_input OR prior.actor_email IS DISTINCT FROM p_actor_email THEN
   RAISE EXCEPTION 'Opportunity request reused for changed input' USING ERRCODE='40001';
  END IF;
  RETURN prior.opportunity;
 END IF;
 -- Receipt lookup is read-only until the existing identity owner supplies IDs.
 IF p_contact IS NULL OR p_company IS NULL THEN RETURN NULL; END IF;
 SELECT name INTO company_name FROM public.companies WHERE tenant_id=p_tenant AND id=p_company FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=p_tenant AND id=p_contact
  AND (lower(primary_email)=lower(p_input->>'email') OR alternate_emails @> ARRAY[(p_input->>'email')])) THEN
  RAISE EXCEPTION 'Canonical customer unavailable' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.opportunities(tenant_id,name,contact_id,company_id,email,stage,source,
  estimated_value,next_action,next_action_at,owner_email)
 VALUES(p_tenant,coalesce(nullif(p_input->>'opportunityName',''),company_name),p_contact,p_company,
  p_input->>'email','new',p_input->>'source',(p_input->>'estimatedValue')::numeric,
  p_input->>'nextAction',nullif(p_input->>'nextActionAt','')::timestamptz,p_actor_email)
 RETURNING * INTO opportunity;
 INSERT INTO public.stage_events(tenant_id,opportunity_id,from_stage,to_stage,source,actor_email,reason)
 VALUES(p_tenant,opportunity.id,NULL,'new',p_input->>'source',p_actor_email,'Opportunity created');
 INSERT INTO public.activities(tenant_id,activity_type,title,opportunity_id,contact_id,company_id,
  source,actor_email,external_id,metadata,occurred_at)
 VALUES(p_tenant,'opportunity_created','Opportunity created: '||opportunity.name,opportunity.id,p_contact,p_company,
  p_input->>'source',p_actor_email,'opportunity:'||opportunity.id::text||':created',
  jsonb_build_object('stage','new','estimated_value',opportunity.estimated_value),stamp);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state,metadata)
 VALUES(p_tenant,p_actor_email,'opportunity.created','opportunity',opportunity.id::text,'admin',to_jsonb(opportunity),
  jsonb_build_object('creationRequestId',p_request_id,'input',p_input));
 INSERT INTO private.opportunity_create_receipts(tenant_id,request_id,actor_email,input,opportunity)
 VALUES(p_tenant,p_request_id,p_actor_email,p_input,to_jsonb(opportunity));
 RETURN to_jsonb(opportunity);
END $$;
REVOKE ALL ON FUNCTION public.create_opportunity_with_receipt(uuid,uuid,text,text,jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_opportunity_with_receipt(uuid,uuid,text,text,jsonb,uuid,uuid) TO service_role;
COMMIT;
