BEGIN;

-- Review rows, approval invalidation and immutable evidence commit together.
-- Lock the same batch as execution before locking its source rows.
CREATE OR REPLACE FUNCTION public.save_contact_import_review(
  p_batch_id uuid, p_expected_updated_at timestamptz, p_rows jsonb,
  p_review_digest text, p_summary jsonb, p_actor_email text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  t uuid := private.authorized_request_tenant_id();
  batch public.contact_import_batches;
  expected_count integer;
  selected_count integer;
BEGIN
  SELECT * INTO batch FROM public.contact_import_batches
    WHERE tenant_id = t AND id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import batch not found'; END IF;
  IF batch.status NOT IN ('ready','approved','partial','failed') THEN
    RAISE EXCEPTION 'A % batch cannot be edited', batch.status;
  END IF;
  IF p_expected_updated_at IS NULL OR batch.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'The review changed. Reload it before saving.';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500
    OR p_review_digest IS NULL OR p_review_digest !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(p_summary) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid import review';
  END IF;
  PERFORM id FROM public.contact_import_rows
    WHERE tenant_id = t AND batch_id = p_batch_id ORDER BY id FOR UPDATE;
  SELECT count(*) INTO expected_count FROM public.contact_import_rows
    WHERE tenant_id = t AND batch_id = p_batch_id;
  IF expected_count <> jsonb_array_length(p_rows)
    OR expected_count <> (SELECT count(DISTINCT (r->>'id')::uuid) FROM jsonb_array_elements(p_rows) r)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) r
      WHERE NOT EXISTS (SELECT 1 FROM public.contact_import_rows old
        WHERE old.tenant_id = t AND old.batch_id = p_batch_id AND old.id = (r->>'id')::uuid)
    ) THEN RAISE EXCEPTION 'Review must contain every source row exactly once'; END IF;

  -- Imported receipts and source values are immutable during a retry review.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) r
    JOIN public.contact_import_rows old ON old.id = (r->>'id')::uuid AND old.tenant_id = t
    WHERE old.status = 'imported' AND (
      r->>'status' IS DISTINCT FROM old.status
      OR r->'reviewed_data' IS DISTINCT FROM old.reviewed_data
      OR r->>'action' IS DISTINCT FROM old.action
      OR (r->>'included')::boolean IS DISTINCT FROM old.included
    )
  ) THEN RAISE EXCEPTION 'Imported rows cannot be edited'; END IF;

  UPDATE public.contact_import_rows old SET
    reviewed_data = r.reviewed_data, action = r.action, included = r.included,
    status = r.status, errors = r.errors, warnings = r.warnings,
    match_reason = r.match_reason, matched_contact_id = r.matched_contact_id,
    matched_company_id = r.matched_company_id, error = NULL
  FROM jsonb_to_recordset(p_rows) AS r(
    id uuid, reviewed_data jsonb, action text, included boolean, status text,
    errors text[], warnings text[], match_reason text,
    matched_contact_id uuid, matched_company_id uuid
  )
  WHERE old.tenant_id = t AND old.batch_id = p_batch_id AND old.id = r.id
    AND old.status <> 'imported';
  SELECT count(*) INTO selected_count FROM public.contact_import_rows
    WHERE tenant_id = t AND batch_id = p_batch_id AND included AND action <> 'skip';
  UPDATE public.contact_import_batches SET
    status = 'ready', selected_row_count = selected_count, proposed_row_count = expected_count,
    review_digest = p_review_digest, approval_digest = NULL, approved_by = NULL,
    approved_at = NULL, completed_at = NULL, summary = p_summary, error = NULL,
    updated_at = clock_timestamp()
  WHERE tenant_id = t AND id = p_batch_id;
  INSERT INTO public.contact_import_events(tenant_id,batch_id,event_type,actor_email,summary)
    VALUES(t,p_batch_id,'review_saved',p_actor_email,
      jsonb_build_object('selected_rows',selected_count,'review_digest',p_review_digest,'summary',p_summary));
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
    VALUES(t,p_actor_email,'contact_import.review_saved','contact_import_batch',p_batch_id::text,'admin',
      jsonb_build_object('selected_rows',selected_count,'review_digest',p_review_digest,'summary',p_summary));
  RETURN p_batch_id;
END $$;
REVOKE ALL ON FUNCTION public.save_contact_import_review(uuid,timestamptz,jsonb,text,jsonb,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_contact_import_review(uuid,timestamptz,jsonb,text,jsonb,text)
  TO authenticated, service_role;

COMMIT;
