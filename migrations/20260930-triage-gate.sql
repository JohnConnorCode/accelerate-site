-- Triage gate and silent exit for the operator queue.
--
-- Every proposal used to arrive in the operator queue as `pending`, and the only
-- suppression was an exact dedupe_key. A weak finding therefore cost a human a
-- dismissal, and a background job had no way to say "nothing worth surfacing".
-- Interruptions are the scarce resource, so the queue is a scarce resource too.
--
-- This adds the record of a decision, not a second queue. `action_queue.triage`
-- stores the scores, the routed action and the reason for a proposal that was
-- still worth showing, so the operator can always see why a row exists. A
-- proposal that was passed never becomes a row at all; its receipt lives in the
-- activity ledger and the audit trail.
--
-- ADDITIVE ONLY: one nullable column on action_queue and one small per-tenant
-- settings table. No existing object is altered. Re-runnable.
BEGIN;

ALTER TABLE public.action_queue
  ADD COLUMN IF NOT EXISTS triage JSONB;

COMMENT ON COLUMN public.action_queue.triage IS
  'Triage decision for this proposal: usefulness, confidence, noise and interruption cost scores, the routed action, the reason, and whether an explicit human request forced the answer. NULL on rows written before the gate existed.';

-- One row per tenant. A NULL threshold means "keep today's behavior": nothing is
-- suppressed on a threshold nobody has chosen. Storing the threshold instead of
-- hard-coding it is what lets a workspace tune interruption cost without a code
-- change, and leaving it NULL means an unconfigured workspace is never silenced.
CREATE TABLE IF NOT EXISTS public.triage_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL DEFAULT public.accelerate_default_tenant_id()
                          REFERENCES public.tenants(id),
  suppression_threshold INTEGER CHECK (suppression_threshold IS NULL OR suppression_threshold BETWEEN 0 AND 100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id)
);

ALTER TABLE public.triage_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS triage_settings_tenant ON public.triage_settings;
CREATE POLICY triage_settings_tenant ON public.triage_settings
  FOR ALL TO authenticated, service_role
  USING (tenant_id = private.authorized_request_tenant_id())
  WITH CHECK (tenant_id = private.authorized_request_tenant_id());
GRANT SELECT, INSERT, UPDATE ON public.triage_settings TO authenticated, service_role;

COMMENT ON TABLE public.triage_settings IS
  'Per-tenant triage policy. suppression_threshold is the minimum usefulness a proposal must reach to reach the operator queue; NULL keeps pre-gate behavior.';

COMMIT;
