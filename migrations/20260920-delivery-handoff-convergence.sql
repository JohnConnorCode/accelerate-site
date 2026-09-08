BEGIN;
-- Preserve pre-existing rows. If an installation already contains duplicates,
-- the unique index refuses the migration for explicit reconciliation; it never
-- chooses or deletes an engagement on the operator's behalf.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_handoff_opportunity_unique
 ON public.clients(tenant_id,opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_delivery_handoff_unique
 ON public.tasks(tenant_id,dedupe_key) WHERE source='delivery_handoff' AND dedupe_key IS NOT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS handoff_revision integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION private.advance_client_handoff_revision() RETURNS trigger
 LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.handoff_revision:=OLD.handoff_revision+1;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clients_handoff_revision ON public.clients;
CREATE TRIGGER clients_handoff_revision BEFORE UPDATE ON public.clients
 FOR EACH ROW EXECUTE FUNCTION private.advance_client_handoff_revision();


-- Private trigger authority permits locked source reads without granting tenant configuration writes.
-- The request tenant and current membership are rechecked before accessing any source.
CREATE OR REPLACE FUNCTION private.check_delivery_source_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.opportunities; p public.proposals; playbook public.onboarding_templates; binding jsonb; k text; role text;
BEGIN
 binding:=NEW.handoff_receipt;
 IF binding->'template_snapshot' IS NULL AND (TG_OP='INSERT' OR OLD.handoff_receipt->'template_snapshot' IS NULL) THEN RETURN NEW; END IF;
 IF NEW.tenant_id IS DISTINCT FROM private.authorized_request_tenant_id() THEN RAISE EXCEPTION 'Handoff tenant context mismatch'; END IF;
 PERFORM id FROM public.tenants WHERE id=NEW.tenant_id AND status='active' AND coalesce(config->'modules'->>'clients','true')='true' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client delivery unavailable'; END IF;
 IF TG_OP='UPDATE' AND OLD.handoff_receipt->'template_snapshot' IS NOT NULL THEN
  FOREACH k IN ARRAY ARRAY['template_snapshot','proposal_id','proposal_version','contact_id','company_id','opportunity_updated_at','canonical_stage'] LOOP
   IF (binding->k) IS DISTINCT FROM (OLD.handoff_receipt->k) THEN RAISE EXCEPTION 'Handoff source binding is immutable'; END IF;
  END LOOP;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'Handoff tenant binding is immutable'; END IF;
  IF NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id THEN RAISE EXCEPTION 'Handoff opportunity binding is immutable'; END IF;
  RETURN NEW;
 END IF;
 IF binding->'template_snapshot' IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.opportunities WHERE tenant_id=NEW.tenant_id AND id=NEW.opportunity_id FOR SHARE;
 IF NOT FOUND OR o.updated_at IS DISTINCT FROM (binding->>'opportunity_updated_at')::timestamptz THEN RAISE EXCEPTION 'Opportunity source changed or unavailable'; END IF;
 SELECT metadata->>'role' INTO role FROM public.kanban_columns WHERE tenant_id=NEW.tenant_id AND board_key='pipeline' AND column_key=CASE WHEN EXISTS(SELECT 1 FROM public.kanban_columns WHERE tenant_id=NEW.tenant_id AND board_key='pipeline' AND column_key=o.stage) THEN o.stage ELSE CASE o.stage WHEN 'calendar_viewed' THEN 'qualified' WHEN 'booked' THEN 'meeting' WHEN 'showed' THEN 'meeting' WHEN 'no_show' THEN 'nurture' ELSE o.stage END END FOR SHARE;
 IF role IS DISTINCT FROM 'won' THEN RAISE EXCEPTION 'Handoff requires a won opportunity'; END IF;
 IF o.contact_id IS DISTINCT FROM (binding->>'contact_id')::uuid OR o.company_id IS DISTINCT FROM (binding->>'company_id')::uuid THEN RAISE EXCEPTION 'Canonical source identity changed'; END IF;
 PERFORM id FROM public.contacts WHERE tenant_id=NEW.tenant_id AND id=o.contact_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Canonical contact unavailable'; END IF;
 IF o.company_id IS NOT NULL THEN
  PERFORM id FROM public.companies WHERE tenant_id=NEW.tenant_id AND id=o.company_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical company unavailable'; END IF;
 END IF;
 IF binding->>'proposal_id' IS NOT NULL THEN
  SELECT * INTO p FROM public.proposals WHERE tenant_id=NEW.tenant_id AND id=(binding->>'proposal_id')::uuid FOR SHARE;
  IF NOT FOUND OR p.opportunity_id IS DISTINCT FROM o.id OR p.version IS DISTINCT FROM (binding->>'proposal_version')::integer THEN RAISE EXCEPTION 'Proposal source changed or unavailable'; END IF;
 END IF;
 SELECT * INTO playbook FROM public.onboarding_templates WHERE tenant_id=NEW.tenant_id AND template_key=binding->'template_snapshot'->>'key' AND version=(binding->'template_snapshot'->>'version')::integer FOR SHARE;
 IF NOT FOUND OR playbook.milestones IS DISTINCT FROM binding->'template_snapshot'->'milestones' THEN RAISE EXCEPTION 'Template source changed or unavailable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.check_delivery_source_binding() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS clients_delivery_source_binding ON public.clients;
CREATE TRIGGER clients_delivery_source_binding BEFORE INSERT OR UPDATE ON public.clients
 FOR EACH ROW EXECUTE FUNCTION private.check_delivery_source_binding();

CREATE OR REPLACE FUNCTION public.publish_onboarding_template(p_key text,p_milestones jsonb,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; v integer; m jsonb;
BEGIN
 t:=private.authorized_request_tenant_id();
 PERFORM id FROM tenants WHERE id=t AND status='active' AND coalesce(config->'modules'->>'clients','true')='true' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 IF nullif(btrim(p_key),'') IS NULL OR length(p_key)>80 OR nullif(btrim(p_actor),'') IS NULL OR length(p_actor)>320 OR jsonb_typeof(p_milestones) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid onboarding template'; END IF;
 IF jsonb_array_length(p_milestones) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid milestone count'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p_milestones) LOOP
  IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR coalesce(m->>'key','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$' OR length(btrim(coalesce(m->>'title',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(m->>'description',''))>4000 OR length(coalesce(m->>'owner',''))>320 OR (m->>'due_offset_days' IS NOT NULL AND (m->>'due_offset_days')::integer NOT BETWEEN 0 AND 3650) THEN RAISE EXCEPTION 'Invalid milestone'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(p_milestones))<>jsonb_array_length(p_milestones) THEN RAISE EXCEPTION 'Duplicate milestone keys'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':onboarding:'||p_key,0));
 SELECT coalesce(max(version),0)+1 INTO v FROM onboarding_templates WHERE tenant_id=t AND template_key=p_key;
 UPDATE onboarding_templates SET active=false WHERE tenant_id=t AND template_key=p_key AND active;
 INSERT INTO onboarding_templates(tenant_id,template_key,version,active,milestones) VALUES(t,p_key,v,true,p_milestones);
 INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata) VALUES(t,p_actor,'onboarding_template.published','onboarding_template',p_key||':v'||v,'admin',jsonb_build_object('template_key',p_key,'version',v));
 RETURN jsonb_build_object('key',p_key,'version',v,'milestones',p_milestones);
END $$;
REVOKE ALL ON FUNCTION public.publish_onboarding_template(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(text,jsonb,text) TO service_role;
COMMIT;
