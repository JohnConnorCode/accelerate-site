BEGIN;
-- Estimates and operator classification stay separate from verified source facts.
CREATE TABLE IF NOT EXISTS public.radar_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 opportunity_id uuid NOT NULL, opportunity_revision integer NOT NULL CHECK(opportunity_revision>0),
 operation_key uuid NOT NULL, input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 assessment jsonb NOT NULL CHECK(jsonb_typeof(assessment)='object' AND pg_column_size(assessment)<=20000),
 source_snapshots jsonb NOT NULL CHECK(jsonb_typeof(source_snapshots)='array'),
 actor_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,operation_key),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES public.radar_opportunities(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS radar_assessment_current ON public.radar_assessments(tenant_id,opportunity_id,created_at DESC,id DESC);
ALTER TABLE public.radar_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radar_assessment_read ON public.radar_assessments;
CREATE POLICY radar_assessment_read ON public.radar_assessments FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.radar_assessments TO authenticated;
GRANT SELECT,INSERT ON public.radar_assessments TO service_role;
DROP TRIGGER IF EXISTS radar_immutable ON public.radar_assessments;
CREATE TRIGGER radar_immutable BEFORE UPDATE OR DELETE ON public.radar_assessments FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();
CREATE OR REPLACE VIEW public.radar_current_assessments WITH (security_invoker=true) AS
 SELECT DISTINCT ON (tenant_id,opportunity_id) * FROM public.radar_assessments ORDER BY tenant_id,opportunity_id,created_at DESC,id DESC;
GRANT SELECT ON public.radar_current_assessments TO authenticated,service_role;
CREATE OR REPLACE VIEW public.radar_current_evidence_links WITH (security_invoker=true) AS
 SELECT l.* FROM public.radar_evidence_links l JOIN public.radar_opportunities o ON o.tenant_id=l.tenant_id AND o.id=l.opportunity_id AND o.evidence_revision=l.opportunity_revision;
GRANT SELECT ON public.radar_current_evidence_links TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.review_radar_assessment(p_operation_key uuid,p_opportunity_id uuid,p_expected_revision integer,p_expected_assessment_id uuid,p_assessment jsonb,p_expected_sources jsonb,p_expected_config jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; opp public.radar_opportunities; prior public.radar_assessments; latest uuid; h text; snapshots jsonb; content text; factor text; estimate jsonb; source_ref jsonb;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_operation_key IS NULL OR jsonb_typeof(p_assessment) IS DISTINCT FROM 'object' OR pg_column_size(p_assessment)>20000 OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid Radar assessment'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('opportunity',p_opportunity_id,'revision',p_expected_revision,'previous',p_expected_assessment_id,'assessment',p_assessment,'sources',p_expected_sources)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':radar-store',0));
 SELECT * INTO prior FROM radar_assessments WHERE tenant_id=t AND operation_key=p_operation_key;
 IF FOUND THEN
  IF prior.input_hash<>h THEN RAISE EXCEPTION 'Radar assessment operation identity conflict'; END IF;
  RETURN jsonb_build_object('replayed',true,'assessment',to_jsonb(prior));
 END IF;
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF cfg IS NULL OR cfg IS DISTINCT FROM p_expected_config OR cfg->'modules'->>'opportunity-radar' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Radar configuration changed or disabled'; END IF;
 SELECT * INTO opp FROM radar_opportunities WHERE tenant_id=t AND id=p_opportunity_id FOR SHARE;
 IF NOT FOUND OR opp.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Radar opportunity changed or unavailable'; END IF;
 IF opp.state IN ('completed','dismissed','declined','no_response') THEN RAISE EXCEPTION 'Terminal opportunity cannot receive a new assessment'; END IF;
 SELECT id INTO latest FROM radar_current_assessments WHERE tenant_id=t AND opportunity_id=opp.id;
 IF latest IS DISTINCT FROM p_expected_assessment_id THEN RAISE EXCEPTION 'Radar assessment changed; preview again'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'verification',v.verification) ORDER BY v.id),string_agg(v.title||' '||v.body_text||' '||l.observation,' ')
 INTO snapshots,content FROM radar_evidence_links l JOIN radar_source_versions v ON v.tenant_id=l.tenant_id AND v.id=l.source_version_id WHERE l.tenant_id=t AND l.opportunity_id=opp.id AND l.opportunity_revision=opp.evidence_revision;
 IF snapshots IS NULL OR jsonb_array_length(snapshots) NOT BETWEEN 1 AND 10 OR snapshots IS DISTINCT FROM p_expected_sources THEN RAISE EXCEPTION 'Radar evidence changed or unavailable'; END IF;
 IF p_assessment->>'classification' IS NULL OR p_assessment->>'classification' NOT IN ('business','public_affairs','unknown') THEN RAISE EXCEPTION 'Explicit subject classification required'; END IF;
 IF coalesce(length(p_assessment->>'classificationReason'),0) NOT BETWEEN 1 AND 500
 OR coalesce(p_assessment->>'topicKey','') !~ '^[a-z0-9][a-z0-9_-]{1,79}$'
 OR coalesce(p_assessment->>'effort','') !~ '^[1-5]$'
 OR coalesce(p_assessment->>'timeToValue','') NOT IN ('immediate','day','week','month','long_term')
 OR coalesce(length(p_assessment->>'nextAction'),0) NOT BETWEEN 1 AND 1000
 OR jsonb_typeof(p_assessment->'alternatives') IS DISTINCT FROM 'array' OR jsonb_array_length(p_assessment->'alternatives') NOT BETWEEN 1 AND 3
 OR p_assessment->>'expiresAt' IS NULL THEN RAISE EXCEPTION 'Invalid assessment fields'; END IF;
 IF jsonb_typeof(p_assessment->'estimates') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_assessment->'estimates'))<>7 THEN RAISE EXCEPTION 'Seven explicit estimates required'; END IF;
 FOREACH factor IN ARRAY ARRAY['relevance','authority','timeliness','reachability','recognition','differentiation','compounding'] LOOP
  estimate:=p_assessment->'estimates'->factor;
  IF jsonb_typeof(estimate) IS DISTINCT FROM 'object' OR NOT estimate?'value'
   OR coalesce(estimate->>'confidence','') NOT IN ('low','medium','high')
   OR coalesce(length(estimate->>'rationale'),0) NOT BETWEEN 1 AND 500
   OR jsonb_typeof(estimate->'sourceVersionIds') IS DISTINCT FROM 'array' OR jsonb_array_length(estimate->'sourceVersionIds')>10 THEN RAISE EXCEPTION 'Invalid estimate'; END IF;
  IF estimate->'value'<>'null'::jsonb AND (jsonb_typeof(estimate->'value')<>'number' OR (estimate->>'value')::numeric NOT BETWEEN 0 AND 100 OR jsonb_array_length(estimate->'sourceVersionIds')=0) THEN RAISE EXCEPTION 'Numerical estimates require cited evidence'; END IF;
  FOR source_ref IN SELECT value FROM jsonb_array_elements(estimate->'sourceVersionIds') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snapshots) snapshot WHERE snapshot->>'id'=source_ref#>>'{}') THEN RAISE EXCEPTION 'Estimate cites unavailable evidence'; END IF;
  END LOOP;
 END LOOP;
 IF (p_assessment->>'expiresAt')::timestamptz<=now() OR (p_assessment->>'expiresAt')::timestamptz>now()+interval '30 days' THEN RAISE EXCEPTION 'Assessment expiry must be within thirty days'; END IF;
 IF p_assessment->>'classification'='business' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshots) s WHERE s->>'verification'<>'verified') THEN RAISE EXCEPTION 'Business assessment needs reviewed sources'; END IF;
  content:=concat_ws(' ',content,opp.title,opp.summary,opp.recommended_action,p_assessment::text);
  IF content ~* '\m(politic[a-z]*|election[a-z]*|government[a-z]*|parliament[a-z]*|congress[a-z]*|senat[a-z]*|president[a-z]*|minister[a-z]*|legislat[a-z]*|referendum[a-z]*|public[ -]affairs|public[ -]policy|political[ -]party)\M' THEN RAISE EXCEPTION 'Public affairs signals require neutral review'; END IF;
 END IF;
 INSERT INTO radar_assessments(tenant_id,opportunity_id,opportunity_revision,operation_key,input_hash,assessment,source_snapshots,actor_email)
 VALUES(t,opp.id,opp.revision,p_operation_key,h,p_assessment,snapshots,p_actor_email) RETURNING * INTO prior;
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
 VALUES(t,p_actor_email,'radar.assessment.reviewed','radar_assessment',prior.id::text,'admin',jsonb_build_object('opportunity_id',opp.id,'operation_id',p_operation_key,'classification',p_assessment->>'classification'));
 RETURN jsonb_build_object('replayed',false,'assessment',to_jsonb(prior));
END $$;
REVOKE ALL ON FUNCTION public.review_radar_assessment(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_radar_assessment(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,text) TO service_role;
COMMIT;
