BEGIN;
-- Mutate the locked current tag set, never a client snapshot. Sorted contact
-- locks make competing batches preserve each other's unrelated additions.
CREATE OR REPLACE FUNCTION public.bulk_tag_contacts(p_contacts uuid[],p_add text[],p_remove text[],p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); cfg jsonb; c contacts; target_id uuid; next_tags text[]; result jsonb:='[]'; state text; reason text;
BEGIN
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce(cfg->'modules'->>'leads-capture','true')<>'true' THEN RAISE EXCEPTION 'Leads disabled'; END IF;
 IF coalesce(cardinality(p_contacts),0) NOT BETWEEN 1 AND 200 OR array_position(p_contacts,NULL) IS NOT NULL OR p_add IS NULL OR p_remove IS NULL OR cardinality(p_add)>25 OR cardinality(p_remove)>25 OR cardinality(p_add)+cardinality(p_remove)=0 OR nullif(btrim(p_actor),'') IS NULL OR length(p_actor)>320 THEN RAISE EXCEPTION 'Invalid bulk tag request'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_add||p_remove) tag WHERE tag IS NULL OR tag !~ '^[a-z0-9][a-z0-9_-]{0,39}$') THEN RAISE EXCEPTION 'Invalid contact tag'; END IF;
 FOR target_id IN SELECT DISTINCT x FROM unnest(p_contacts) x ORDER BY x LOOP
  SELECT * INTO c FROM contacts WHERE tenant_id=t AND contacts.id=target_id FOR UPDATE;
  state:='applied'; reason:='Tags updated';
  IF NOT FOUND THEN state:='skipped'; reason:='Contact unavailable';
  ELSE
   SELECT coalesce(array_agg(tag ORDER BY tag),'{}') INTO next_tags FROM (SELECT DISTINCT tag FROM unnest(coalesce(c.tags,'{}')||p_add) tag WHERE NOT tag=ANY(p_remove)) q;
   IF cardinality(next_tags)>25 THEN state:='failed'; reason:='Would exceed 25 tags';
   ELSE
    IF next_tags=coalesce(c.tags,'{}') THEN reason:='Already in the requested state';
    ELSE UPDATE contacts SET tags=next_tags,updated_at=now() WHERE tenant_id=t AND contacts.id=target_id; END IF;
   END IF;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('contactId',target_id,'status',state,'reason',reason));
 END LOOP;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,source,metadata) VALUES(t,p_actor,'contact.bulk_tagged','contact','admin',jsonb_build_object('contact_ids',p_contacts,'add',p_add,'remove',p_remove,'outcomes',result));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bulk_tag_contacts(uuid[],text[],text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_tag_contacts(uuid[],text[],text[],text) TO service_role;

-- Single and bulk staging share recipient resolution and insertion. Bulk owns
-- p_draft_only=true; row locking prevents activation between check and insert.
CREATE OR REPLACE FUNCTION public.stage_campaign_members(p_campaign uuid,p_members jsonb,p_draft_only boolean,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); cfg jsonb; camp campaigns; c contacts; item jsonb; cid uuid; matches uuid[]; v_email text; member_id uuid; result jsonb:='[]'; state text; reason text; opportunity uuid;
BEGIN
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND OR coalesce(cfg->'modules'->>'campaigns','true')<>'true' OR (p_draft_only AND coalesce(cfg->'modules'->>'leads-capture','true')<>'true') THEN RAISE EXCEPTION 'Campaign staging disabled'; END IF;
 IF p_draft_only IS NULL OR p_campaign IS NULL OR jsonb_typeof(p_members)<>'array' OR coalesce(jsonb_array_length(p_members),0) NOT BETWEEN 1 AND 500 OR pg_column_size(p_members)>1048576 OR nullif(btrim(p_actor),'') IS NULL OR length(p_actor)>320 THEN RAISE EXCEPTION 'Invalid campaign staging request'; END IF;
 SELECT * INTO camp FROM campaigns WHERE tenant_id=t AND id=p_campaign FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign unavailable'; END IF;
 IF p_draft_only AND jsonb_array_length(p_members)>200 THEN RAISE EXCEPTION 'Select at most 200 contacts'; END IF;
 IF p_draft_only AND camp.status<>'draft' THEN RAISE EXCEPTION 'Bulk enrollment requires a draft campaign'; END IF;
 IF NOT p_draft_only AND camp.status NOT IN ('draft','review','active') THEN RAISE EXCEPTION 'Campaign is not accepting members'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_members) ORDER BY value->>'contactId',value->>'email' LOOP
  cid:=nullif(item->>'contactId','')::uuid; v_email:=lower(btrim(coalesce(item->>'email',''))); opportunity:=nullif(item->>'opportunityId','')::uuid;
  state:='skipped'; reason:='Contact unavailable'; member_id:=NULL;
  IF cid IS NULL AND v_email<>'' THEN
   SELECT array_agg(id ORDER BY id) INTO matches FROM contacts WHERE tenant_id=t AND (lower(primary_email)=v_email OR v_email=ANY(alternate_emails));
   IF cardinality(matches)=1 THEN cid:=matches[1]; END IF;
  END IF;
  -- Same contact advisory lock as suppression and send claims. Never admit an
  -- unchecked caller-supplied v_email under another contact's eligibility.
  IF cid IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':'||cid::text,0));
   SELECT * INTO c FROM contacts WHERE tenant_id=t AND id=cid FOR UPDATE;
   IF FOUND THEN
    IF v_email='' THEN v_email:=lower(btrim(coalesce(c.primary_email,''))); END IF;
    SELECT array_agg(id ORDER BY id) INTO matches FROM contacts WHERE tenant_id=t AND (lower(primary_email)=v_email OR v_email=ANY(alternate_emails));
    IF c.communication_status<>'active' THEN reason:='Contact is not active';
    ELSIF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN reason:='Contact has no valid v_email';
    ELSIF cardinality(matches) IS DISTINCT FROM 1 OR matches[1]<>cid THEN reason:='Email identity is unresolved or does not match this contact';
    ELSIF opportunity IS NOT NULL AND NOT EXISTS(SELECT 1 FROM opportunities WHERE tenant_id=t AND id=opportunity AND contact_id=cid) THEN reason:='Opportunity does not belong to this contact';
    ELSIF EXISTS(SELECT 1 FROM campaign_members WHERE tenant_id=t AND campaign_id=p_campaign AND (contact_id=cid OR lower(campaign_members.email)=v_email)) THEN reason:='Already enrolled in this campaign';
    ELSE
     INSERT INTO campaign_members(tenant_id,campaign_id,contact_id,opportunity_id,email,status,next_send_at) VALUES(t,p_campaign,cid,opportunity,v_email,'queued',CASE WHEN camp.status='active' THEN now() ELSE NULL END) ON CONFLICT DO NOTHING RETURNING id INTO member_id;
     IF member_id IS NOT NULL THEN state:='applied'; reason:='Staged as a queued member'; ELSE reason:='Already enrolled in this campaign'; END IF;
    END IF;
   END IF;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('contactId',coalesce(cid::text,''),'email',v_email,'memberId',member_id,'status',state,'reason',reason));
 END LOOP;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata) VALUES(t,p_actor,'campaign.members_staged','campaign',p_campaign::text,'admin',jsonb_build_object('draft_only',p_draft_only,'outcomes',result));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.stage_campaign_members(uuid,jsonb,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_campaign_members(uuid,jsonb,boolean,text) TO service_role;
COMMIT;
