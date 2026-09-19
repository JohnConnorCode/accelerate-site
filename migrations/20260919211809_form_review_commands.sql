BEGIN;
-- Review and canonical intake intent commit together. The existing action
-- executor owns the intake claim, failure receipt and recovery, not a second
-- unlocked lead-ingestion path in the HTTP handler.
CREATE OR REPLACE FUNCTION public.review_form_submission(
 p_id uuid,p_decision text,p_request_id uuid,p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; s public.form_submissions; cfg jsonb; prior public.form_submission_commands;
 fingerprint text; result jsonb; action_id uuid;
BEGIN
 t:=private.authorized_request_tenant_id();
 SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR cfg->'modules'->>'form-builder' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Form builder is disabled'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('accepted','rejected')
  OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid form review'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('operation','review','submissionId',p_id,'decision',p_decision,'actor',p_actor_email)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':'||p_request_id::text,0));
 SELECT * INTO prior FROM public.form_submission_commands WHERE tenant_id=t AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Form request key reused with different content'; END IF;
  RETURN prior.result || '{"duplicate":true}'::jsonb;
 END IF;
 SELECT * INTO s FROM public.form_submissions WHERE tenant_id=t AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 IF s.status<>'pending_review' THEN RAISE EXCEPTION 'Submission was already reviewed'; END IF;
 IF p_decision='accepted' THEN
  IF nullif(s.contact_email,'') IS NULL THEN RAISE EXCEPTION 'This response has no email address'; END IF;
  INSERT INTO public.action_queue(tenant_id,action_type,title,description,payload,source_context,entity_type,entity_id,dedupe_key,proposed_by,expires_at)
   VALUES(t,'accept_form_submission','Accept form response into the pipeline',
    'Run canonical intake for the reviewed response. Failed intake remains visible for operator recovery.',
    jsonb_build_object('tenantId',t,'submissionId',p_id),'form-builder','form_submission',p_id,
    'form-intake:'||p_id::text,p_actor_email,clock_timestamp()+interval '1 day') RETURNING id INTO action_id;
 END IF;
 UPDATE public.form_submissions SET status=p_decision,reviewer_email=p_actor_email,reviewed_at=clock_timestamp()
  WHERE tenant_id=t AND id=p_id;
 result:=jsonb_build_object('submissionId',p_id,'decision',p_decision,'duplicate',false,'actionId',action_id);
 INSERT INTO public.form_submission_commands(tenant_id,request_id,request_hash,result) VALUES(t,p_request_id,fingerprint,result);
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
  VALUES(t,p_actor_email,'form_builder.review_submission','form_submission',p_id::text,'admin',result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.review_form_submission(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_form_submission(uuid,text,uuid,text) TO service_role;
COMMIT;
