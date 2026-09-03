-- =============================================================================
-- Evidence & Claim Ledger: claims + evidence tables + record_evidence RPC.
--
-- Implements the northstar Phase B3 primitive (docs/NORTHSTAR.md §14-15):
-- an evidence-backed fact system. Models should not invent their own
-- confidence scores and treat them as truth. Deterministic business rules
-- determine whether observations are strong enough to update authoritative
-- state.
--
-- Human truth hierarchy (§15):
--   human_confirmed > human_entered > verified_external > probable_external > model_inference
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Evidence strength enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.evidence_strength AS ENUM (
    'human_confirmed',
    'human_entered',
    'verified_external',
    'probable_external',
    'model_inference'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Claim status enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM (
    'unverified',
    'supported',
    'conflicted',
    'verified',
    'superseded',
    'retracted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Claims table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  entity_type       TEXT NOT NULL,            -- "contact", "company", "opportunity", etc.
  entity_id         UUID NOT NULL,            -- canonical record ID
  field             TEXT NOT NULL,            -- the field/concept being claimed (e.g. "employer", "title", "stage")
  proposed_value    TEXT NOT NULL,            -- the asserted value
  status            public.claim_status NOT NULL DEFAULT 'unverified',
  best_evidence     public.evidence_strength, -- strongest evidence supporting this claim
  source_type       TEXT NOT NULL,            -- "agent_inference", "gmail_signature", "linkedin", "human_entry", "api"
  source_id         TEXT,                     -- ID of the source record (agent_run_id, connection_id, etc.)
  coworker_id       TEXT,                     -- which coworker asserted this claim
  agent_run_id      UUID,                     -- link to agent_runs trace
  superseded_by     UUID,                     -- FK to the claim that replaced this one
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

-- One open claim per tenant+entity+field. Superseded/retracted claims release the slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_open_entity_field
  ON public.claims (tenant_id, entity_type, entity_id, field)
  WHERE status IN ('unverified', 'supported', 'conflicted', 'verified');

-- Tenant-composite primary key index (standard pattern).
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_tenant_id_id
  ON public.claims (tenant_id, id);

-- Find claims by entity for the agent context.
CREATE INDEX IF NOT EXISTS idx_claims_entity
  ON public.claims (tenant_id, entity_type, entity_id);

-- Find unverified claims for resolution sweeps.
CREATE INDEX IF NOT EXISTS idx_claims_unverified
  ON public.claims (tenant_id, status, best_evidence)
  WHERE status IN ('unverified', 'supported');

-- Find superseded chains.
CREATE INDEX IF NOT EXISTS idx_claims_superseded_by
  ON public.claims (tenant_id, superseded_by)
  WHERE superseded_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Evidence table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  claim_id          UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  source_type       TEXT NOT NULL,            -- "gmail_signature", "linkedin", "crm_record", "human_entry", "agent_inference"
  source_id         TEXT,                     -- ID of the source record
  observation       TEXT NOT NULL,            -- what was actually observed (the raw signal)
  strength          public.evidence_strength NOT NULL DEFAULT 'model_inference',
  provenance        JSONB NOT NULL DEFAULT '{}',-- structured metadata (url, confidence, context)
  agent_run_id      UUID,                     -- link to agent_runs trace
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Find all evidence for a claim.
CREATE INDEX IF NOT EXISTS idx_evidence_claim
  ON public.evidence (tenant_id, claim_id);

-- Tenant-composite primary key index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_tenant_id_id
  ON public.evidence (tenant_id, id);

-- Find evidence by source for provenance tracing.
CREATE INDEX IF NOT EXISTS idx_evidence_source
  ON public.evidence (tenant_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.claims
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant member access" ON public.evidence
  FOR ALL TO authenticated
  USING (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  )
  WITH CHECK (
    tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id)
  );

-- =============================================================================
-- Record evidence RPC: atomically add evidence to a claim and update status.
--
-- This is the primary write path for the claim ledger. It:
--   1. Finds or creates the claim for (entity_type, entity_id, field)
--   2. Adds the evidence row
--   3. Recalculates the claim's best_evidence from all evidence
--   4. Applies the human truth hierarchy to determine status
--   5. Returns the claim and evidence IDs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_evidence(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_field TEXT,
  p_proposed_value TEXT,
  p_source_type TEXT,
  p_observation TEXT,
  p_strength public.evidence_strength DEFAULT 'model_inference',
  p_source_id TEXT DEFAULT NULL,
  p_provenance JSONB DEFAULT '{}',
  p_coworker_id TEXT DEFAULT NULL,
  p_agent_run_id UUID DEFAULT NULL
) RETURNS TABLE (
  claim_id UUID,
  evidence_id UUID,
  claim_status public.claim_status,
  best_evidence public.evidence_strength,
  is_new_claim BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_claim_id UUID;
  v_evidence_id UUID;
  v_is_new_claim BOOLEAN := false;
  v_best_evidence public.evidence_strength;
  v_claim_status public.claim_status;
  v_existing_value TEXT;
BEGIN
  v_tenant_id := private.authorized_request_tenant_id();

  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'entity_type is required';
  END IF;
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required';
  END IF;
  IF p_field IS NULL OR btrim(p_field) = '' THEN
    RAISE EXCEPTION 'field is required';
  END IF;
  IF p_proposed_value IS NULL OR btrim(p_proposed_value) = '' THEN
    RAISE EXCEPTION 'proposed_value is required';
  END IF;
  IF p_source_type IS NULL OR btrim(p_source_type) = '' THEN
    RAISE EXCEPTION 'source_type is required';
  END IF;
  IF p_observation IS NULL OR btrim(p_observation) = '' THEN
    RAISE EXCEPTION 'observation is required';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1: Find or create the claim.
  -- -------------------------------------------------------------------------
  SELECT id, proposed_value INTO v_claim_id, v_existing_value
  FROM public.claims
  WHERE tenant_id = v_tenant_id
    AND entity_type = btrim(p_entity_type)
    AND entity_id = p_entity_id
    AND field = btrim(p_field)
    AND status IN ('unverified', 'supported', 'conflicted', 'verified')
  LIMIT 1;

  IF NOT FOUND THEN
    -- No open claim: create one.
    INSERT INTO public.claims (
      tenant_id, entity_type, entity_id, field, proposed_value,
      status, source_type, source_id, coworker_id, agent_run_id
    ) VALUES (
      v_tenant_id, btrim(p_entity_type), p_entity_id, btrim(p_field), btrim(p_proposed_value),
      'unverified', btrim(p_source_type), p_source_id, p_coworker_id, p_agent_run_id
    ) RETURNING id INTO v_claim_id;
    v_is_new_claim := true;
  ELSIF v_existing_value IS DISTINCT FROM btrim(p_proposed_value) THEN
    -- Value conflict: the existing claim proposes a different value.
    -- Add the evidence but mark the claim as conflicted.
    UPDATE public.claims
    SET status = 'conflicted'
    WHERE id = v_claim_id AND status != 'conflicted';
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 2: Add the evidence row.
  -- -------------------------------------------------------------------------
  INSERT INTO public.evidence (
    tenant_id, claim_id, source_type, source_id, observation,
    strength, provenance, agent_run_id
  ) VALUES (
    v_tenant_id, v_claim_id, btrim(p_source_type), p_source_id, btrim(p_observation),
    p_strength, p_provenance, p_agent_run_id
  ) RETURNING id INTO v_evidence_id;

  -- -------------------------------------------------------------------------
  -- Step 3: Recalculate best_evidence and claim status.
  -- -------------------------------------------------------------------------
  -- Determine the strongest evidence across all evidence for this claim.
  -- The hierarchy is: human_confirmed > human_entered > verified_external >
  --                   probable_external > model_inference
  SELECT MIN(e.strength) INTO v_best_evidence
  FROM public.evidence e
  WHERE e.claim_id = v_claim_id
    -- Use the PostgreSQL enum ordering: human_confirmed < human_entered < ... < model_inference
  GROUP BY e.claim_id;

  -- Apply human truth hierarchy:
  --   human_confirmed or human_entered → verified
  --   verified_external → supported
  --   probable_external → supported
  --   model_inference → unverified (never auto-verify from model inference alone)
  --   conflicted claims stay conflicted regardless of evidence strength
  SELECT status INTO v_claim_status FROM public.claims WHERE id = v_claim_id;

  IF v_claim_status = 'conflicted' THEN
    -- Conflicted claims stay conflicted until human review.
    v_claim_status := 'conflicted';
  ELSIF v_best_evidence IN ('human_confirmed', 'human_entered') THEN
    v_claim_status := 'verified';
  ELSIF v_best_evidence IN ('verified_external', 'probable_external') THEN
    v_claim_status := 'supported';
  ELSE
    v_claim_status := 'unverified';
  END IF;

  UPDATE public.claims
  SET best_evidence = v_best_evidence,
      status = v_claim_status,
      resolved_at = CASE WHEN v_claim_status IN ('verified', 'superseded', 'retracted') THEN now() ELSE resolved_at END
  WHERE id = v_claim_id;

  RETURN QUERY SELECT v_claim_id, v_evidence_id, v_claim_status, v_best_evidence, v_is_new_claim;
END;
$$;

REVOKE ALL ON FUNCTION public.record_evidence(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_evidence(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.record_evidence(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, public.evidence_strength, TEXT, JSONB, TEXT, UUID) IS
  'Atomically records evidence for a claim, creating the claim if needed. Applies the human truth hierarchy to determine claim status. Returns the claim and evidence IDs.';

-- =============================================================================
-- Validation: proposed_value never null or empty
-- =============================================================================
ALTER TABLE public.claims
  ADD CONSTRAINT claims_proposed_value_required
  CHECK (btrim(proposed_value) <> '');

-- =============================================================================
-- Validation: observation never null or empty
-- =============================================================================
ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_observation_required
  CHECK (btrim(observation) <> '');
