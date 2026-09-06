-- Atomic resource reservations for known-cost operations. Receipts are immutable;
-- a repeated key does not authorize a second external effect.
BEGIN;
CREATE TABLE IF NOT EXISTS public.budget_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operation_key text NOT NULL,
  coworker_id text NOT NULL,
  budget_kind text NOT NULL CHECK (budget_kind IN ('model_spend','vendor_api_calls','emails_sent','research_depth','retry_count','runtime_seconds')),
  amount numeric NOT NULL CHECK(amount >= 0),
  work_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,operation_key,budget_kind)
);
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant member access" ON public.budget_receipts;
CREATE POLICY "Tenant member access" ON public.budget_receipts FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
CREATE INDEX IF NOT EXISTS budget_receipts_work ON public.budget_receipts(tenant_id,work_item_id,budget_kind);

CREATE OR REPLACE FUNCTION public.claim_budget_usage(p_coworker_id text,p_budget_kind text,p_amount numeric,p_operation_key text,p_work_item_id uuid DEFAULT NULL)
RETURNS TABLE(allowed boolean,replayed boolean,reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; c text; lim record; used numeric; first_day date; d date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  t := private.authorized_request_tenant_id();
  c := coalesce(nullif(btrim(p_coworker_id),''),'*');
  IF p_amount IS NULL OR p_amount < 0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR nullif(btrim(p_operation_key),'') IS NULL THEN
    RAISE EXCEPTION 'A finite non-negative amount and operation key are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text || ':resource-budget:' || p_budget_kind,0));
  IF EXISTS(SELECT 1 FROM public.budget_receipts r WHERE r.tenant_id=t AND r.operation_key=p_operation_key AND r.budget_kind=p_budget_kind) THEN
    IF EXISTS(SELECT 1 FROM public.budget_receipts r WHERE r.tenant_id=t AND r.operation_key=p_operation_key AND r.budget_kind=p_budget_kind AND (r.amount <> p_amount OR r.coworker_id <> c OR r.work_item_id IS DISTINCT FROM p_work_item_id)) THEN
      RAISE EXCEPTION 'Budget operation key was reused with different inputs';
    END IF;
    RETURN QUERY SELECT false,true,'This resource operation was already claimed'::text; RETURN;
  END IF;
  FOR lim IN SELECT * FROM public.budget_limits l WHERE l.tenant_id=t AND l.budget_kind=p_budget_kind AND l.coworker_id IN ('*',c) LOOP
    IF lim.period='per_work_item' THEN
      IF p_work_item_id IS NULL THEN RAISE EXCEPTION 'Per-work-item budget requires work context'; END IF;
      SELECT coalesce(sum(r.amount),0) INTO used FROM public.budget_receipts r
        WHERE r.tenant_id=t AND r.budget_kind=p_budget_kind AND r.work_item_id=p_work_item_id
        AND (lim.coworker_id='*' OR r.coworker_id=c);
    ELSE
      first_day := CASE lim.period WHEN 'daily' THEN d WHEN 'weekly' THEN date_trunc('week',d)::date WHEN 'monthly' THEN date_trunc('month',d)::date ELSE NULL END;
      IF first_day IS NULL THEN RAISE EXCEPTION 'Unsupported budget period'; END IF;
      SELECT coalesce(sum(u.used_value),0) INTO used FROM public.budget_usage u
        WHERE u.tenant_id=t AND u.budget_kind=p_budget_kind AND u.period_key BETWEEN first_day::text AND d::text
        AND (lim.coworker_id='*' OR u.coworker_id=c);
    END IF;
    IF used+p_amount > lim.limit_value THEN RETURN QUERY SELECT false,false,('Budget exhausted: '||p_budget_kind)::text; RETURN; END IF;
  END LOOP;
  INSERT INTO public.budget_receipts(tenant_id,operation_key,coworker_id,budget_kind,amount,work_item_id)
    VALUES(t,p_operation_key,c,p_budget_kind,p_amount,p_work_item_id);
  INSERT INTO public.budget_usage(tenant_id,coworker_id,budget_kind,used_value,period_key)
    VALUES(t,c,p_budget_kind,p_amount,d::text)
    ON CONFLICT(tenant_id,coworker_id,budget_kind,period_key) DO UPDATE SET used_value=public.budget_usage.used_value+EXCLUDED.used_value,updated_at=now();
  RETURN QUERY SELECT true,false,'Resource budget reserved'::text;
END $$;
REVOKE ALL ON FUNCTION public.claim_budget_usage(text,text,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_budget_usage(text,text,numeric,text,uuid) TO service_role;
COMMIT;
