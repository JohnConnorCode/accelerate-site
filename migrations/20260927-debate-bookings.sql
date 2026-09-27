BEGIN;

CREATE TABLE public.debate_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 180),
  lead_contact_id uuid NOT NULL,
  counterpart_contact_id uuid,
  conversation_id uuid,
  calendar_event_id uuid,
  target_at timestamptz,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, request_key),
  FOREIGN KEY (tenant_id, lead_contact_id) REFERENCES public.contacts(tenant_id, id),
  FOREIGN KEY (tenant_id, counterpart_contact_id) REFERENCES public.contacts(tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES public.conversations(tenant_id, id),
  FOREIGN KEY (tenant_id, calendar_event_id) REFERENCES public.calendar_events(tenant_id, id),
  CHECK (counterpart_contact_id IS NULL OR counterpart_contact_id <> lead_contact_id)
);

CREATE TABLE public.debate_milestones (
  tenant_id uuid NOT NULL,
  production_id uuid NOT NULL,
  milestone text NOT NULL CHECK (milestone IN (
    'topic_interest', 'counterpart', 'proposition', 'perspective', 'format',
    'date', 'invitation', 'production_terms', 'announcement', 'recording', 'publication'
  )),
  status text NOT NULL CHECK (status IN ('proposed', 'verified', 'declined', 'cancelled')),
  value text NOT NULL CHECK (length(btrim(value)) BETWEEN 1 AND 4000),
  claim_id uuid NOT NULL,
  source_type text NOT NULL CHECK (length(btrim(source_type)) BETWEEN 1 AND 80),
  source_id text NOT NULL CHECK (length(btrim(source_id)) BETWEEN 1 AND 240),
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, production_id, milestone),
  FOREIGN KEY (tenant_id, production_id) REFERENCES public.debate_productions(tenant_id, id),
  FOREIGN KEY (tenant_id, claim_id) REFERENCES public.claims(tenant_id, id)
);

CREATE INDEX debate_productions_target ON public.debate_productions(tenant_id, target_at)
  WHERE calendar_event_id IS NULL;
CREATE INDEX debate_milestones_claim ON public.debate_milestones(tenant_id, claim_id);

ALTER TABLE public.debate_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.debate_productions, public.debate_milestones FROM anon;
GRANT SELECT ON public.debate_productions TO authenticated;
GRANT SELECT ON public.debate_milestones TO authenticated;
GRANT ALL ON public.debate_productions, public.debate_milestones TO service_role;
CREATE POLICY debate_productions_tenant ON public.debate_productions FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
CREATE POLICY debate_milestones_tenant ON public.debate_milestones FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

