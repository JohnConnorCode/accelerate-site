-- Append-only apply receipts for approved Workspace Blueprints.
-- Replay is keyed by tenant + request_key. Service-role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_blueprint_applies (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_blueprint_applies_replay
  ON public.workspace_blueprint_applies (tenant_id, request_key);
CREATE INDEX IF NOT EXISTS idx_workspace_blueprint_applies_blueprint
  ON public.workspace_blueprint_applies (tenant_id, blueprint_id, version, created_at DESC);

ALTER TABLE public.workspace_blueprint_applies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_blueprint_applies FROM anon, authenticated;
GRANT ALL ON public.workspace_blueprint_applies TO service_role;

COMMENT ON TABLE public.workspace_blueprint_applies IS
  'Idempotent receipts for applying an approved Workspace Blueprint through existing primitives.';

COMMIT;
