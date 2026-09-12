-- One already-approved import row, its business effect and its durable receipt.
-- Review/approval retain the existing batch lifecycle; this is not a second queue.
CREATE OR REPLACE FUNCTION public.apply_contact_import_row(p_batch_id uuid,p_row_id uuid,p_actor text,p_review_snapshot text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 t uuid:=private.authorized_request_tenant_id(); b public.contact_import_batches%ROWTYPE; r public.contact_import_rows%ROWTYPE;
 c public.contacts%ROWTYPE; co public.companies%ROWTYPE; actual jsonb; data jsonb; email text; v_domain text;
 contact_ids uuid[]; company_ids uuid[]; v_contact_id uuid; v_company_id uuid; changes text[]:='{}'; names text[];
 replay boolean:=false; result_json jsonb; policy record;
BEGIN
 IF nullif(btrim(p_actor),'') IS NULL OR (current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'))) THEN RAISE EXCEPTION 'Current workspace administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.contact_import_batches WHERE tenant_id=t AND id=p_batch_id FOR UPDATE;
 IF NOT FOUND OR b.status NOT IN ('executing','completed') OR b.approved_by IS DISTINCT FROM p_actor OR b.approved_at IS NULL OR b.approval_digest IS NULL OR b.approval_digest IS DISTINCT FROM b.review_digest THEN RAISE EXCEPTION 'Current exact import approval required'; END IF;
 IF length(p_review_snapshot)>2000000 OR encode(sha256(convert_to(p_review_snapshot,'UTF8')),'hex') IS DISTINCT FROM b.approval_digest THEN RAISE EXCEPTION 'Import review digest changed'; END IF;
 -- Lock the complete reviewed cohort before checking the approved serialization.
 PERFORM 1 FROM public.contact_import_rows WHERE tenant_id=t AND batch_id=b.id ORDER BY row_index,id FOR UPDATE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'rowIndex',row_index,'action',action,'included',included,'data',reviewed_data,'matchedContactId',matched_contact_id,'matchedCompanyId',matched_company_id) ORDER BY row_index),'[]') INTO actual FROM public.contact_import_rows WHERE tenant_id=t AND batch_id=b.id;
 IF actual IS DISTINCT FROM p_review_snapshot::jsonb THEN RAISE EXCEPTION 'Import rows changed after review'; END IF;
 SELECT * INTO r FROM public.contact_import_rows WHERE tenant_id=t AND batch_id=b.id AND id=p_row_id;
 IF NOT FOUND OR NOT r.included OR r.action NOT IN ('create','update') OR cardinality(r.errors)>0 THEN RAISE EXCEPTION 'Row is outside the approved import'; END IF;
 IF r.status='imported' THEN RETURN jsonb_build_object('contactId',r.imported_contact_id,'companyId',r.imported_company_id,'replayed',true,'changedFields',coalesce(r.result_summary->'changed_fields','[]')); END IF;
 IF b.status<>'executing' OR r.status NOT IN ('proposed','failed','importing') THEN RAISE EXCEPTION 'Import row is not executable'; END IF;
 SELECT * INTO policy FROM public.check_autonomy('crm.write',NULL);
 IF policy.hard_floor OR policy.level='prohibited' THEN RAISE EXCEPTION 'Contact import prohibited by current policy'; END IF;
 data:=r.reviewed_data;
 -- Old approvals remain immutable. Re-review adds the server-normalized domain
 -- to their new digest; a caller cannot reinterpret an old website at execution.
 IF NOT(data ? 'identityDomain') OR jsonb_typeof(data->'identityDomain') NOT IN ('string','null') THEN RAISE EXCEPTION 'Save and approve this import review again to bind its company identity'; END IF;
 BEGIN
 email:=nullif(lower(btrim(data->>'email')),''); v_domain:=nullif(data->>'identityDomain','');
 IF v_domain IN ('gmail.com','googlemail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','me.com','aol.com','proton.me','protonmail.com') THEN RAISE EXCEPTION 'Personal domain cannot identify an import company'; END IF;
 IF nullif(btrim(data->>'fullName'),'') IS NULL OR (email IS NULL AND nullif(data->>'phone','') IS NULL) THEN RAISE EXCEPTION 'Reviewed contact identity is incomplete'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':canonical-identity',0));
 SELECT * INTO c FROM public.contacts WHERE tenant_id=t AND source_record_type='contact_import_row' AND source_record_id=r.id FOR UPDATE;
 IF FOUND THEN
  v_contact_id:=c.id; v_company_id:=c.company_id; replay:=true;
 ELSE
  SELECT array_agg(id ORDER BY id) INTO contact_ids FROM public.contacts WHERE tenant_id=t AND email IS NOT NULL AND (lower(primary_email)=email OR email=ANY(alternate_emails));
  SELECT array_agg(id ORDER BY id) INTO company_ids FROM public.companies WHERE tenant_id=t AND v_domain IS NOT NULL AND lower(public.companies.domain)=v_domain;
  IF cardinality(contact_ids)>1 AND (r.matched_contact_id IS NULL OR NOT(r.matched_contact_id=ANY(contact_ids))) THEN RAISE EXCEPTION 'Identity needs review: multiple contacts'; END IF;
  IF cardinality(company_ids)>1 AND (r.matched_company_id IS NULL OR NOT(r.matched_company_id=ANY(company_ids))) THEN RAISE EXCEPTION 'Identity needs review: multiple companies'; END IF;
  IF r.matched_contact_id IS NOT NULL AND NOT(coalesce(r.matched_contact_id=ANY(contact_ids),false)) THEN RAISE EXCEPTION 'Approved contact match is stale'; END IF;
  IF r.matched_company_id IS NOT NULL AND NOT(coalesce(r.matched_company_id=ANY(company_ids),false)) THEN RAISE EXCEPTION 'Approved company match is stale'; END IF;
  v_contact_id:=coalesce(r.matched_contact_id,contact_ids[1]); v_company_id:=coalesce(r.matched_company_id,company_ids[1]);
  IF (r.action='create' AND v_contact_id IS NOT NULL) OR (r.action='update' AND v_contact_id IS NULL) THEN RAISE EXCEPTION 'Contact identity changed after review'; END IF;
  IF v_company_id IS NOT NULL THEN
   SELECT * INTO co FROM public.companies WHERE tenant_id=t AND id=v_company_id FOR UPDATE;
   UPDATE public.companies SET website=coalesce(nullif(co.website,''),data->>'website'),industry=coalesce(nullif(co.industry,''),data->>'industry') WHERE tenant_id=t AND id=v_company_id;
  ELSIF v_domain IS NOT NULL AND nullif(data->>'companyName','') IS NOT NULL THEN
   INSERT INTO public.companies(tenant_id,name,domain,website,industry,source,source_record_type,source_record_id,metadata)
   VALUES(t,data->>'companyName',v_domain,data->>'website',data->>'industry',coalesce(nullif(data->>'source',''),'contact_import'),'contact_import_company_row',r.id,jsonb_build_object('import_batch_id',b.id)) RETURNING id INTO v_company_id;
  END IF;
  IF v_contact_id IS NOT NULL THEN
   SELECT * INTO c FROM public.contacts WHERE tenant_id=t AND id=v_contact_id FOR UPDATE;
   IF nullif(c.phone,'') IS NULL AND nullif(data->>'phone','') IS NOT NULL THEN changes:=array_append(changes,'phone'); END IF;
   IF nullif(c.title,'') IS NULL AND nullif(data->>'role','') IS NOT NULL THEN changes:=array_append(changes,'role'); END IF;
   IF c.company_id IS NULL AND v_company_id IS NOT NULL THEN changes:=array_append(changes,'company'); END IF;
   UPDATE public.contacts SET phone=coalesce(nullif(c.phone,''),data->>'phone'),title=coalesce(nullif(c.title,''),data->>'role'),company_id=coalesce(c.company_id,apply_contact_import_row.v_company_id),metadata=coalesce(c.metadata,'{}')||jsonb_build_object('last_contact_import_batch_id',b.id)||CASE WHEN nullif(data->>'notes','') IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('import_notes',data->>'notes') END||CASE WHEN nullif(data->>'source','') IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('imported_source',data->>'source') END WHERE tenant_id=t AND id=v_contact_id;
  ELSE
   names:=regexp_split_to_array(btrim(data->>'fullName'),'\s+');
   INSERT INTO public.contacts(tenant_id,first_name,last_name,full_name,primary_email,phone,title,company_id,source,source_record_type,source_record_id,metadata)
   VALUES(t,names[1],CASE WHEN cardinality(names)>1 THEN array_to_string(names[2:cardinality(names)],' ') ELSE NULL END,data->>'fullName',email,data->>'phone',data->>'role',v_company_id,coalesce(nullif(data->>'source',''),'contact_import'),'contact_import_row',r.id,jsonb_build_object('import_batch_id',b.id)||CASE WHEN nullif(data->>'notes','') IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('import_notes',data->>'notes') END||CASE WHEN v_company_id IS NULL AND nullif(data->>'companyName','') IS NOT NULL THEN jsonb_build_object('unlinked_company_name',data->>'companyName') ELSE '{}'::jsonb END) RETURNING id INTO v_contact_id;
   changes:=array_append(changes,'created');
  END IF;
 END IF;
 INSERT INTO public.activities(tenant_id,activity_type,title,summary,contact_id,company_id,source,actor_email,external_id,metadata)
 VALUES(t,'contact_imported',CASE WHEN r.action='create' THEN 'Imported' ELSE 'Enriched' END||' contact: '||(data->>'fullName'),'Approved contact import'||CASE WHEN nullif(data->>'source','') IS NULL THEN '' ELSE ' · '||(data->>'source') END,v_contact_id,v_company_id,'contact_import',p_actor,'row:'||r.id::text,jsonb_build_object('batch_id',b.id,'row_id',r.id,'action',r.action,'changed_fields',changes,'replayed',replay)) ON CONFLICT (tenant_id,source,external_id) WHERE external_id IS NOT NULL DO NOTHING;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata)
 VALUES(t,p_actor,CASE WHEN replay THEN 'contact.import_reconciled' WHEN r.action='create' THEN 'contact.imported' ELSE 'contact.enriched' END,'contact',v_contact_id::text,jsonb_build_object('company_id',v_company_id,'changed_fields',changes),jsonb_build_object('source','admin','import_batch_id',b.id,'import_row_id',r.id));
 UPDATE public.contact_import_rows SET status='imported',imported_contact_id=v_contact_id,imported_company_id=v_company_id,result_summary=jsonb_build_object('replayed',replay,'changed_fields',changes),error=NULL,imported_at=clock_timestamp() WHERE tenant_id=t AND id=r.id;
 INSERT INTO public.contact_import_events(tenant_id,batch_id,row_id,event_type,actor_email,summary) VALUES(t,b.id,r.id,'row_imported',p_actor,jsonb_build_object('action',r.action,'contact_id',v_contact_id,'company_id',v_company_id,'replayed',replay));
 RETURN jsonb_build_object('contactId',v_contact_id,'companyId',v_company_id,'replayed',replay,'changedFields',changes);
 EXCEPTION WHEN OTHERS THEN
  UPDATE public.contact_import_rows SET status='failed',error=SQLERRM WHERE tenant_id=t AND id=r.id;
  INSERT INTO public.contact_import_events(tenant_id,batch_id,row_id,event_type,actor_email,summary) VALUES(t,b.id,r.id,'row_failed',p_actor,jsonb_build_object('error',SQLERRM));
  RETURN jsonb_build_object('error',SQLERRM);
 END;
