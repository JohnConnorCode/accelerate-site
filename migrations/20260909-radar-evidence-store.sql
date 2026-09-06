-- Radar extends canonical CRM and claim/evidence IDs. No source fetching or model execution.
BEGIN;
CREATE TABLE IF NOT EXISTS public.radar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  canonical_url text NOT NULL CHECK(length(canonical_url) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,canonical_url)
);
CREATE TABLE IF NOT EXISTS public.radar_source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), source_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0), version_hash text NOT NULL CHECK(version_hash ~ '^[a-f0-9]{64}$'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300), body_text text NOT NULL CHECK(length(body_text) BETWEEN 1 AND 20000),
  author text CHECK(length(author)<=200), published_at timestamptz,
  verification text NOT NULL DEFAULT 'supplied' CHECK(verification IN ('supplied','verified','retracted')),
  verification_note text, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), UNIQUE(tenant_id,source_id,version), UNIQUE(tenant_id,source_id,version_hash),
  FOREIGN KEY(tenant_id,source_id) REFERENCES public.radar_sources(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), source_version_id uuid NOT NULL,
  origin text NOT NULL DEFAULT 'operator_supplied' CHECK(origin='operator_supplied'),
  discovered_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,source_version_id),
  FOREIGN KEY(tenant_id,source_version_id) REFERENCES public.radar_source_versions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 2000),
  recommended_action text NOT NULL CHECK(length(recommended_action) BETWEEN 1 AND 1000),
  kind text NOT NULL CHECK(kind ~ '^[a-z][a-z0-9_]{1,59}$'),
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','researched','needs_review','approved','dismissed','in_progress','completed','declined','no_response')),
  review_lane text NOT NULL DEFAULT 'neutral_review' CHECK(review_lane='neutral_review'),
  evidence_revision integer NOT NULL DEFAULT 1 CHECK(evidence_revision>0),
  contact_id uuid, company_id uuid, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id),
  FOREIGN KEY(tenant_id,company_id) REFERENCES public.companies(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), opportunity_id uuid NOT NULL,
  source_version_id uuid NOT NULL, evidence_id uuid, opportunity_revision integer NOT NULL CHECK(opportunity_revision>0),
  observation text NOT NULL CHECK(length(observation) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,opportunity_id,opportunity_revision,source_version_id),
  FOREIGN KEY(tenant_id,opportunity_id) REFERENCES public.radar_opportunities(tenant_id,id),
  FOREIGN KEY(tenant_id,source_version_id) REFERENCES public.radar_source_versions(tenant_id,id),
  FOREIGN KEY(tenant_id,evidence_id) REFERENCES public.evidence(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), opportunity_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('brief','outreach_draft','content_draft','research_note')),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), body_text text NOT NULL CHECK(length(body_text) BETWEEN 1 AND 10000),
  state text NOT NULL DEFAULT 'draft' CHECK(state='draft'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,opportunity_id) REFERENCES public.radar_opportunities(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_asset_sources (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), asset_id uuid NOT NULL, source_version_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,asset_id,source_version_id),
  FOREIGN KEY(tenant_id,asset_id) REFERENCES public.radar_assets(tenant_id,id),
  FOREIGN KEY(tenant_id,source_version_id) REFERENCES public.radar_source_versions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), opportunity_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('coverage','citation','appearance','partnership','referral','other')),
  description text NOT NULL CHECK(length(description) BETWEEN 1 AND 2000), source_version_id uuid NOT NULL,
  verification text NOT NULL DEFAULT 'reported' CHECK(verification='reported'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,opportunity_id) REFERENCES public.radar_opportunities(tenant_id,id),
  FOREIGN KEY(tenant_id,source_version_id) REFERENCES public.radar_source_versions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_store_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), operation_key uuid NOT NULL,
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'), operation text NOT NULL,
  entity_id uuid NOT NULL, before_state jsonb, after_state jsonb NOT NULL, actor_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,operation_key)
);
CREATE INDEX IF NOT EXISTS radar_source_recent ON public.radar_source_versions(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS radar_opportunity_queue ON public.radar_opportunities(tenant_id,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS radar_opportunity_sources ON public.radar_evidence_links(tenant_id,opportunity_id,opportunity_revision);
CREATE INDEX IF NOT EXISTS radar_opportunity_assets ON public.radar_assets(tenant_id,opportunity_id);
CREATE INDEX IF NOT EXISTS radar_opportunity_outcomes ON public.radar_outcomes(tenant_id,opportunity_id);
CREATE INDEX IF NOT EXISTS radar_store_history ON public.radar_store_receipts(tenant_id,entity_id,created_at DESC);

CREATE OR REPLACE FUNCTION private.radar_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Radar source facts and history are immutable'; END $$;
CREATE OR REPLACE FUNCTION private.radar_source_content_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Radar source facts are immutable'; END IF;
  IF (to_jsonb(NEW)-ARRAY['verification','verification_note','revision']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['verification','verification_note','revision']) THEN
    RAISE EXCEPTION 'Radar source content requires a new version';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['radar_sources','radar_source_versions','radar_discoveries','radar_opportunities','radar_evidence_links','radar_assets','radar_asset_sources','radar_outcomes','radar_store_receipts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('DROP POLICY IF EXISTS radar_tenant_read ON public.%I',tab);
    EXECUTE format('CREATE POLICY radar_tenant_read ON public.%I FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))',tab);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',tab);
    IF tab NOT IN ('radar_source_versions','radar_opportunities') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS radar_immutable ON public.%I',tab);
      EXECUTE format('CREATE TRIGGER radar_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.radar_immutable()',tab);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS radar_source_content_immutable ON public.radar_source_versions;
CREATE TRIGGER radar_source_content_immutable BEFORE UPDATE OR DELETE ON public.radar_source_versions FOR EACH ROW EXECUTE FUNCTION private.radar_source_content_immutable();

-- Only the approved domain adapter invokes this narrow command. JSON fields are
-- validated again here; no arbitrary table, patch or SQL expression is accepted.
CREATE OR REPLACE FUNCTION public.execute_radar_store_command(p_operation_key uuid,p_change jsonb,p_expected_config jsonb,p_expected_sources jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; op text; hash text; receipt public.radar_store_receipts; entity uuid;
  src public.radar_sources; ver public.radar_source_versions; opp public.radar_opportunities;
  before_data jsonb; after_data jsonb; item jsonb; input_id uuid; next_version integer; current_sources jsonb;
BEGIN
  t:=private.authorized_request_tenant_id(); op:=p_change->>'operation';
  IF p_operation_key IS NULL OR jsonb_typeof(p_change) IS DISTINCT FROM 'object' OR pg_column_size(p_change)>80000
    OR nullif(btrim(p_actor_email),'') IS NULL OR length(p_actor_email)>320 THEN RAISE EXCEPTION 'Invalid Radar command'; END IF;
  hash:=encode(sha256(convert_to(p_change::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':radar-store',0));
  SELECT * INTO receipt FROM public.radar_store_receipts WHERE tenant_id=t AND operation_key=p_operation_key;
  IF FOUND THEN
    IF receipt.input_hash<>hash THEN RAISE EXCEPTION 'Radar operation identity conflict'; END IF;
    RETURN jsonb_build_object('replayed',true,'receipt',to_jsonb(receipt));
  END IF;
  SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
  IF cfg IS NULL OR cfg IS DISTINCT FROM p_expected_config OR cfg->'modules'->>'opportunity-radar' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Radar workspace configuration changed or module disabled';
  END IF;
  IF jsonb_typeof(p_expected_sources) IS DISTINCT FROM 'array' OR jsonb_array_length(p_expected_sources)>20 THEN RAISE EXCEPTION 'Invalid source preconditions'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_expected_sources) LOOP
    SELECT * INTO ver FROM public.radar_source_versions WHERE tenant_id=t AND id=(item->>'id')::uuid FOR SHARE;
    IF NOT FOUND OR ver.revision IS DISTINCT FROM (item->>'revision')::integer OR ver.verification IS DISTINCT FROM item->>'verification' THEN
      RAISE EXCEPTION 'Source review changed; preview again';
    END IF;
  END LOOP;
  IF op='ingest_source' THEN
    IF p_change->>'url' IS NULL OR p_change->>'url' !~ '^https://[^/@[:space:]]+([/?].*)?$'
      OR length(p_change->>'url')>2000 OR coalesce(length(p_change->>'title'),0) NOT BETWEEN 1 AND 300
      OR coalesce(length(p_change->>'bodyText'),0) NOT BETWEEN 1 AND 20000 OR length(p_change->>'author')>200 THEN RAISE EXCEPTION 'Invalid supplied source'; END IF;
    SELECT * INTO src FROM public.radar_sources WHERE tenant_id=t AND canonical_url=p_change->>'url';
    IF NOT FOUND THEN INSERT INTO public.radar_sources(tenant_id,canonical_url) VALUES(t,p_change->>'url') RETURNING * INTO src; END IF;
    SELECT * INTO ver FROM public.radar_source_versions WHERE tenant_id=t AND source_id=src.id AND version_hash=hash;
    IF NOT FOUND THEN
      SELECT coalesce(max(version),0)+1 INTO next_version FROM public.radar_source_versions WHERE tenant_id=t AND source_id=src.id;
      INSERT INTO public.radar_source_versions(tenant_id,source_id,version,version_hash,content_hash,title,body_text,author,published_at)
        VALUES(t,src.id,next_version,hash,encode(sha256(convert_to(p_change->>'bodyText','UTF8')),'hex'),p_change->>'title',p_change->>'bodyText',p_change->>'author',(p_change->>'publishedAt')::timestamptz) RETURNING * INTO ver;
      INSERT INTO public.radar_discoveries(tenant_id,source_version_id) VALUES(t,ver.id);
    END IF;
    SELECT id INTO input_id FROM public.radar_discoveries WHERE tenant_id=t AND source_version_id=ver.id;
    entity:=ver.id; after_data:=(to_jsonb(ver)-'body_text')||jsonb_build_object('discovery_id',input_id);
  ELSIF op='review_source' THEN
    SELECT * INTO ver FROM public.radar_source_versions WHERE tenant_id=t AND id=(p_change->>'sourceVersionId')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source version unavailable'; END IF;
    IF ver.revision IS DISTINCT FROM (p_change->>'expectedRevision')::integer THEN RAISE EXCEPTION 'Stale source revision'; END IF;
    IF p_change->>'verification' IS NULL OR p_change->>'verification' NOT IN ('supplied','verified','retracted') OR coalesce(length(p_change->>'reason'),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Source review requires a state and reason'; END IF;
    before_data:=to_jsonb(ver)-'body_text'; entity:=ver.id;
    UPDATE public.radar_source_versions SET verification=p_change->>'verification',verification_note=p_change->>'reason',revision=revision+1 WHERE tenant_id=t AND id=entity RETURNING to_jsonb(radar_source_versions)-'body_text' INTO after_data;
  ELSIF op='create_opportunity' THEN
    IF jsonb_typeof(p_change->'citations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_change->'citations') NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Supply bounded source citations'; END IF;
    INSERT INTO public.radar_opportunities(tenant_id,title,summary,recommended_action,kind,contact_id,company_id)
      VALUES(t,p_change->>'title',p_change->>'summary',p_change->>'recommendedAction',p_change->>'kind',(p_change->>'contactId')::uuid,(p_change->>'companyId')::uuid) RETURNING * INTO opp;
    entity:=opp.id;
    FOR item IN SELECT value FROM jsonb_array_elements(p_change->'citations') LOOP
      SELECT * INTO ver FROM public.radar_source_versions WHERE tenant_id=t AND id=(item->>'sourceVersionId')::uuid;
      IF NOT FOUND OR ver.verification='retracted' THEN RAISE EXCEPTION 'Source version unavailable or retracted'; END IF;
      INSERT INTO public.radar_evidence_links(tenant_id,opportunity_id,opportunity_revision,source_version_id,evidence_id,observation)
        VALUES(t,entity,1,ver.id,(item->>'evidenceId')::uuid,item->>'observation');
    END LOOP;
    after_data:=to_jsonb(opp);
  ELSE
    SELECT * INTO opp FROM public.radar_opportunities WHERE tenant_id=t AND id=(p_change->>'opportunityId')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Radar opportunity unavailable'; END IF;
    IF opp.revision IS DISTINCT FROM (p_change->>'expectedRevision')::integer THEN RAISE EXCEPTION 'Stale opportunity revision'; END IF;
    entity:=opp.id; before_data:=to_jsonb(opp);
    IF op='update_opportunity' THEN
      IF opp.state IN ('completed','dismissed','declined') THEN RAISE EXCEPTION 'Terminal opportunity is retained as history'; END IF;
      IF jsonb_typeof(p_change->'patch') IS DISTINCT FROM 'object' OR p_change->'patch'='{}'::jsonb
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_change->'patch') k WHERE k NOT IN ('title','summary','recommendedAction','kind','contactId','companyId'))
        OR coalesce(length(p_change->>'reason'),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid opportunity patch'; END IF;
      item:=p_change->'patch';
      UPDATE public.radar_opportunities SET title=CASE WHEN item?'title' THEN item->>'title' ELSE title END,
        summary=CASE WHEN item?'summary' THEN item->>'summary' ELSE summary END,
        recommended_action=CASE WHEN item?'recommendedAction' THEN item->>'recommendedAction' ELSE recommended_action END,
        kind=CASE WHEN item?'kind' THEN item->>'kind' ELSE kind END,
        contact_id=CASE WHEN item?'contactId' THEN (item->>'contactId')::uuid ELSE contact_id END,
        company_id=CASE WHEN item?'companyId' THEN (item->>'companyId')::uuid ELSE company_id END WHERE tenant_id=t AND id=entity;
    ELSIF op='replace_citations' THEN
      IF opp.state IN ('completed','dismissed','declined') THEN RAISE EXCEPTION 'Terminal opportunity is retained as history'; END IF;
      IF jsonb_typeof(p_change->'citations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_change->'citations') NOT BETWEEN 1 AND 10
        OR coalesce(length(p_change->>'reason'),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Supply citations and correction reason'; END IF;
      FOR item IN SELECT value FROM jsonb_array_elements(p_change->'citations') LOOP
        SELECT * INTO ver FROM public.radar_source_versions WHERE tenant_id=t AND id=(item->>'sourceVersionId')::uuid;
        IF NOT FOUND OR ver.verification='retracted' THEN RAISE EXCEPTION 'Source version unavailable or retracted'; END IF;
        INSERT INTO public.radar_evidence_links(tenant_id,opportunity_id,opportunity_revision,source_version_id,evidence_id,observation)
          VALUES(t,entity,opp.revision+1,ver.id,(item->>'evidenceId')::uuid,item->>'observation');
      END LOOP;
      UPDATE public.radar_opportunities SET evidence_revision=revision+1,state='needs_review' WHERE tenant_id=t AND id=entity;
    ELSIF op='transition_opportunity' THEN
      IF coalesce(length(p_change->>'reason'),0) NOT BETWEEN 1 AND 1000 OR NOT coalesce((CASE opp.state
        WHEN 'draft' THEN p_change->>'state' IN ('researched','needs_review','dismissed')
        WHEN 'researched' THEN p_change->>'state' IN ('needs_review','dismissed')
        WHEN 'needs_review' THEN p_change->>'state' IN ('draft','approved','dismissed')
        WHEN 'approved' THEN p_change->>'state' IN ('in_progress','needs_review','dismissed')
        WHEN 'in_progress' THEN p_change->>'state' IN ('completed','declined','no_response','needs_review')
        WHEN 'no_response' THEN p_change->>'state'='needs_review' ELSE false END),false) THEN RAISE EXCEPTION 'Invalid Radar lifecycle transition'; END IF;
      IF p_change->>'state' IN ('approved','in_progress','completed') AND EXISTS(SELECT 1 FROM public.radar_evidence_links l JOIN public.radar_source_versions v ON v.tenant_id=l.tenant_id AND v.id=l.source_version_id WHERE l.tenant_id=t AND l.opportunity_id=entity AND l.opportunity_revision=opp.evidence_revision AND v.verification<>'verified') THEN RAISE EXCEPTION 'Review every source before advancing this opportunity'; END IF;
      UPDATE public.radar_opportunities SET state=p_change->>'state' WHERE tenant_id=t AND id=entity;
    ELSIF op='add_asset' THEN
      IF jsonb_typeof(p_change->'sourceVersionIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_change->'sourceVersionIds') NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Asset needs bounded source versions'; END IF;
      INSERT INTO public.radar_assets(tenant_id,opportunity_id,kind,title,body_text) VALUES(t,entity,p_change->>'kind',p_change->>'title',p_change->>'bodyText') RETURNING id INTO input_id;
      FOR item IN SELECT value FROM jsonb_array_elements(p_change->'sourceVersionIds') LOOP
        IF NOT EXISTS(SELECT 1 FROM public.radar_evidence_links l JOIN public.radar_source_versions v ON v.tenant_id=l.tenant_id AND v.id=l.source_version_id WHERE l.tenant_id=t AND l.opportunity_id=entity AND l.opportunity_revision=opp.evidence_revision AND l.source_version_id=(item#>>'{}')::uuid AND v.verification<>'retracted') THEN RAISE EXCEPTION 'Asset source is not current opportunity evidence'; END IF;
        INSERT INTO public.radar_asset_sources(tenant_id,asset_id,source_version_id) VALUES(t,input_id,(item#>>'{}')::uuid);
      END LOOP;
    ELSIF op='record_outcome' THEN
      IF NOT EXISTS(SELECT 1 FROM public.radar_source_versions WHERE tenant_id=t AND id=(p_change->>'sourceVersionId')::uuid AND verification<>'retracted') THEN RAISE EXCEPTION 'Outcome source unavailable or retracted'; END IF;
      INSERT INTO public.radar_outcomes(tenant_id,opportunity_id,kind,description,source_version_id) VALUES(t,entity,p_change->>'kind',p_change->>'description',(p_change->>'sourceVersionId')::uuid) RETURNING id INTO input_id;
    ELSE RAISE EXCEPTION 'Unknown Radar store operation'; END IF;
    UPDATE public.radar_opportunities SET revision=revision+1,updated_at=now() WHERE tenant_id=t AND id=entity RETURNING to_jsonb(radar_opportunities) INTO after_data;
    IF input_id IS NOT NULL THEN after_data:=after_data||jsonb_build_object('created_record_id',input_id); END IF;
  END IF;
  -- A source-review change invalidates queued previews through this snapshot.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'verification',v.verification) ORDER BY v.id),'[]') INTO current_sources
    FROM public.radar_evidence_links l JOIN public.radar_source_versions v ON v.tenant_id=l.tenant_id AND v.id=l.source_version_id WHERE l.tenant_id=t AND l.opportunity_id=entity AND l.opportunity_revision=(after_data->>'evidence_revision')::integer;
  after_data:=after_data||jsonb_build_object('sources',current_sources);
  INSERT INTO public.radar_store_receipts(tenant_id,operation_key,input_hash,operation,entity_id,before_state,after_state,actor_email)
    VALUES(t,p_operation_key,hash,op,entity,before_data,after_data,p_actor_email) RETURNING * INTO receipt;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
    VALUES(t,p_actor_email,'radar.store.receipted','radar_store_receipt',receipt.id::text,'admin',jsonb_build_object('operation',op,'operation_id',p_operation_key));
  RETURN jsonb_build_object('replayed',false,'receipt',to_jsonb(receipt));
END $$;
REVOKE ALL ON FUNCTION public.execute_radar_store_command(uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_radar_store_command(uuid,jsonb,jsonb,jsonb,text) TO service_role;
COMMIT;
