BEGIN;
CREATE TABLE IF NOT EXISTS public.learning_signals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 kind text NOT NULL CHECK(kind IN ('draft_edit','rejection','explicit_correction','tool_failure','missing_source','verified_outcome')),
 source_kind text NOT NULL,source_id text NOT NULL,receipt_key text NOT NULL,
 details text NOT NULL CHECK(length(details)<=10000),rule text,plugin_id text,
 category text,remedy text,proposal_id uuid,processed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,receipt_key),
 FOREIGN KEY(tenant_id,proposal_id) REFERENCES public.learning_proposals(tenant_id,id)
);
ALTER TABLE public.learning_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_signals_tenant ON public.learning_signals;
CREATE POLICY learning_signals_tenant ON public.learning_signals FOR ALL TO authenticated,service_role
 USING(tenant_id=private.authorized_request_tenant_id()) WITH CHECK(tenant_id=private.authorized_request_tenant_id());
GRANT SELECT,INSERT,UPDATE ON public.learning_signals TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS learning_signals_pending ON public.learning_signals(tenant_id,created_at) WHERE processed_at IS NULL;

-- Discover only receipts not previously captured. No historical context is
-- repeatedly sent to a model; successful execution is not a claim of improvement.
CREATE OR REPLACE FUNCTION public.collect_learning_signals() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t uuid:=private.authorized_request_tenant_id(); count_actions integer; count_tools integer;
BEGIN
 INSERT INTO learning_signals(tenant_id,kind,source_kind,source_id,receipt_key,details)
 SELECT t,CASE WHEN a.status='executed' THEN 'verified_outcome' ELSE 'rejection' END,'action',a.id::text,'action:'||a.id::text||':'||a.status,
  left(CASE WHEN a.status='executed' THEN 'Executed action receipt: ' ELSE 'Rejected action: ' END||a.action_type||'. '||coalesce(a.result->>'reason',''),10000)
 FROM action_queue a WHERE a.tenant_id=t AND a.status IN ('executed','rejected')
 AND a.updated_at>=now()-interval '30 days'
 AND NOT EXISTS(SELECT 1 FROM learning_signals s WHERE s.tenant_id=t AND s.receipt_key='action:'||a.id::text||':'||a.status)
 ORDER BY a.updated_at,a.id LIMIT 50 ON CONFLICT(tenant_id,receipt_key) DO NOTHING;
 GET DIAGNOSTICS count_actions=ROW_COUNT;
 INSERT INTO learning_signals(tenant_id,kind,source_kind,source_id,receipt_key,details)
 SELECT t,CASE WHEN e.event_type='tool_error' THEN 'tool_failure' ELSE 'missing_source' END,'agent_run',e.run_id::text,'event:'||e.id::text,
  left(coalesce(e.tool_name,'Tool')||': '||CASE WHEN e.event_type='tool_error' THEN coalesce(e.output->>'error','Execution failed') ELSE 'Retrieval reported missing or unverifiable sources' END,10000)
 FROM agent_run_events e WHERE e.tenant_id=t AND e.created_at>=now()-interval '30 days'
 AND (e.event_type='tool_error' OR (e.event_type='tool_result' AND CASE WHEN jsonb_typeof(e.output->'result'->'missing')='array' THEN jsonb_array_length(e.output->'result'->'missing')>0 ELSE false END))
 AND NOT EXISTS(SELECT 1 FROM learning_signals s WHERE s.tenant_id=t AND s.receipt_key='event:'||e.id::text)
 ORDER BY e.created_at,e.id LIMIT 50 ON CONFLICT(tenant_id,receipt_key) DO NOTHING;
 GET DIAGNOSTICS count_tools=ROW_COUNT;
 RETURN count_actions+count_tools;
END $$;
REVOKE ALL ON FUNCTION public.collect_learning_signals() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collect_learning_signals() TO service_role;
COMMIT;