END $$;
REVOKE ALL ON FUNCTION public.apply_contact_import_row(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_contact_import_row(uuid,uuid,text,text) TO authenticated,service_role;

-- Re-enter the same approved batch after interruption. Each row transaction
-- serializes on this batch and returns its permanent receipt on concurrent retry.
CREATE OR REPLACE FUNCTION public.claim_contact_import_batch(p_batch_id uuid,p_actor_email text)
RETURNS SETOF public.contact_import_batches LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); b public.contact_import_batches%ROWTYPE;
BEGIN
 IF nullif(btrim(p_actor_email),'') IS NULL OR (current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor_email) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'))) THEN RAISE EXCEPTION 'Current workspace administrator required'; END IF;
 SELECT * INTO b FROM public.contact_import_batches WHERE tenant_id=t AND id=p_batch_id FOR UPDATE;
 IF NOT FOUND OR b.status NOT IN ('approved','partial','failed','executing','completed') OR b.approval_digest IS NULL OR b.approval_digest IS DISTINCT FROM b.review_digest OR b.approved_by IS DISTINCT FROM p_actor_email OR b.approved_at IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.contact_import_rows WHERE tenant_id=t AND batch_id=b.id AND included AND action<>'skip' AND status<>'imported' AND NOT(reviewed_data ? 'identityDomain')) THEN RAISE EXCEPTION 'Save and approve this import review again to bind its company identity'; END IF;
 IF b.status IN ('executing','completed') THEN RETURN NEXT b; RETURN; END IF;
 UPDATE public.contact_import_batches SET status='executing',execution_claimed_at=clock_timestamp(),error=NULL WHERE tenant_id=t AND id=b.id RETURNING * INTO b;
 INSERT INTO public.contact_import_events(tenant_id,batch_id,event_type,actor_email,summary) VALUES(t,b.id,'execution_started',p_actor_email,jsonb_build_object('approval_digest',b.approval_digest));
 RETURN NEXT b;
