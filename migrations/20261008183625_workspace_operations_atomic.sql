-- Generation is one service-only transaction. Historical receipts keep their
-- missing audit link; migration cannot invent evidence for an earlier save.
BEGIN;

ALTER TABLE public.workspace_generated_operations ADD COLUMN IF NOT EXISTS audit_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workspace_generated_operations'::regclass AND conname='workspace_generation_audit_fk') THEN
    ALTER TABLE public.workspace_generated_operations ADD CONSTRAINT workspace_generation_audit_fk
      FOREIGN KEY (tenant_id,audit_id) REFERENCES public.audit_log(tenant_id,id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_generated_operation_requests (
  tenant_id uuid NOT NULL,
  request_key text NOT NULL CHECK (char_length(request_key) BETWEEN 1 AND 180),
  operation_id uuid NOT NULL,
  PRIMARY KEY (tenant_id,request_key),
  FOREIGN KEY (tenant_id,operation_id) REFERENCES public.workspace_generated_operations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS workspace_generation_requests_operation_idx ON public.workspace_generated_operation_requests(tenant_id,operation_id);
CREATE INDEX IF NOT EXISTS workspace_generation_audit_idx ON public.workspace_generated_operations(tenant_id,audit_id);
ALTER TABLE public.workspace_generated_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_generated_operation_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.workspace_generated_operation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.generate_workspace_operations(
  p_tenant_id uuid,p_blueprint_id uuid,p_version integer,p_request_key text,
  p_actor_email text,p_document jsonb,p_plan jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  bp public.workspace_blueprints%ROWTYPE;
  existing public.workspace_generated_operations%ROWTYPE;
  board jsonb;
  col jsonb;
  created jsonb;
  boards jsonb := '[]';
  next_order numeric;
  column_id uuid;
  operation_id uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid();
  receipt jsonb;
BEGIN
  IF current_user<>'service_role' OR p_tenant_id IS DISTINCT FROM private.authorized_request_tenant_id()
    OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active') THEN
    RAISE EXCEPTION 'generation_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_version IS NULL OR p_version<1 OR p_request_key IS NULL OR btrim(p_request_key)<>p_request_key
    OR char_length(p_request_key) NOT BETWEEN 1 AND 180 OR p_actor_email IS NULL
    OR char_length(p_actor_email) NOT BETWEEN 1 AND 320 OR jsonb_typeof(p_plan) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_plan->'boards') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_plan->'boards')>100
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['navigation','views','workflows','coworkers','customAppBriefs']) k
      WHERE jsonb_typeof(p_plan->k) IS DISTINCT FROM 'array') THEN RAISE EXCEPTION 'Invalid generation input'; END IF;

  -- Rare setup writes serialize per workspace: request aliases and two plans
  -- targeting the same existing board must agree on receipt and column order.
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace_operations:'||p_tenant_id::text,0));
  SELECT * INTO bp FROM public.workspace_blueprints WHERE tenant_id=p_tenant_id AND id=p_blueprint_id FOR UPDATE;
  IF NOT FOUND OR bp.status NOT IN ('approved','applied') OR bp.latest_version<>p_version
    OR NOT EXISTS(SELECT 1 FROM public.workspace_blueprint_versions
      WHERE tenant_id=p_tenant_id AND blueprint_id=p_blueprint_id AND version=p_version AND document=p_document) THEN
    RAISE EXCEPTION 'generation_approval_changed';
  END IF;

  SELECT g.* INTO existing FROM public.workspace_generated_operation_requests r
    JOIN public.workspace_generated_operations g ON g.tenant_id=r.tenant_id AND g.id=r.operation_id
    WHERE r.tenant_id=p_tenant_id AND r.request_key=p_request_key;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM public.workspace_generated_operations
      WHERE tenant_id=p_tenant_id AND request_key=p_request_key;
  END IF;
  IF FOUND AND (existing.blueprint_id<>p_blueprint_id OR existing.version<>p_version) THEN
    RAISE EXCEPTION 'generation_request_conflict';
  END IF;
  IF existing.id IS NULL THEN
    SELECT * INTO existing FROM public.workspace_generated_operations
      WHERE tenant_id=p_tenant_id AND blueprint_id=p_blueprint_id AND version=p_version;
  END IF;
  IF existing.id IS NOT NULL THEN
    IF existing.audit_id IS NULL OR existing.receipt->>'auditId' IS DISTINCT FROM existing.audit_id::text
      OR existing.receipt->>'blueprintId' IS DISTINCT FROM p_blueprint_id::text
      OR existing.receipt->>'version' IS DISTINCT FROM p_version::text OR NOT EXISTS(SELECT 1 FROM public.audit_log
      WHERE tenant_id=p_tenant_id AND id=existing.audit_id AND action='workspace_operations.generated'
        AND entity_type='workspace_blueprint' AND entity_id=p_blueprint_id::text
        AND metadata->>'operationId'=existing.id::text) THEN
      RAISE EXCEPTION 'generation_reconciliation_required';
    END IF;
    INSERT INTO public.workspace_generated_operation_requests VALUES(p_tenant_id,p_request_key,existing.id)
      ON CONFLICT(tenant_id,request_key) DO NOTHING;
    RETURN jsonb_build_object('replayed',true,'receipt',existing.receipt);
  END IF;

  FOR board IN SELECT value FROM jsonb_array_elements(p_plan->'boards') LOOP
    created := '[]';
    IF board->>'status'='ready' AND board->>'targetBoardKey' IN ('pipeline','content') THEN
      SELECT coalesce(max(sort_order),0) INTO next_order FROM public.kanban_columns
        WHERE tenant_id=p_tenant_id AND board_key=board->>'targetBoardKey';
      FOR col IN SELECT value FROM jsonb_array_elements(board->'columns') LOOP
        column_id := NULL;
        INSERT INTO public.kanban_columns(tenant_id,board_key,column_key,label,color,sort_order,is_default,metadata)
          VALUES(p_tenant_id,board->>'targetBoardKey',col->>'columnKey',col->>'label',NULL,next_order+1000,false,
            jsonb_build_object('generatedFrom','workspace_blueprint','lifecycleStates',col->'lifecycleStates'))
          ON CONFLICT(tenant_id,board_key,column_key) WHERE tenant_id IS NOT NULL DO NOTHING RETURNING id INTO column_id;
        IF column_id IS NOT NULL THEN
          next_order := next_order+1000;
          created := created||jsonb_build_array(col->>'columnKey');
        END IF;
      END LOOP;
    END IF;
    boards := boards||jsonb_build_array(board||jsonb_build_object('columnsCreated',created));
  END LOOP;
  receipt := jsonb_build_object('blueprintId',p_blueprint_id,'version',p_version,'auditId',audit_id,
    'navigation',p_plan->'navigation','boards',boards,'views',p_plan->'views',
    'workflows',coalesce((SELECT jsonb_agg(value||'{"actionId":null}'::jsonb) FROM jsonb_array_elements(p_plan->'workflows')),'[]'),
    'coworkers',coalesce((SELECT jsonb_agg(value||'{"actionId":null}'::jsonb) FROM jsonb_array_elements(p_plan->'coworkers')),'[]'),
    'customAppBriefs',p_plan->'customAppBriefs');
  INSERT INTO public.audit_log(id,tenant_id,actor_email,action,entity_type,entity_id,source,after_state,metadata)
    VALUES(audit_id,p_tenant_id,p_actor_email,'workspace_operations.generated','workspace_blueprint',p_blueprint_id::text,'admin',
      jsonb_build_object('version',p_version,'boards',jsonb_array_length(boards),
        'workflows',jsonb_array_length(p_plan->'workflows'),'coworkers',jsonb_array_length(p_plan->'coworkers')),
      jsonb_build_object('operationId',operation_id,'requestKey',p_request_key));
  INSERT INTO public.workspace_generated_operations(tenant_id,id,blueprint_id,version,request_key,receipt,audit_id)
    VALUES(p_tenant_id,operation_id,p_blueprint_id,p_version,p_request_key,receipt,audit_id);
  INSERT INTO public.workspace_generated_operation_requests VALUES(p_tenant_id,p_request_key,operation_id);
  RETURN jsonb_build_object('replayed',false,'receipt',receipt);
END $$;
REVOKE ALL ON FUNCTION public.generate_workspace_operations(uuid,uuid,integer,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_workspace_operations(uuid,uuid,integer,text,text,jsonb,jsonb) TO service_role;

COMMIT;