CREATE FUNCTION public.record_debate_milestone(
  p_production_id uuid, p_milestone text, p_status text, p_value text,
  p_source_type text, p_source_id text, p_observed_at timestamptz, p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := private.authorized_request_tenant_id();
  production public.debate_productions%ROWTYPE;
  previous public.debate_milestones%ROWTYPE;
  recorded record;
  source_uuid uuid;
BEGIN
  SELECT * INTO production FROM public.debate_productions
    WHERE tenant_id = t AND id = p_production_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Debate production is unavailable'; END IF;
  IF p_milestone NOT IN ('topic_interest','counterpart','proposition','perspective','format','date',
    'invitation','production_terms','announcement','recording','publication')
    OR p_status NOT IN ('proposed','verified','declined','cancelled')
    OR length(btrim(coalesce(p_value,''))) NOT BETWEEN 1 AND 4000
    OR length(btrim(coalesce(p_source_id,''))) NOT BETWEEN 1 AND 240
    OR p_observed_at IS NULL OR p_observed_at > now() + interval '1 day'
    OR length(btrim(coalesce(p_actor_email,''))) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'Invalid debate milestone';
  END IF;
  IF p_milestone = 'counterpart' AND p_status = 'verified'
    AND production.counterpart_contact_id IS NULL THEN
    RAISE EXCEPTION 'Counterpart must be linked before confirmation';
  END IF;
  IF p_milestone = 'date' AND p_status = 'verified' AND production.target_at IS NULL THEN
    RAISE EXCEPTION 'Date must be linked before confirmation';
  END IF;
  IF p_milestone = 'invitation' AND (
    p_source_type <> 'calendar_event' OR production.calendar_event_id IS NULL
    OR p_source_id <> production.calendar_event_id::text
  ) THEN RAISE EXCEPTION 'Invitation must link to its calendar event'; END IF;

  IF p_source_type = 'founder_confirmation' THEN
    IF p_source_id <> p_actor_email THEN RAISE EXCEPTION 'Founder confirmation source mismatch'; END IF;
  ELSIF p_source_type IN ('gmail_message','calendar_event','founder_note','drive_document','uploaded_document') THEN
    BEGIN source_uuid := p_source_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid source id'; END;
    IF NOT (
      (p_source_type = 'gmail_message' AND EXISTS(SELECT 1 FROM public.messages WHERE tenant_id=t AND id=source_uuid)) OR
      (p_source_type = 'calendar_event' AND EXISTS(SELECT 1 FROM public.calendar_events WHERE tenant_id=t AND id=source_uuid)) OR
      (p_source_type = 'founder_note' AND EXISTS(SELECT 1 FROM public.activities WHERE tenant_id=t AND id=source_uuid)) OR
      (p_source_type = 'drive_document' AND EXISTS(SELECT 1 FROM public.drive_documents WHERE tenant_id=t AND id=source_uuid)) OR
      (p_source_type = 'uploaded_document' AND EXISTS(SELECT 1 FROM public.knowledge_documents WHERE tenant_id=t AND id=source_uuid))
    ) THEN RAISE EXCEPTION 'Debate milestone source is unavailable'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported debate milestone source';
  END IF;

  SELECT * INTO previous FROM public.debate_milestones
    WHERE tenant_id=t AND production_id=p_production_id AND milestone=p_milestone;
  IF FOUND AND previous.value <> btrim(p_value) THEN
    UPDATE public.claims SET status='superseded', resolved_at=now()
      WHERE tenant_id=t AND id=previous.claim_id;
  END IF;
  SELECT * INTO recorded FROM public.record_evidence(
    'debate_production', p_production_id, p_milestone, btrim(p_value),
    p_source_type, 'Reviewed booking milestone', 'human_confirmed', p_source_id,
    jsonb_build_object('observed_at',p_observed_at,'status',p_status), NULL, NULL
  );
  IF recorded.claim_status <> 'verified' THEN RAISE EXCEPTION 'Debate milestone evidence conflicts with current state'; END IF;
  INSERT INTO public.debate_milestones(
    tenant_id,production_id,milestone,status,value,claim_id,source_type,source_id,observed_at
  ) VALUES(t,p_production_id,p_milestone,p_status,btrim(p_value),recorded.claim_id,
    p_source_type,p_source_id,p_observed_at)
  ON CONFLICT(tenant_id,production_id,milestone) DO UPDATE SET
    status=excluded.status,value=excluded.value,claim_id=excluded.claim_id,
    source_type=excluded.source_type,source_id=excluded.source_id,
    observed_at=excluded.observed_at,updated_at=now();
  UPDATE public.debate_productions SET updated_at=now() WHERE tenant_id=t AND id=p_production_id;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
    VALUES(t,p_actor_email,'debate.milestone.recorded','debate_production',p_production_id::text,
      'admin',jsonb_build_object('milestone',p_milestone,'status',p_status,'claim_id',recorded.claim_id,
      'source_type',p_source_type,'source_id',p_source_id));
  RETURN jsonb_build_object('productionId',p_production_id,'milestone',p_milestone,
    'status',p_status,'claimId',recorded.claim_id);
END $$;
REVOKE ALL ON FUNCTION public.record_debate_milestone(uuid,text,text,text,text,text,timestamptz,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_debate_milestone(uuid,text,text,text,text,text,timestamptz,text)
  TO service_role;

CREATE FUNCTION public.write_debate_production(p_operation text, p_input jsonb, p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := private.authorized_request_tenant_id();
  current_row public.debate_productions%ROWTYPE;
  result_row public.debate_productions%ROWTYPE;
  lead_id uuid;
  counterpart_id uuid;
  conversation_id uuid;
  target_at timestamptz;
  event_id uuid;
  expected_revision integer;
  is_duplicate boolean := false;
BEGIN
  IF length(btrim(coalesce(p_actor_email,''))) NOT BETWEEN 3 AND 320
    THEN RAISE EXCEPTION 'Actor email is required'; END IF;
  IF p_operation = 'create' THEN
    lead_id := (p_input->>'leadContactId')::uuid;
    counterpart_id := nullif(p_input->>'counterpartContactId','')::uuid;
    conversation_id := nullif(p_input->>'conversationId','')::uuid;
    target_at := nullif(p_input->>'targetAt','')::timestamptz;
    IF lead_id IS NULL OR length(btrim(coalesce(p_input->>'title',''))) NOT BETWEEN 3 AND 240
      OR length(btrim(coalesce(p_input->>'requestKey',''))) NOT BETWEEN 8 AND 180
      OR lead_id IS NOT DISTINCT FROM counterpart_id THEN
      RAISE EXCEPTION 'Invalid debate production';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=lead_id)
      OR (counterpart_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=counterpart_id)) THEN
      RAISE EXCEPTION 'Debate participant is unavailable';
    END IF;
    IF conversation_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.conversations WHERE tenant_id=t AND id=conversation_id
        AND channel='gmail' AND (contact_id IS NULL OR contact_id IN (lead_id,counterpart_id))
    ) THEN RAISE EXCEPTION 'Linked Gmail conversation is unavailable'; END IF;
    INSERT INTO public.debate_productions(
      tenant_id,request_key,title,lead_contact_id,counterpart_contact_id,conversation_id,target_at
    ) VALUES(t,btrim(p_input->>'requestKey'),btrim(p_input->>'title'),lead_id,counterpart_id,
      conversation_id,target_at)
    ON CONFLICT (tenant_id,request_key) DO NOTHING RETURNING * INTO result_row;
    IF NOT FOUND THEN
      SELECT * INTO result_row FROM public.debate_productions
        WHERE tenant_id=t AND request_key=btrim(p_input->>'requestKey');
      IF result_row.title <> btrim(p_input->>'title') OR result_row.lead_contact_id <> lead_id
        OR result_row.counterpart_contact_id IS DISTINCT FROM counterpart_id
        OR result_row.conversation_id IS DISTINCT FROM conversation_id
        OR result_row.target_at IS DISTINCT FROM target_at THEN
        RAISE EXCEPTION 'Debate request key already belongs to another production';
      END IF;
      is_duplicate := true;
    END IF;
    IF NOT is_duplicate THEN
      INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
      VALUES(t,p_actor_email,'debate.production.created','debate_production',result_row.id::text,
        'admin',jsonb_build_object('title',result_row.title,'lead_contact_id',lead_id));
    END IF;
    RETURN to_jsonb(result_row) || jsonb_build_object('duplicate',is_duplicate);
  END IF;

  IF p_operation NOT IN ('update','link_invitation','reopen_cancelled_invitation')
    THEN RAISE EXCEPTION 'Unknown debate operation'; END IF;
  SELECT * INTO current_row FROM public.debate_productions
    WHERE tenant_id=t AND id=(p_input->>'productionId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Debate production is unavailable'; END IF;
  expected_revision := (p_input->>'expectedRevision')::integer;
  IF expected_revision IS NULL OR current_row.revision <> expected_revision
    THEN RAISE EXCEPTION 'Debate production changed; reload before editing'; END IF;

  IF p_operation = 'reopen_cancelled_invitation' THEN
    IF current_row.calendar_event_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.calendar_events WHERE tenant_id=t AND id=current_row.calendar_event_id
        AND provider='google' AND status='cancelled'
        AND (metadata->>'debate_verified_at')::timestamptz > now() - interval '24 hours'
    ) THEN RAISE EXCEPTION 'Refresh and confirm the canceled Google invitation before reopening'; END IF;
    PERFORM public.record_debate_milestone(current_row.id,'invitation','cancelled',
      (SELECT external_id FROM public.calendar_events WHERE tenant_id=t AND id=current_row.calendar_event_id),
      'calendar_event',current_row.calendar_event_id::text,now(),p_actor_email);
    UPDATE public.debate_productions SET calendar_event_id=NULL,revision=revision+1,updated_at=now()
      WHERE tenant_id=t AND id=current_row.id RETURNING * INTO result_row;
    INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
      VALUES(t,p_actor_email,'debate.invitation.reopened','debate_production',result_row.id::text,
        'admin',jsonb_build_object('cancelled_event_id',current_row.calendar_event_id));
    RETURN to_jsonb(result_row);
  END IF;

  IF p_operation = 'link_invitation' THEN
    event_id := (p_input->>'calendarEventId')::uuid;
    IF current_row.calendar_event_id IS NOT NULL OR event_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.calendar_events WHERE tenant_id=t AND id=event_id
        AND provider='google' AND status='confirmed' AND start_at=current_row.target_at
        AND metadata->>'debate_integrity'='verified'
        AND metadata->>'debate_production_id'=current_row.id::text
    ) THEN RAISE EXCEPTION 'Verified invitation is unavailable or already linked'; END IF;
    UPDATE public.debate_productions SET calendar_event_id=event_id,
      revision=revision+1,updated_at=now() WHERE tenant_id=t AND id=current_row.id RETURNING * INTO result_row;
    INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
      VALUES(t,p_actor_email,'debate.invitation.linked','debate_production',result_row.id::text,
        'admin',jsonb_build_object('calendar_event_id',event_id));
    RETURN to_jsonb(result_row);
  END IF;

  lead_id := current_row.lead_contact_id;
  counterpart_id := CASE WHEN p_input ? 'counterpartContactId'
    THEN nullif(p_input->>'counterpartContactId','')::uuid ELSE current_row.counterpart_contact_id END;
  conversation_id := CASE WHEN p_input ? 'conversationId'
    THEN nullif(p_input->>'conversationId','')::uuid ELSE current_row.conversation_id END;
  target_at := CASE WHEN p_input ? 'targetAt'
    THEN nullif(p_input->>'targetAt','')::timestamptz ELSE current_row.target_at END;
  IF lead_id IS NOT DISTINCT FROM counterpart_id OR
    (counterpart_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.contacts WHERE tenant_id=t AND id=counterpart_id)) THEN
    RAISE EXCEPTION 'Counterpart is unavailable';
  END IF;
  IF conversation_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.conversations WHERE tenant_id=t AND id=conversation_id
      AND channel='gmail' AND (contact_id IS NULL OR contact_id IN (lead_id,counterpart_id))
  ) THEN RAISE EXCEPTION 'Linked Gmail conversation is unavailable'; END IF;
  IF counterpart_id IS DISTINCT FROM current_row.counterpart_contact_id AND EXISTS(
    SELECT 1 FROM public.debate_milestones WHERE tenant_id=t AND production_id=current_row.id
      AND milestone='counterpart' AND status='verified'
  ) THEN RAISE EXCEPTION 'Cancel the confirmed counterpart before changing it'; END IF;
  IF target_at IS DISTINCT FROM current_row.target_at AND EXISTS(
    SELECT 1 FROM public.debate_milestones WHERE tenant_id=t AND production_id=current_row.id
      AND milestone IN ('date','invitation') AND status='verified'
  ) THEN RAISE EXCEPTION 'Cancel the confirmed date before changing it'; END IF;
  IF current_row.calendar_event_id IS NOT NULL AND (
    counterpart_id IS DISTINCT FROM current_row.counterpart_contact_id OR
    target_at IS DISTINCT FROM current_row.target_at
  ) THEN RAISE EXCEPTION 'Reconcile the linked invitation before changing participants or time'; END IF;
  IF counterpart_id IS NOT DISTINCT FROM current_row.counterpart_contact_id AND
    conversation_id IS NOT DISTINCT FROM current_row.conversation_id AND
    target_at IS NOT DISTINCT FROM current_row.target_at THEN RETURN to_jsonb(current_row); END IF;
  UPDATE public.debate_productions SET counterpart_contact_id=counterpart_id,
    conversation_id=conversation_id,target_at=target_at,revision=revision+1,updated_at=now()
    WHERE tenant_id=t AND id=current_row.id RETURNING * INTO result_row;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,
    before_state,after_state) VALUES(t,p_actor_email,'debate.production.updated','debate_production',
    result_row.id::text,'admin',to_jsonb(current_row),to_jsonb(result_row));
  RETURN to_jsonb(result_row);
END $$;
REVOKE ALL ON FUNCTION public.write_debate_production(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_debate_production(text,jsonb,text) TO service_role;

COMMIT;
