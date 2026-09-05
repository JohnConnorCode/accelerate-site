-- Won-to-delivery handoff (primitive: delivery activation).
--
-- A canonically won opportunity hands off to exactly one client engagement:
-- no second identity, no second pipeline. Milestones come from versioned
-- onboarding templates; execution state lives on the client's own
-- onboarding_checklist plus deduplicated tasks; the handoff receipt travels
-- in audit/activity, never in a mutated sales stage.
--
-- ADDITIVE ONLY: one new table, two nullable-or-defaulted columns. No
-- existing object is altered. Re-runnable.

-- Versioned onboarding templates. Exactly one active version per key; older
-- versions stay readable so in-flight handoffs keep their meaning.
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id()
    REFERENCES public.tenants(id) ON DELETE RESTRICT,
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT false,
  milestones JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key, version)
);

-- Link the delivery client back to its originating opportunity plus a
-- machine-readable handoff receipt. Nullable: pre-handoff clients predate it.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS handoff_receipt JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.onboarding_templates'::regclass
      AND conname = 'onboarding_templates_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.onboarding_templates
      ADD CONSTRAINT onboarding_templates_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_templates_tenant_id_id
  ON public.onboarding_templates (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_templates_active_key
  ON public.onboarding_templates (tenant_id, template_key) WHERE active;
CREATE INDEX IF NOT EXISTS idx_clients_opportunity
  ON public.clients (tenant_id, opportunity_id) WHERE opportunity_id IS NOT NULL;

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.onboarding_templates;
CREATE POLICY "Service role full access" ON public.onboarding_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Tenant member access" ON public.onboarding_templates;
CREATE POLICY "Tenant member access" ON public.onboarding_templates FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;

DROP TRIGGER IF EXISTS onboarding_templates_touch_updated_at ON public.onboarding_templates;
CREATE TRIGGER onboarding_templates_touch_updated_at BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();

-- Default playbook, versioned from day one so later edits supersede rather
-- than mutate what in-flight handoffs reference.
INSERT INTO public.onboarding_templates (tenant_id, template_key, version, active, milestones)
SELECT public.accelerate_default_tenant_id(), 'default', 1, true,
  '[{"key":"kickoff","title":"Kickoff call","description":"Align on goals, success criteria, and cadence.","owner":"founder","due_offset_days":3},{"key":"access","title":"Access and assets","description":"Collect logins, brand assets, and data sources.","owner":"founder","due_offset_days":7},{"key":"first-win","title":"First win","description":"Deliver the first visible outcome from the proposal scope.","owner":"founder","due_offset_days":14}]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_templates WHERE template_key = 'default' AND active
);