END $$;
REVOKE ALL ON FUNCTION public.claim_contact_import_batch(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_contact_import_batch(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.finish_contact_import_batch(p_batch_id uuid,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); b public.contact_import_batches%ROWTYPE; imported integer; failed integer; skipped integer; summary_json jsonb; outcome text;
BEGIN
 IF nullif(btrim(p_actor_email),'') IS NULL OR (current_user<>'service_role' AND (auth.uid() IS NULL OR lower(p_actor_email) IS DISTINCT FROM lower(auth.jwt()->>'email') OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=auth.uid() AND role='admin' AND status='active'))) THEN RAISE EXCEPTION 'Current workspace administrator required'; END IF;
 SELECT * INTO b FROM public.contact_import_batches WHERE tenant_id=t AND id=p_batch_id FOR UPDATE;
 IF NOT FOUND OR b.approved_by IS DISTINCT FROM p_actor_email OR b.approved_at IS NULL OR b.approval_digest IS NULL OR b.approval_digest IS DISTINCT FROM b.review_digest OR b.status NOT IN ('executing','completed','partial') THEN RAISE EXCEPTION 'Current exact import approval required'; END IF;
 IF b.status<>'executing' THEN RETURN b.summary; END IF;
 SELECT count(*) FILTER(WHERE status='imported'),count(*) FILTER(WHERE included AND action<>'skip' AND status<>'imported'),count(*) FILTER(WHERE status<>'imported' AND (NOT included OR action='skip')) INTO imported,failed,skipped FROM public.contact_import_rows WHERE tenant_id=t AND batch_id=b.id;
 outcome:=CASE WHEN failed>0 THEN 'partial' ELSE 'completed' END;
 summary_json:=jsonb_build_object('imported',imported,'failed',failed,'skipped',skipped,'selected',b.selected_row_count);
 UPDATE public.contact_import_batches SET status=outcome,summary=summary_json,error=CASE WHEN failed>0 THEN failed::text||' rows need attention' ELSE NULL END,completed_at=CASE WHEN failed=0 THEN clock_timestamp() ELSE NULL END WHERE tenant_id=t AND id=b.id;
 INSERT INTO public.contact_import_events(tenant_id,batch_id,event_type,actor_email,summary) VALUES(t,b.id,outcome,p_actor_email,summary_json);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,after_state,metadata) VALUES(t,p_actor_email,'contact_import.'||outcome,'contact_import_batch',b.id::text,summary_json,jsonb_build_object('source','admin'));
 RETURN summary_json;
END $$;
REVOKE ALL ON FUNCTION public.finish_contact_import_batch(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finish_contact_import_batch(uuid,text) TO authenticated,service_role;
