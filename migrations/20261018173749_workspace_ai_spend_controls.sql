-- Workspace AI is opt-in. Reservations serialize concurrent requests and retain
-- uncertain provider costs instead of granting the same money a second time.
CREATE TABLE IF NOT EXISTS public.workspace_ai_controls (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  enabled boolean NOT NULL DEFAULT false,
  recurring_enabled boolean NOT NULL DEFAULT false,
  daily_usd numeric NOT NULL DEFAULT 0 CHECK(daily_usd BETWEEN 0 AND 10000),
  monthly_usd numeric NOT NULL DEFAULT 0 CHECK(monthly_usd BETWEEN 0 AND 100000),
  request_usd numeric NOT NULL DEFAULT 0 CHECK(request_usd BETWEEN 0 AND 100),
  daily_calls integer NOT NULL DEFAULT 0 CHECK(daily_calls BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.workspace_ai_reservations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  job text NOT NULL CHECK(char_length(job) BETWEEN 1 AND 100),
  model text NOT NULL CHECK(char_length(model) BETWEEN 1 AND 200),
  reserved_usd numeric NOT NULL CHECK(reserved_usd BETWEEN 0 AND 100),
  actual_usd numeric CHECK(actual_usd>=0 AND actual_usd<100000),
  provider_request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_ai_reservations_period ON public.workspace_ai_reservations(tenant_id,created_at);
ALTER TABLE public.workspace_ai_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_ai_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_ai_controls,public.workspace_ai_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.workspace_ai_controls,public.workspace_ai_reservations TO authenticated;
GRANT ALL ON public.workspace_ai_controls,public.workspace_ai_reservations TO service_role;
DROP POLICY IF EXISTS "Workspace member read" ON public.workspace_ai_controls;
CREATE POLICY "Workspace member read" ON public.workspace_ai_controls FOR SELECT TO authenticated
  USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Workspace member read" ON public.workspace_ai_reservations;
CREATE POLICY "Workspace member read" ON public.workspace_ai_reservations FOR SELECT TO authenticated
  USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

CREATE OR REPLACE FUNCTION public.save_workspace_ai_controls(
  p_tenant_id uuid,p_actor_id uuid,p_actor_email text,p_revision integer,p_policy jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.workspace_ai_controls%ROWTYPE;
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active')
    OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND status='active' AND role='admin')
    THEN RAISE EXCEPTION 'Workspace administrator required' USING ERRCODE='42501'; END IF;
  IF p_policy IS NULL OR jsonb_typeof(p_policy)<>'object' OR
    (SELECT count(*) FROM jsonb_object_keys(p_policy))<>6 OR
    NOT(p_policy ?& ARRAY['enabled','recurringEnabled','dailyUsd','monthlyUsd','requestUsd','dailyCalls']) OR
    jsonb_typeof(p_policy->'enabled')<>'boolean' OR jsonb_typeof(p_policy->'recurringEnabled')<>'boolean' OR
    jsonb_typeof(p_policy->'dailyUsd')<>'number' OR jsonb_typeof(p_policy->'monthlyUsd')<>'number' OR
    jsonb_typeof(p_policy->'requestUsd')<>'number' OR jsonb_typeof(p_policy->'dailyCalls')<>'number'
    THEN RAISE EXCEPTION 'Invalid AI controls'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-ai:'||p_tenant_id::text,0));
  INSERT INTO public.workspace_ai_controls(tenant_id) VALUES(p_tenant_id) ON CONFLICT DO NOTHING;
  UPDATE public.workspace_ai_controls SET revision=revision+1,
    enabled=(p_policy->>'enabled')::boolean,recurring_enabled=(p_policy->>'recurringEnabled')::boolean,
    daily_usd=(p_policy->>'dailyUsd')::numeric,monthly_usd=(p_policy->>'monthlyUsd')::numeric,
    request_usd=(p_policy->>'requestUsd')::numeric,daily_calls=(p_policy->>'dailyCalls')::integer,updated_at=now()
    WHERE tenant_id=p_tenant_id AND revision=p_revision RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI controls changed. Refresh before saving'; END IF;
  INSERT INTO public.audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,after_state)
    VALUES(p_tenant_id,p_actor_email,'workspace.ai_controls_saved','workspace',p_tenant_id,'admin',to_jsonb(saved));
  RETURN to_jsonb(saved);
END $$;

CREATE OR REPLACE FUNCTION public.reserve_workspace_ai_call(
  p_tenant_id uuid,p_id uuid,p_job text,p_model text,p_reserved_usd numeric,p_recurring boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE policy public.workspace_ai_controls%ROWTYPE; day_start timestamptz; month_start timestamptz;
  day_usd numeric; month_usd numeric; calls integer;
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active')
    THEN RAISE EXCEPTION 'AI workspace context required' USING ERRCODE='42501'; END IF;
  IF p_reserved_usd IS NULL OR p_reserved_usd<0 OR p_reserved_usd>100 OR p_reserved_usd::text IN ('NaN','Infinity','-Infinity')
    OR p_recurring IS NULL THEN RAISE EXCEPTION 'Invalid AI reservation'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-ai:'||p_tenant_id::text,0));
  SELECT * INTO policy FROM public.workspace_ai_controls WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR NOT policy.enabled THEN RAISE EXCEPTION 'AI calls are paused. Open AI > Cost controls'; END IF;
  IF p_recurring AND NOT policy.recurring_enabled THEN RAISE EXCEPTION 'Recurring AI work is paused'; END IF;
  IF EXISTS(SELECT 1 FROM public.workspace_ai_reservations WHERE id=p_id) THEN RAISE EXCEPTION 'AI request already reserved'; END IF;
  day_start := date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  month_start := date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT coalesce(sum(coalesce(actual_usd,reserved_usd)) FILTER(WHERE created_at>=day_start),0),
    coalesce(sum(coalesce(actual_usd,reserved_usd)),0),count(*) FILTER(WHERE created_at>=day_start)
    INTO day_usd,month_usd,calls FROM public.workspace_ai_reservations WHERE tenant_id=p_tenant_id AND created_at>=month_start;
  IF calls>=policy.daily_calls OR p_reserved_usd>policy.request_usd OR day_usd+p_reserved_usd>policy.daily_usd
    OR month_usd+p_reserved_usd>policy.monthly_usd THEN RAISE EXCEPTION 'AI budget reached. Open AI > Cost controls'; END IF;
  INSERT INTO public.workspace_ai_reservations(id,tenant_id,job,model,reserved_usd)
    VALUES(p_id,p_tenant_id,p_job,p_model,p_reserved_usd);
  RETURN jsonb_build_object('id',p_id);
END $$;

CREATE OR REPLACE FUNCTION public.finish_workspace_ai_call(p_tenant_id uuid,p_id uuid,p_actual_usd numeric,p_provider_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    THEN RAISE EXCEPTION 'AI workspace context required' USING ERRCODE='42501'; END IF;
  IF p_actual_usd IS NULL OR p_actual_usd<0 OR p_actual_usd>=100000 OR p_actual_usd::text IN ('NaN','Infinity','-Infinity')
    OR p_provider_request_id IS NULL OR p_provider_request_id !~ '^gen-[a-zA-Z0-9_-]{1,196}$' THEN RAISE EXCEPTION 'Invalid provider usage'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-ai:'||p_tenant_id::text,0));
  UPDATE public.workspace_ai_reservations SET actual_usd=p_actual_usd,provider_request_id=p_provider_request_id
    WHERE id=p_id AND tenant_id=p_tenant_id AND actual_usd IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.save_workspace_ai_controls(uuid,uuid,text,integer,jsonb),public.reserve_workspace_ai_call(uuid,uuid,text,text,numeric,boolean),public.finish_workspace_ai_call(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_workspace_ai_controls(uuid,uuid,text,integer,jsonb),public.reserve_workspace_ai_call(uuid,uuid,text,text,numeric,boolean),public.finish_workspace_ai_call(uuid,uuid,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.read_workspace_ai_usage(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    THEN RAISE EXCEPTION 'AI workspace context required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('dailyCalls',count(*) FILTER(WHERE created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')),
    'dailyReservedUsd',coalesce(sum(coalesce(actual_usd,reserved_usd)) FILTER(WHERE created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')),0),
    'monthlyReservedUsd',coalesce(sum(coalesce(actual_usd,reserved_usd)),0),
    'reportedUsd',coalesce(sum(actual_usd),0),'uncertainCalls',count(*) FILTER(WHERE actual_usd IS NULL)) INTO result
    FROM public.workspace_ai_reservations WHERE tenant_id=p_tenant_id AND created_at>=(date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  RETURN jsonb_build_object('usage',result,'recent',coalesce((SELECT jsonb_agg(row) FROM (
    SELECT id,job,model,reserved_usd,actual_usd,created_at FROM public.workspace_ai_reservations
    WHERE tenant_id=p_tenant_id ORDER BY created_at DESC LIMIT 20
  ) row),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.read_workspace_ai_usage(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_workspace_ai_usage(uuid) TO service_role;
