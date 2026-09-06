-- Shared admission and receipts for bounded, single-attempt model jobs.
-- Conservative reservations remain charged to shared budgets after settlement;
-- actual provider cost is recorded separately and never guessed or refunded.
BEGIN;
CREATE TABLE IF NOT EXISTS public.model_call_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  module_key text NOT NULL CHECK(length(module_key) BETWEEN 3 AND 64),
  operation_key uuid NOT NULL,
  cache_key text NOT NULL CHECK(cache_key ~ '^[a-f0-9]{64}$'),
  requested_model text NOT NULL CHECK(length(requested_model) BETWEEN 1 AND 200),
  resolved_model text,
  state text NOT NULL CHECK(state IN ('reserved','completed','failed','uncertain')),
  reserved_usd numeric NOT NULL CHECK(reserved_usd >= 0 AND reserved_usd <= 1),
  actual_usd numeric CHECK(actual_usd >= 0 AND actual_usd::text NOT IN ('NaN','Infinity','-Infinity')),
  input_token_bound integer NOT NULL CHECK(input_token_bound BETWEEN 1 AND 16000),
  output_token_bound integer NOT NULL CHECK(output_token_bound BETWEEN 1 AND 4000),
  provider_request_id text,
  usage jsonb,
  result jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,module_key,operation_key)
);
CREATE INDEX IF NOT EXISTS model_call_daily ON public.model_call_receipts(tenant_id,module_key,created_at);
CREATE INDEX IF NOT EXISTS model_call_cache ON public.model_call_receipts(tenant_id,module_key,cache_key);
CREATE UNIQUE INDEX IF NOT EXISTS model_call_generation_identity ON public.model_call_receipts(tenant_id,provider_request_id) WHERE provider_request_id IS NOT NULL;
ALTER TABLE public.model_call_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS model_call_read ON public.model_call_receipts;
CREATE POLICY model_call_read ON public.model_call_receipts FOR SELECT TO authenticated
  USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.model_call_receipts TO authenticated;
GRANT ALL ON public.model_call_receipts TO service_role;

-- Append-only settlement history; mutable receipt is an operator projection.
CREATE TABLE IF NOT EXISTS public.model_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  receipt_id uuid NOT NULL,
  state text NOT NULL,
  actual_usd numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,receipt_id) REFERENCES public.model_call_receipts(tenant_id,id)
);
ALTER TABLE public.model_call_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS model_call_event_read ON public.model_call_events;
CREATE POLICY model_call_event_read ON public.model_call_events FOR SELECT TO authenticated
  USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.model_call_events TO authenticated;
GRANT SELECT,INSERT ON public.model_call_events TO service_role;
CREATE OR REPLACE FUNCTION private.model_call_event_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Model call history is immutable'; END $$;
DROP TRIGGER IF EXISTS model_call_event_immutable ON public.model_call_events;
CREATE TRIGGER model_call_event_immutable BEFORE UPDATE OR DELETE ON public.model_call_events
  FOR EACH ROW EXECUTE FUNCTION private.model_call_event_immutable();

