BEGIN;
-- Reviews retain historical canonical link IDs and endpoint snapshots. No FK to
-- entity_links/messages: canonical merges may coalesce edges, and conversation
-- deletion must not erase or rewrite approval history. Missing/moved records
-- invalidate current use and require a new review.
CREATE TABLE IF NOT EXISTS public.radar_relationship_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 link_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 operation_key uuid NOT NULL, input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('reviewed','revoked')),
 assertion jsonb NOT NULL CHECK(jsonb_typeof(assertion)='object' AND pg_column_size(assertion)<=12000),
 edge_snapshot jsonb NOT NULL CHECK(jsonb_typeof(edge_snapshot)='object'),
 evidence_snapshot jsonb NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='object'),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK(valid_until>valid_from),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000), actor_email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,operation_key), UNIQUE(tenant_id,link_id,revision)
);
CREATE INDEX IF NOT EXISTS radar_relationship_current ON public.radar_relationship_reviews(tenant_id,link_id,revision DESC);
ALTER TABLE public.radar_relationship_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radar_relationship_read ON public.radar_relationship_reviews;
CREATE POLICY radar_relationship_read ON public.radar_relationship_reviews FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.radar_relationship_reviews TO authenticated;
GRANT SELECT,INSERT ON public.radar_relationship_reviews TO service_role;
DROP TRIGGER IF EXISTS radar_immutable ON public.radar_relationship_reviews;
CREATE TRIGGER radar_immutable BEFORE UPDATE OR DELETE ON public.radar_relationship_reviews
 FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();
CREATE OR REPLACE VIEW public.radar_current_relationships WITH (security_invoker=true) AS
 SELECT DISTINCT ON(tenant_id,link_id) * FROM public.radar_relationship_reviews ORDER BY tenant_id,link_id,revision DESC;
CREATE OR REPLACE VIEW public.message_evidence_context WITH (security_invoker=true) AS
 SELECT id,tenant_id,conversation_id,direction,sender_email,status,
 left(coalesce(body_text,''),20000) AS body_excerpt,
 encode(sha256(convert_to(coalesce(body_text,''),'UTF8')),'hex') AS body_hash,created_at FROM public.messages;
GRANT SELECT ON public.radar_current_relationships,public.message_evidence_context TO authenticated,service_role;

