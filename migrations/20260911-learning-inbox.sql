-- =============================================================================
-- Institutional Learning Inbox (learning-inbox card).
--
-- Extends the learned-policy record with proposal typing (type, scope,
-- confidence, conflicts, affected workers, authority tier) and adds the
-- learning_proposals lifecycle table (proposed -> approved / rejected /
-- conversation_only / ignored). Approval executes through the existing
-- action/autonomy path (approve_learning), never automatically.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

-- 1. Extend learned_policies with Learning proposal metadata. All new
-- columns are nullable so existing rows and writers keep working unchanged.
ALTER TABLE public.learned_policies
  ADD COLUMN IF NOT EXISTS proposal_type TEXT
    CHECK (proposal_type IN ('positioning_policy','workflow_preference','offering','messaging','process_rule','other')),
  ADD COLUMN IF NOT EXISTS scope JSONB,
  ADD COLUMN IF NOT EXISTS confidence TEXT
    CHECK (confidence IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS conflicts JSONB,
  ADD COLUMN IF NOT EXISTS affected_workers TEXT[],
  ADD COLUMN IF NOT EXISTS authority TEXT NOT NULL DEFAULT 'working'
    CHECK (authority IN ('official','approved','working','historical'));

-- The source CHECK is inline (auto-named learned_policies_source_check).
-- Drop and re-add to admit the approved_learning source for inbox approvals.
ALTER TABLE public.learned_policies
  DROP CONSTRAINT IF EXISTS learned_policies_source_check;
ALTER TABLE public.learned_policies
  ADD CONSTRAINT learned_policies_source_check
  CHECK (source IN ('human_decision','founder_override','incident_remediation','policy_review','approved_learning'));

-- 2. learning_proposals lifecycle table.
CREATE TABLE IF NOT EXISTS public.learning_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  proposal_type      TEXT NOT NULL
                     CHECK (proposal_type IN ('positioning_policy','workflow_preference','offering','messaging','process_rule','other')),
  rule               TEXT NOT NULL,
  rationale          TEXT NOT NULL DEFAULT '',
  scope              JSONB,
  confidence         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (confidence IN ('high','medium','low')),
  conflicts          JSONB,
  affected_workers   TEXT[] NOT NULL DEFAULT '{}',
  supersedes_policy_id UUID REFERENCES public.learned_policies(id) ON DELETE SET NULL,
  source_refs        JSONB,
  authority          TEXT NOT NULL DEFAULT 'working'
                     CHECK (authority IN ('official','approved','working','historical')),
  status             TEXT NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed','approved','rejected','conversation_only','ignored')),
  dedupe_key         TEXT NOT NULL,
  learned_policy_id  UUID REFERENCES public.learned_policies(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_proposals_tenant_id_id
  ON public.learning_proposals (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_proposals_dedupe
  ON public.learning_proposals (tenant_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_learning_proposals_status
  ON public.learning_proposals (tenant_id, status, created_at DESC);

DROP POLICY IF EXISTS "Service role full access" ON public.learning_proposals;
CREATE POLICY "Service role full access" ON public.learning_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant member access" ON public.learning_proposals;
CREATE POLICY "Tenant member access" ON public.learning_proposals
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
