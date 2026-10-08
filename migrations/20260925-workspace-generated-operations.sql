-- Append-only receipts for Architect-generated operations (boards, views,
-- navigation, workflow proposals, Coworker recommendations) composed from an
-- approved/applied Workspace Blueprint. Replay is keyed by tenant +
-- request_key, and re-generation for the same blueprint version is refused a
-- second write (see workspace-architect-generated-operations.ts) so boards
-- and workflow/Coworker proposals are never duplicated. Service-role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_generated_operations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  request_key text NOT NULL CHECK (char_length(request_key) BETWEEN 1 AND 180),
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, blueprint_id)
    REFERENCES public.workspace_blueprints (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_generated_operations_replay
  ON public.workspace_generated_operations (tenant_id, request_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_generated_operations_version
  ON public.workspace_generated_operations (tenant_id, blueprint_id, version);

ALTER TABLE public.workspace_generated_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_generated_operations FROM anon, authenticated;
GRANT ALL ON public.workspace_generated_operations TO service_role;

COMMENT ON TABLE public.workspace_generated_operations IS
  'Idempotent receipts for Architect-generated boards/views/navigation/workflow/Coworker proposals composed from an approved Workspace Blueprint over existing primitives.';

COMMIT;