CREATE OR REPLACE FUNCTION public.reserve_model_call(
  p_module_key text,p_operation_key uuid,p_cache_key text,p_model text,p_reserved_usd numeric,
  p_input_tokens integer,p_output_tokens integer,p_daily_calls integer,p_daily_usd numeric,
  p_run_usd numeric,p_expected_config jsonb,p_work_item_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; cfg jsonb; existing public.model_call_receipts; count_used integer; spend_used numeric; claim record; receipt public.model_call_receipts;
BEGIN
  t:=private.authorized_request_tenant_id();
  IF p_daily_calls IS NULL OR p_daily_calls NOT BETWEEN 1 AND 20 OR p_daily_usd IS NULL OR p_daily_usd NOT BETWEEN 0 AND 100
    OR p_run_usd IS NULL OR p_run_usd NOT BETWEEN 0 AND 1 OR p_reserved_usd IS NULL OR p_reserved_usd NOT BETWEEN 0 AND 1
    OR p_reserved_usd::text IN ('NaN','Infinity','-Infinity') OR p_daily_usd::text IN ('NaN','Infinity','-Infinity')
    OR p_run_usd::text IN ('NaN','Infinity','-Infinity') OR p_input_tokens IS NULL OR p_output_tokens IS NULL OR p_input_tokens NOT BETWEEN 1 AND 16000 OR p_output_tokens NOT BETWEEN 1 AND 4000
    OR p_module_key IS NULL OR length(p_module_key) NOT BETWEEN 3 AND 64 OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 200
    OR p_cache_key IS NULL OR p_cache_key !~ '^[a-f0-9]{64}$' OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'Invalid model reservation';
  END IF;
  IF p_work_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=p_work_item_id AND tenant_id=t) THEN
    RAISE EXCEPTION 'Model work context unavailable';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':model-call:'||p_module_key,0));
  SELECT config INTO cfg FROM public.tenants WHERE id=t AND status='active' FOR SHARE;
  IF cfg IS NULL OR cfg IS DISTINCT FROM p_expected_config OR coalesce((cfg->'modules'->>p_module_key)::boolean,false) IS NOT TRUE THEN
    RETURN jsonb_build_object('status','deferred','reason','Workspace configuration changed or module disabled');
  END IF;
  SELECT * INTO existing FROM public.model_call_receipts WHERE tenant_id=t AND module_key=p_module_key AND operation_key=p_operation_key;
  IF FOUND THEN
    IF existing.cache_key<>p_cache_key OR existing.requested_model<>p_model THEN RAISE EXCEPTION 'Model operation identity conflict'; END IF;
    RETURN jsonb_build_object('status',CASE WHEN existing.state='completed' THEN 'cached' ELSE 'deferred' END,'receipt',to_jsonb(existing),'reason','Existing operation must not execute again');
  END IF;
  IF EXISTS(SELECT 1 FROM public.model_call_receipts WHERE tenant_id=t AND module_key=p_module_key AND state IN ('reserved','uncertain')) THEN
    RETURN jsonb_build_object('status','deferred','reason','A model request is running or requires cost reconciliation');
  END IF;
  IF EXISTS(SELECT 1 FROM public.model_call_receipts WHERE tenant_id=t AND module_key=p_module_key
    AND state='failed' AND usage->>'rejection_status'='429'
    AND completed_at + make_interval(secs=>least(86400,greatest(0,coalesce((usage->>'retry_after_seconds')::integer,60)))) > now()) THEN
    RETURN jsonb_build_object('status','deferred','reason','Provider rate-limit cooldown is active');
  END IF;
  SELECT * INTO existing FROM public.model_call_receipts WHERE tenant_id=t AND module_key=p_module_key AND cache_key=p_cache_key
    AND state='completed' AND created_at > now()-interval '24 hours' ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','cached','receipt',to_jsonb(existing)); END IF;
  SELECT count(*),coalesce(sum(greatest(reserved_usd,coalesce(actual_usd,0))),0) INTO count_used,spend_used FROM public.model_call_receipts
    WHERE tenant_id=t AND module_key=p_module_key AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF count_used>=p_daily_calls OR spend_used+p_reserved_usd>p_daily_usd OR p_reserved_usd>p_run_usd THEN
    RETURN jsonb_build_object('status','deferred','reason','Daily call or reserved spend limit exhausted');
  END IF;
  -- Both shared reservations and this receipt commit atomically; a later refusal rolls back both.
  SELECT * INTO claim FROM public.claim_budget_usage(NULL,'model_spend',p_reserved_usd,'model:'||p_module_key||':'||p_operation_key::text,p_work_item_id);
  IF NOT claim.allowed THEN RAISE EXCEPTION '%',claim.reason; END IF;
  SELECT * INTO claim FROM public.claim_budget_usage(NULL,'vendor_api_calls',1,'model:'||p_module_key||':'||p_operation_key::text,p_work_item_id);
  IF NOT claim.allowed THEN RAISE EXCEPTION '%',claim.reason; END IF;
  INSERT INTO public.model_call_receipts(tenant_id,module_key,operation_key,cache_key,requested_model,state,reserved_usd,input_token_bound,output_token_bound)
    VALUES(t,p_module_key,p_operation_key,p_cache_key,p_model,'reserved',p_reserved_usd,p_input_tokens,p_output_tokens) RETURNING * INTO receipt;
  INSERT INTO public.model_call_events(tenant_id,receipt_id,state) VALUES(t,receipt.id,'reserved');
  RETURN jsonb_build_object('status','reserved','receipt',to_jsonb(receipt));
END $$;

