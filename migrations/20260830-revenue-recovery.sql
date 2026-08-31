-- =============================================================================
-- Revenue recovery: approved import -> bounded campaign -> attributed outcome.
-- Additive and safe to re-run. This does not send email or alter existing data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS recovery_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL,
  source_batch_id UUID,
  motion_key TEXT NOT NULL CHECK (motion_key IN ('stale_lead','unsold_estimate','no_show','dormant_customer','lapsed_client')),
  relationship_basis TEXT NOT NULL,
  offer_label TEXT NOT NULL,
  booking_url TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Detroit',
  outcome_window_days SMALLINT NOT NULL DEFAULT 60 CHECK (outcome_window_days BETWEEN 14 AND 90),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, campaign_id),
  FOREIGN KEY (tenant_id, campaign_id) REFERENCES campaigns(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, source_batch_id) REFERENCES contact_import_batches(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recovery_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  playbook_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  import_row_id UUID,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('eligible','excluded','enrolled','replied','booked','reopened','won','stopped')),
  exclusion_reason TEXT,
  estimated_value NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  eligibility_evidence JSONB NOT NULL DEFAULT '{}',
  baseline JSONB NOT NULL DEFAULT '{}',
  outcome_window_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, playbook_id, contact_id),
  FOREIGN KEY (tenant_id, playbook_id) REFERENCES recovery_playbooks(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, campaign_id) REFERENCES campaigns(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, import_row_id) REFERENCES contact_import_rows(tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_candidates_campaign_status
  ON recovery_candidates(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_candidates_contact
  ON recovery_candidates(contact_id, created_at DESC);
-- One reviewed import gets one recovery motion per tenant. This is a durable
-- replay boundary for double-clicks, request retries, and concurrent founders.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_playbooks_tenant_batch_motion
  ON recovery_playbooks(tenant_id, source_batch_id, motion_key)
  WHERE source_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recovery_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id() REFERENCES tenants(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  opportunity_id UUID,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('positive_reply','booked','reopened','won')),
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  source_receipt_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, candidate_id, outcome_type, opportunity_id),
  FOREIGN KEY (tenant_id, candidate_id) REFERENCES recovery_candidates(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, opportunity_id) REFERENCES opportunities(tenant_id, id) ON DELETE SET NULL
);

ALTER TABLE recovery_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON recovery_playbooks;
CREATE POLICY "Service role full access" ON recovery_playbooks FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON recovery_candidates;
CREATE POLICY "Service role full access" ON recovery_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON recovery_outcomes;
CREATE POLICY "Service role full access" ON recovery_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON recovery_playbooks;
CREATE POLICY "Tenant member access" ON recovery_playbooks FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member access" ON recovery_candidates;
CREATE POLICY "Tenant member access" ON recovery_candidates FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member access" ON recovery_outcomes;
CREATE POLICY "Tenant member access" ON recovery_outcomes FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON recovery_playbooks, recovery_candidates, recovery_outcomes TO authenticated;

DROP TRIGGER IF EXISTS recovery_playbooks_touch_updated_at ON recovery_playbooks;
CREATE TRIGGER recovery_playbooks_touch_updated_at BEFORE UPDATE ON recovery_playbooks FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();
DROP TRIGGER IF EXISTS recovery_candidates_touch_updated_at ON recovery_candidates;
CREATE TRIGGER recovery_candidates_touch_updated_at BEFORE UPDATE ON recovery_candidates FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();
