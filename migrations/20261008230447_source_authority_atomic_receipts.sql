BEGIN;
-- A reviewed source change, its exact audit and its replay receipt commit together.
-- Direct writes are revoked; only the verified host bridge calls this command.
ALTER TABLE public.source_authority_registry ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0 CHECK(version >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS source_authority_tenant_id ON public.source_authority_registry(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.source_authority_receipts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),
 request_hash text NOT NULL,
 registry_id uuid NOT NULL,
 audit_id uuid NOT NULL REFERENCES public.audit_log(id),
 receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,request_key),
 FOREIGN KEY(tenant_id,registry_id) REFERENCES public.source_authority_registry(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS source_authority_receipt_registry ON public.source_authority_receipts(tenant_id,registry_id);
CREATE INDEX IF NOT EXISTS source_authority_receipt_audit ON public.source_authority_receipts(audit_id);
ALTER TABLE public.source_authority_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.source_authority_registry;
DROP POLICY IF EXISTS "Tenant member access" ON public.source_authority_registry;
DROP POLICY IF EXISTS source_authority_read ON public.source_authority_registry;
CREATE POLICY source_authority_read ON public.source_authority_registry FOR SELECT TO authenticated,service_role
 USING(tenant_id=private.authorized_request_tenant_id());
DROP POLICY IF EXISTS source_authority_read ON public.source_authority_receipts;
CREATE POLICY source_authority_read ON public.source_authority_receipts FOR SELECT TO authenticated,service_role
 USING(tenant_id=private.authorized_request_tenant_id());
REVOKE ALL ON public.source_authority_registry,public.source_authority_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.source_authority_registry,public.source_authority_receipts TO authenticated,service_role;
CREATE OR REPLACE FUNCTION private.source_authority_receipt_immutable() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Source receipts are immutable' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION private.source_authority_receipt_immutable() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS source_authority_receipt_immutable ON public.source_authority_receipts;
CREATE TRIGGER source_authority_receipt_immutable BEFORE UPDATE OR DELETE ON public.source_authority_receipts
 FOR EACH ROW EXECUTE FUNCTION private.source_authority_receipt_immutable();

CREATE OR REPLACE FUNCTION public.register_source_authority(p_command jsonb,p_request_key text,p_actor_id uuid,p_actor_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 t uuid; system text; domains text[]; verified timestamptz; days integer; expected integer;
 scope jsonb; fingerprint text; previous public.source_authority_registry;
 current_row public.source_authority_registry; saved public.source_authority_receipts;
 result jsonb; audit uuid; stamp timestamptz:=clock_timestamp();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Verified host required' USING ERRCODE='42501'; END IF;
 t:=private.authorized_request_tenant_id();
 -- Lock lifecycle and membership for this transaction, including receipt replay.
 PERFORM 1 FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active workspace required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=t AND user_id=p_actor_id AND role='admin' AND status='active' FOR SHARE;
 IF NOT FOUND OR p_actor_email IS NULL OR length(p_actor_email) NOT BETWEEN 3 AND 320 THEN RAISE EXCEPTION 'Current administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid source command' USING ERRCODE='22023'; END IF;
 IF octet_length(p_command::text)>16384
  OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9_-]{1,128}$'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_command) k WHERE k NOT IN ('systemKey','displayName','truthDomains','authorityTier','ownerEmail','lastVerifiedAt','verificationLapseDays','appliesTo','expectedVersion'))
  OR jsonb_typeof(p_command->'systemKey') IS DISTINCT FROM 'string'
  OR p_command->>'systemKey' !~ '^[a-z][a-z0-9_]{0,62}$'
  OR jsonb_typeof(p_command->'displayName') IS DISTINCT FROM 'string'
  OR length(btrim(p_command->>'displayName')) NOT BETWEEN 1 AND 120
  OR p_command->>'authorityTier' IS NULL OR p_command->>'authorityTier' NOT IN ('official','approved','working','low')
  OR jsonb_typeof(p_command->'ownerEmail') IS DISTINCT FROM 'string'
  OR length(p_command->>'ownerEmail')>320 OR p_command->>'ownerEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR jsonb_typeof(p_command->'truthDomains') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_command->'verificationLapseDays') IS DISTINCT FROM 'number'
  OR p_command->>'verificationLapseDays' !~ '^[0-9]{1,4}$'
  OR jsonb_typeof(p_command->'expectedVersion') IS DISTINCT FROM 'number'
  OR p_command->>'expectedVersion' !~ '^[0-9]{1,10}$'
  OR jsonb_typeof(p_command->'lastVerifiedAt') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'Invalid source command' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_command->'truthDomains') NOT BETWEEN 1 AND 32
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'truthDomains') x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' !~ '^[a-z][a-z0-9_]{0,62}$')
 THEN RAISE EXCEPTION 'Invalid truth domains' USING ERRCODE='22023'; END IF;
 BEGIN
  verified:=(p_command->>'lastVerifiedAt')::timestamptz;
  days:=(p_command->>'verificationLapseDays')::integer;
  expected:=(p_command->>'expectedVersion')::integer;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid source dates or version' USING ERRCODE='22023'; END;
 IF NOT isfinite(verified) OR verified>stamp OR days NOT BETWEEN 1 AND 3650 OR expected NOT BETWEEN 0 AND 2147483646 THEN RAISE EXCEPTION 'Invalid source verification or version' USING ERRCODE='22023'; END IF;
 scope:=nullif(p_command->'appliesTo','null'::jsonb);
 IF scope IS NOT NULL THEN
  IF jsonb_typeof(scope) IS DISTINCT FROM 'object' OR scope='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_object_keys(scope) k WHERE k NOT IN ('entityTypes','coworkerIds')) THEN RAISE EXCEPTION 'Invalid source scope' USING ERRCODE='22023'; END IF;
  IF scope ? 'entityTypes' THEN
   IF jsonb_typeof(scope->'entityTypes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid entity scope' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(scope->'entityTypes') NOT BETWEEN 1 AND 32 OR EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'entityTypes') x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' !~ '^[a-z][a-z0-9_]{0,62}$') THEN RAISE EXCEPTION 'Invalid entity scope' USING ERRCODE='22023'; END IF;
  END IF;
  IF scope ? 'coworkerIds' THEN
   IF jsonb_typeof(scope->'coworkerIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid coworker scope' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(scope->'coworkerIds') NOT BETWEEN 1 AND 16 OR EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'coworkerIds') x WHERE jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}')) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Invalid coworker scope' USING ERRCODE='22023'; END IF;
  END IF;
 END IF;
 system:=p_command->>'systemKey';
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('command',p_command,'actorId',p_actor_id,'actorEmail',p_actor_email)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':source-request:'||p_request_key,0));
 SELECT * INTO saved FROM public.source_authority_receipts WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN
  IF saved.request_hash<>fingerprint THEN RAISE EXCEPTION 'Source request key reused' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.audit_log WHERE tenant_id=t AND id=saved.audit_id AND entity_type='source_authority'
   AND entity_id=saved.registry_id::text AND action IN ('source_authority.registered','source_authority.updated')
   AND metadata->>'request_key'=p_request_key AND metadata->>'request_hash'=fingerprint
   AND after_state=saved.receipt->'entry';
  IF NOT FOUND THEN RAISE EXCEPTION 'Source receipt audit could not be verified' USING ERRCODE='55000'; END IF;
  RETURN saved.receipt||jsonb_build_object('replayed',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':source-system:'||system,0));
 -- Historical registry rows have no immutable receipts. Never invent an audit
 -- or claim an old unsafe write is verified. Reverify with a new request key.
 IF EXISTS(SELECT 1 FROM public.source_authority_registry WHERE tenant_id=t AND request_key=p_request_key) THEN RAISE EXCEPTION 'Legacy source request requires reverification' USING ERRCODE='22023'; END IF;
 SELECT * INTO previous FROM public.source_authority_registry WHERE tenant_id=t AND system_key=system FOR UPDATE;
 IF coalesce(previous.version,0)<>expected THEN RAISE EXCEPTION 'Source version changed' USING ERRCODE='40001'; END IF;
 SELECT array_agg(DISTINCT x ORDER BY x) INTO domains FROM jsonb_array_elements_text(p_command->'truthDomains') x;
 INSERT INTO public.source_authority_registry(tenant_id,system_key,display_name,truth_domains,authority_tier,owner_email,last_verified_at,verification_lapse_days,applies_to,request_key,version,created_at,updated_at)
 VALUES(t,system,btrim(p_command->>'displayName'),domains,p_command->>'authorityTier',p_command->>'ownerEmail',verified,days,scope,p_request_key,expected+1,stamp,stamp)
 ON CONFLICT(tenant_id,system_key) DO UPDATE SET display_name=EXCLUDED.display_name,truth_domains=EXCLUDED.truth_domains,
  authority_tier=EXCLUDED.authority_tier,owner_email=EXCLUDED.owner_email,last_verified_at=EXCLUDED.last_verified_at,
  verification_lapse_days=EXCLUDED.verification_lapse_days,applies_to=EXCLUDED.applies_to,request_key=EXCLUDED.request_key,version=EXCLUDED.version,updated_at=stamp
 RETURNING * INTO current_row;
 INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
 VALUES(t,p_actor_email,CASE WHEN previous.id IS NULL THEN 'source_authority.registered' ELSE 'source_authority.updated' END,'source_authority',current_row.id::text,'admin',
  CASE WHEN previous.id IS NULL THEN NULL ELSE to_jsonb(previous) END,to_jsonb(current_row),jsonb_build_object('request_key',p_request_key,'request_hash',fingerprint)) RETURNING id INTO audit;
 result:=jsonb_build_object('requestKey',p_request_key,'entry',to_jsonb(current_row),'auditId',audit,'replayed',false);
 INSERT INTO public.source_authority_receipts(tenant_id,request_key,request_hash,registry_id,audit_id,receipt) VALUES(t,p_request_key,fingerprint,current_row.id,audit,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.register_source_authority(jsonb,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_source_authority(jsonb,text,uuid,text) TO service_role;
COMMIT;
