BEGIN;
-- Host-only command: the token identifies the form, not a caller-supplied
-- tenant. Validation uses the exact definition locked by this transaction.
ALTER TABLE public.form_submission_commands ADD COLUMN IF NOT EXISTS request_hash text;
CREATE OR REPLACE FUNCTION public.record_form_submission(
 p_token text, p_request_id uuid, p_response jsonb, p_schema jsonb,
 p_contact_name text, p_contact_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.form_definitions; old public.form_submission_commands;
 cfg jsonb; fingerprint text; result jsonb; submission_id uuid;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' OR p_request_id IS NULL
  OR p_response IS NULL OR jsonb_typeof(p_response)<>'object'
  OR octet_length(p_response::text)>131072 THEN RAISE EXCEPTION 'Invalid form submission'; END IF;
 SELECT * INTO f FROM public.form_definitions WHERE share_token=p_token FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Form not found'; END IF;
 SELECT config INTO cfg FROM public.tenants WHERE id=f.tenant_id AND status='active' FOR SHARE;
 IF NOT FOUND OR cfg->'modules'->>'form-builder' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'Form not found';
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('operation','submit','formId',f.id,'response',p_response)::text,'UTF8')),'hex');
 -- Serialize the key even when there is no receipt yet. Different forms
 -- sharing a key must conflict rather than returning another form's receipt.
 PERFORM pg_advisory_xact_lock(hashtextextended(f.tenant_id::text||':'||p_request_id::text,0));
 SELECT * INTO old FROM public.form_submission_commands
  WHERE tenant_id=f.tenant_id AND request_id=p_request_id;
 IF FOUND THEN
  IF old.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Form request key reused with different content'; END IF;
  RETURN old.result || '{"duplicate":true}'::jsonb;
 END IF;
 IF f.status<>'published' THEN RAISE EXCEPTION 'Form not found'; END IF;
 IF f.schema IS DISTINCT FROM p_schema THEN RAISE EXCEPTION 'Form changed; reload before submitting'; END IF;
 INSERT INTO public.form_submissions(tenant_id,form_id,response,contact_name,contact_email)
  VALUES(f.tenant_id,f.id,p_response,p_contact_name,p_contact_email) RETURNING id INTO submission_id;
 result:=jsonb_build_object('submissionId',submission_id,'duplicate',false,'contactEmail',p_contact_email);
 INSERT INTO public.form_submission_commands(tenant_id,request_id,request_hash,result)
  VALUES(f.tenant_id,p_request_id,fingerprint,result);
 INSERT INTO public.admin_notifications(tenant_id,type,title,description,link,priority)
  VALUES(f.tenant_id,'new_form_response',left('New response: '||f.name,120),
   CASE WHEN p_contact_email IS NULL THEN 'A new response is waiting for review in Forms.'
   ELSE 'From '||p_contact_email||'. Review in Forms.' END,'/admin/forms','info');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_form_submission(text,uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_form_submission(text,uuid,jsonb,jsonb,text,text) TO service_role;
COMMIT;