CREATE OR REPLACE FUNCTION public.complete_model_call(p_id uuid,p_state text,p_model text,p_request_id text,p_usage jsonb,p_result jsonb,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; receipt public.model_call_receipts; cost numeric; adjustment numeric;
BEGIN
  t:=private.authorized_request_tenant_id();
  IF p_state IS NULL OR p_state NOT IN ('completed','failed','uncertain') OR length(coalesce(p_reason,''))>500 OR length(coalesce(p_request_id,''))>200
    OR length(coalesce(p_model,''))>200 OR pg_column_size(p_result)>32768 OR pg_column_size(p_usage)>2048 THEN RAISE EXCEPTION 'Invalid model settlement'; END IF;
  SELECT * INTO receipt FROM public.model_call_receipts WHERE id=p_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Model receipt unavailable'; END IF;
  IF receipt.state NOT IN ('reserved','uncertain') THEN RETURN to_jsonb(receipt); END IF;
  IF receipt.state='uncertain' THEN
    IF receipt.provider_request_id IS NULL OR p_request_id IS DISTINCT FROM receipt.provider_request_id
      OR p_model IS DISTINCT FROM receipt.requested_model OR p_state<>'failed' THEN
      RAISE EXCEPTION 'Reconciliation requires the stored provider generation and requested model';
    END IF;
  END IF;
  IF p_usage IS NOT NULL AND jsonb_typeof(p_usage->'cost')='number' THEN cost:=(p_usage->>'cost')::numeric; END IF;
  IF cost IS NULL OR cost<0 OR cost::text IN ('NaN','Infinity','-Infinity') THEN
    p_state:='uncertain';p_result:=NULL;p_reason:='Provider cost is missing or invalid; reconciliation required';
  END IF;
  IF p_state='completed' AND (p_result IS NULL OR p_model IS DISTINCT FROM receipt.requested_model) THEN
    RAISE EXCEPTION 'A completed model receipt requires validated output from the requested model';
  END IF;
  IF cost>receipt.reserved_usd THEN
    -- Record a provider overcharge as a fact even when a cap would refuse a new
    -- request. Never disguise already-incurred spend or authorize another call.
    adjustment:=cost-greatest(receipt.reserved_usd,coalesce(receipt.actual_usd,0));
    IF adjustment>0 THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':resource-budget:model_spend',0));
      INSERT INTO public.budget_receipts(tenant_id,operation_key,coworker_id,budget_kind,amount,work_item_id)
        SELECT t,'model-overrun:'||receipt.id::text,'*','model_spend',adjustment,r.work_item_id
        FROM public.budget_receipts r WHERE r.tenant_id=t AND r.budget_kind='model_spend'
          AND r.operation_key='model:'||receipt.module_key||':'||receipt.operation_key::text;
      INSERT INTO public.budget_usage(tenant_id,coworker_id,budget_kind,used_value,period_key)
        VALUES(t,'*','model_spend',adjustment,(now() AT TIME ZONE 'UTC')::date::text)
        ON CONFLICT(tenant_id,coworker_id,budget_kind,period_key) DO UPDATE
          SET used_value=public.budget_usage.used_value+EXCLUDED.used_value,updated_at=now();
    END IF;
    p_state:='failed';p_result:=NULL;p_reason:='Provider charge exceeded its admitted ceiling; overrun recorded, output discarded';
  END IF;
  UPDATE public.model_call_receipts SET state=p_state,resolved_model=p_model,provider_request_id=p_request_id,
    usage=p_usage,actual_usd=CASE WHEN cost>=0 AND cost::text NOT IN ('NaN','Infinity','-Infinity') THEN cost ELSE NULL END,
    result=CASE WHEN p_state='completed' THEN p_result ELSE NULL END,reason=p_reason,completed_at=now()
    WHERE id=p_id RETURNING * INTO receipt;
  INSERT INTO public.model_call_events(tenant_id,receipt_id,state,actual_usd,reason)
    VALUES(t,receipt.id,receipt.state,receipt.actual_usd,receipt.reason);
  RETURN to_jsonb(receipt);
END $$;
REVOKE ALL ON FUNCTION public.reserve_model_call(text,uuid,text,text,numeric,integer,integer,integer,numeric,numeric,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_model_call(uuid,text,text,text,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_model_call(text,uuid,text,text,numeric,integer,integer,integer,numeric,numeric,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_model_call(uuid,text,text,text,jsonb,jsonb,text) TO service_role;
COMMIT;