-- Fixed, tenant-bound business command. No dynamic SQL or provider effects.
CREATE OR REPLACE FUNCTION public.review_radar_relationship(
 p_operation_key uuid,p_change jsonb,p_expected_edge jsonb,p_expected_evidence jsonb,
 p_expected_config jsonb,p_actor_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE t uuid; cfg jsonb; h text; prior public.radar_relationship_reviews; latest public.radar_relationship_reviews;
 r jsonb; e jsonb; actual_edge jsonb; actual_evidence jsonb; edge public.entity_links;
 s public.radar_source_versions; msg public.messages; conv public.conversations;
 source_type text; source_id uuid; target_type text; target_id uuid; link_type text;
 evidence_text text; source_email text; matched_ids uuid[]; contact_id uuid;
 starts timestamptz; ends timestamptz; reason text; op text; quotation text; cid uuid;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_operation_key IS NULL OR jsonb_typeof(p_change) IS DISTINCT FROM 'object' OR pg_column_size(p_change)>14000
 OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid Radar relationship command'; END IF;
 op:=p_change->>'operation'; reason:=p_change->>'reason';
 IF op NOT IN ('review','revoke') OR op IS NULL OR coalesce(length(btrim(reason)),0) NOT BETWEEN 1 AND 1000
 OR (p_change->>'operationId')::uuid IS DISTINCT FROM p_operation_key THEN RAISE EXCEPTION 'Invalid relationship operation'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('change',p_change,'edge',p_expected_edge,'evidence',p_expected_evidence)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':radar-store',0));
 SELECT * INTO prior FROM radar_relationship_reviews WHERE tenant_id=t AND operation_key=p_operation_key;
 IF FOUND THEN
  IF prior.input_hash<>h THEN RAISE EXCEPTION 'Relationship operation identity conflict'; END IF;
  RETURN jsonb_build_object('replayed',true,'review',to_jsonb(prior));
 END IF;
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF cfg IS NULL OR cfg IS DISTINCT FROM p_expected_config OR cfg->'modules'->>'opportunity-radar' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'Radar configuration changed or disabled'; END IF;
 IF op='revoke' THEN
  SELECT * INTO latest FROM radar_current_relationships WHERE tenant_id=t AND link_id=(p_change->>'relationshipId')::uuid;
  IF NOT FOUND OR latest.id IS DISTINCT FROM (p_change->>'expectedReviewId')::uuid OR latest.state='revoked'
  THEN RAISE EXCEPTION 'Relationship review changed or unavailable'; END IF;
  -- Retraction remains possible even if original evidence or canonical links vanished.
  INSERT INTO radar_relationship_reviews(tenant_id,link_id,revision,operation_key,input_hash,state,assertion,edge_snapshot,evidence_snapshot,valid_from,valid_until,reason,actor_email)
  VALUES(t,latest.link_id,latest.revision+1,p_operation_key,h,'revoked',latest.assertion,latest.edge_snapshot,latest.evidence_snapshot,latest.valid_from,latest.valid_until,reason,p_actor_email)
  RETURNING * INTO prior;
 ELSE
  r:=p_change->'relationship'; e:=r->'evidence'; quotation:=e->>'quotation';
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(e) IS DISTINCT FROM 'object'
  OR coalesce(length(btrim(quotation)),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Exact cited relationship evidence required'; END IF;
  CASE r->>'kind'
   WHEN 'authorship','topic_context','business_contact_path' THEN source_type:='contact';source_id:=(r->>'contactId')::uuid;target_type:='radar_source_version';target_id:=(r->>'sourceVersionId')::uuid;
   WHEN 'affiliation' THEN source_type:='contact';source_id:=(r->>'contactId')::uuid;target_type:='company';target_id:=(r->>'companyId')::uuid;
   WHEN 'publication' THEN source_type:='company';source_id:=(r->>'companyId')::uuid;target_type:='radar_source_version';target_id:=(r->>'sourceVersionId')::uuid;
   WHEN 'introduction_offer' THEN source_type:='contact';source_id:=(r->>'fromContactId')::uuid;target_type:='contact';target_id:=(r->>'toContactId')::uuid;
   ELSE RAISE EXCEPTION 'Unsupported relationship kind';
  END CASE;
  IF source_id IS NULL OR target_id IS NULL OR (r->>'kind'='introduction_offer' AND source_id=target_id)
  THEN RAISE EXCEPTION 'Distinct canonical relationship endpoints required'; END IF;
  link_type:='radar_'||(r->>'kind');
  actual_edge:=jsonb_build_object('sourceType',source_type,'sourceId',source_id,'targetType',target_type,'targetId',target_id,'linkType',link_type);
  IF actual_edge IS DISTINCT FROM p_expected_edge THEN RAISE EXCEPTION 'Relationship endpoints changed'; END IF;
  -- Stable lock order; record identities are never resolved by a display name.
  FOR cid IN SELECT value FROM unnest(ARRAY[CASE WHEN source_type='contact' THEN source_id END,CASE WHEN target_type='contact' THEN target_id END]) value WHERE value IS NOT NULL ORDER BY value LOOP
   PERFORM 1 FROM contacts WHERE tenant_id=t AND id=cid FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Canonical relationship contact unavailable'; END IF;
  END LOOP;
  IF source_type='company' OR target_type='company' THEN
   PERFORM 1 FROM companies WHERE tenant_id=t AND id=CASE WHEN source_type='company' THEN source_id ELSE target_id END FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Canonical relationship company unavailable'; END IF;
  END IF;
  IF r->>'kind'='introduction_offer' THEN
   IF e->>'kind' IS DISTINCT FROM 'message' OR coalesce(length(btrim(r->>'offer')),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Explicit inbound introduction offer required'; END IF;
   SELECT * INTO msg FROM messages WHERE tenant_id=t AND id=(e->>'messageId')::uuid FOR SHARE;
   IF NOT FOUND OR msg.direction<>'inbound' OR msg.status<>'received' OR nullif(btrim(msg.sender_email),'') IS NULL THEN RAISE EXCEPTION 'Received introduction message unavailable'; END IF;
   SELECT * INTO conv FROM conversations WHERE tenant_id=t AND id=msg.conversation_id FOR SHARE;
   IF NOT FOUND OR conv.contact_id IS DISTINCT FROM source_id THEN RAISE EXCEPTION 'Introduction conversation identity changed'; END IF;
   source_email:=lower(btrim(msg.sender_email));
   SELECT array_agg(id ORDER BY id) INTO matched_ids FROM contacts WHERE tenant_id=t AND (lower(primary_email)=source_email OR alternate_emails @> ARRAY[source_email]);
   IF matched_ids IS DISTINCT FROM ARRAY[source_id] THEN RAISE EXCEPTION 'Introduction author identity is ambiguous or changed'; END IF;
   evidence_text:=left(coalesce(msg.body_text,''),20000);
   actual_evidence:=jsonb_build_object('kind','message','id',msg.id,'contentHash',encode(sha256(convert_to(coalesce(msg.body_text,''),'UTF8')),'hex'),'revision',NULL,'verification',msg.status,'conversationId',conv.id,'contactId',source_id,'senderEmail',msg.sender_email);
  ELSE
   IF e->>'kind' IS DISTINCT FROM 'source' THEN RAISE EXCEPTION 'Reviewed source evidence required'; END IF;
   SELECT * INTO s FROM radar_source_versions WHERE tenant_id=t AND id=(e->>'sourceVersionId')::uuid FOR SHARE;
   IF NOT FOUND OR s.verification<>'verified' OR (target_type='radar_source_version' AND target_id<>s.id) THEN RAISE EXCEPTION 'Reviewed relationship source unavailable'; END IF;
   evidence_text:=s.body_text;
   actual_evidence:=jsonb_build_object('kind','source','id',s.id,'contentHash',s.content_hash,'revision',s.revision,'verification',s.verification,'conversationId',NULL,'contactId',NULL,'senderEmail',NULL);
   IF r->>'kind'='affiliation' AND coalesce(length(btrim(r->>'role')),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Cited role required'; END IF;
   IF r->>'kind'='topic_context' AND (jsonb_typeof(r->'topics') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'topics') NOT BETWEEN 1 AND 6) THEN RAISE EXCEPTION 'Bounded topic context required'; END IF;
   IF r->>'kind'='business_contact_path' AND (coalesce(r->>'contactUrl','') !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR position(coalesce(r->>'contactUrl','') IN quotation)=0 OR coalesce(length(r->>'contactUrl'),0) NOT BETWEEN 9 AND 2000) THEN RAISE EXCEPTION 'Exact public business contact URL required'; END IF;
  END IF;
  IF actual_evidence IS DISTINCT FROM p_expected_evidence OR position(quotation IN evidence_text)=0 THEN RAISE EXCEPTION 'Relationship evidence changed or quotation is absent'; END IF;
  starts:=(p_change->>'validFrom')::timestamptz;ends:=(p_change->>'validUntil')::timestamptz;
  IF starts IS NULL OR ends IS NULL OR ends<=starts OR ends<=now() OR ends>now()+CASE WHEN r->>'kind'='introduction_offer' THEN interval '30 days' ELSE interval '365 days' END THEN RAISE EXCEPTION 'Relationship validity is invalid or expired'; END IF;
  SELECT * INTO edge FROM entity_links WHERE tenant_id=t AND source_type=actual_edge->>'sourceType' AND source_id=actual_edge->>'sourceId' AND target_type=actual_edge->>'targetType' AND target_id=actual_edge->>'targetId' AND link_type=actual_edge->>'linkType' FOR UPDATE;
  IF FOUND THEN
   SELECT * INTO latest FROM radar_current_relationships WHERE tenant_id=t AND link_id=edge.id;
  END IF;
  IF latest.id IS DISTINCT FROM (p_change->>'expectedReviewId')::uuid THEN RAISE EXCEPTION 'Relationship review changed; preview again'; END IF;
  IF edge.id IS NULL THEN
   INSERT INTO entity_links(tenant_id,source_type,source_id,target_type,target_id,link_type)
   VALUES(t,source_type,source_id::text,target_type,target_id::text,link_type)
   ON CONFLICT(tenant_id,source_type,source_id,target_type,target_id,link_type) DO NOTHING;
   SELECT * INTO edge FROM entity_links WHERE tenant_id=t AND source_type=actual_edge->>'sourceType' AND source_id=actual_edge->>'sourceId' AND target_type=actual_edge->>'targetType' AND target_id=actual_edge->>'targetId' AND link_type=actual_edge->>'linkType' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Canonical relationship link unavailable'; END IF;
  END IF;
  INSERT INTO radar_relationship_reviews(tenant_id,link_id,revision,operation_key,input_hash,state,assertion,edge_snapshot,evidence_snapshot,valid_from,valid_until,reason,actor_email)
  VALUES(t,edge.id,coalesce(latest.revision,0)+1,p_operation_key,h,'reviewed',r,actual_edge,actual_evidence,starts,ends,reason,p_actor_email) RETURNING * INTO prior;
 END IF;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor_email,'radar.relationship.'||prior.state,'entity_link',prior.link_id::text,'admin',jsonb_build_object('review_id',prior.id,'operation_id',p_operation_key));
 RETURN jsonb_build_object('replayed',false,'review',to_jsonb(prior));
END $$;
REVOKE ALL ON FUNCTION public.review_radar_relationship(uuid,jsonb,jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_radar_relationship(uuid,jsonb,jsonb,jsonb,jsonb,text) TO service_role;
COMMIT;
