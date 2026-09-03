import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceStrength =
  | "human_confirmed"
  | "human_entered"
  | "verified_external"
  | "probable_external"
  | "model_inference";

export type ClaimStatus =
  | "unverified"
  | "supported"
  | "conflicted"
  | "verified"
  | "superseded"
  | "retracted";

export interface Claim {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  proposed_value: string;
  status: ClaimStatus;
  best_evidence: EvidenceStrength | null;
  source_type: string;
  source_id: string | null;
  coworker_id: string | null;
  agent_run_id: string | null;
  superseded_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Evidence {
  id: string;
  tenant_id: string;
  claim_id: string;
  source_type: string;
  source_id: string | null;
  observation: string;
  strength: EvidenceStrength;
  provenance: Record<string, unknown>;
  agent_run_id: string | null;
  created_at: string;
}

export interface RecordEvidenceResult {
  claimId: string;
  evidenceId: string;
  claimStatus: ClaimStatus;
  bestEvidence: EvidenceStrength;
  isNewClaim: boolean;
}

/**
 * Evidence strength ordering for comparison.
 * Lower number = stronger evidence.
 */
const STRENGTH_ORDER: Record<EvidenceStrength, number> = {
  human_confirmed: 0,
  human_entered: 1,
  verified_external: 2,
  probable_external: 3,
  model_inference: 4,
};

export function evidenceStrengthOrder(strength: EvidenceStrength): number {
  return STRENGTH_ORDER[strength];
}

// ---------------------------------------------------------------------------
// Record evidence (primary write path — uses RPC)
// ---------------------------------------------------------------------------

export async function recordEvidence(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    field: string;
    proposedValue: string;
    sourceType: string;
    observation: string;
    strength?: EvidenceStrength;
    sourceId?: string | null;
    provenance?: Record<string, unknown>;
    coworkerId?: string | null;
    agentRunId?: string | null;
    actorEmail?: string | null;
  },
): Promise<RecordEvidenceResult> {
  const entityType = input.entityType.trim();
  const field = input.field.trim();
  const proposedValue = input.proposedValue.trim();
  const sourceType = input.sourceType.trim();
  const observation = input.observation.trim();

  if (!entityType) throw new Error("entityType is required");
  if (!field) throw new Error("field is required");
  if (!proposedValue) throw new Error("proposedValue is required");
  if (!sourceType) throw new Error("sourceType is required");
  if (!observation) throw new Error("observation is required");

  const { data, error } = await supabase
    .rpc("record_evidence", {
      p_entity_type: entityType,
      p_entity_id: input.entityId,
      p_field: field,
      p_proposed_value: proposedValue,
      p_source_type: sourceType,
      p_observation: observation,
      p_strength: input.strength ?? "model_inference",
      p_source_id: input.sourceId ?? null,
      p_provenance: input.provenance ?? {},
      p_coworker_id: input.coworkerId ?? null,
      p_agent_run_id: input.agentRunId ?? null,
    })
    .single();

  if (error) throw new Error(error.message);

  const result = data as {
    claim_id: string;
    evidence_id: string;
    claim_status: ClaimStatus;
    best_evidence: EvidenceStrength;
    is_new_claim: boolean;
  };

  if (result.is_new_claim) {
    await recordAudit(supabase, {
      actorEmail: input.actorEmail || "system",
      action: "claim.created",
      entityType: "claim",
      entityId: result.claim_id,
      source: "automation",
      after: {
        entity_type: entityType,
        entity_id: input.entityId,
        field,
        proposed_value: proposedValue,
        status: result.claim_status,
        best_evidence: result.best_evidence,
      },
    });
  }

  return {
    claimId: result.claim_id,
    evidenceId: result.evidence_id,
    claimStatus: result.claim_status,
    bestEvidence: result.best_evidence,
    isNewClaim: result.is_new_claim,
  };
}

// ---------------------------------------------------------------------------
// List claims for an entity
// ---------------------------------------------------------------------------

export async function listClaimsForEntity(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    status?: ClaimStatus[];
  },
): Promise<Claim[]> {
  let query = supabase
    .from("claims")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false });

  if (input.status?.length) {
    query = query.in("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Claim[];
}

// ---------------------------------------------------------------------------
// List evidence for a claim
// ---------------------------------------------------------------------------

export async function listEvidenceForClaim(
  supabase: SupabaseClient,
  claimId: string,
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Evidence[];
}

// ---------------------------------------------------------------------------
// Retract a claim
// ---------------------------------------------------------------------------

export async function retractClaim(
  supabase: SupabaseClient,
  claimId: string,
  reason: string,
  actorEmail?: string | null,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("claims")
    .select("id, status, field, proposed_value")
    .eq("id", claimId)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase
    .from("claims")
    .update({
      status: "retracted",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .in("status", ["unverified", "supported", "conflicted"]);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "claim.retracted",
    entityType: "claim",
    entityId: claimId,
    source: "automation",
    before: { status: before.status, field: before.field, proposed_value: before.proposed_value },
    after: { status: "retracted", reason },
  });
}

// ---------------------------------------------------------------------------
// Supersede a claim: replace it with a stronger one
// ---------------------------------------------------------------------------

export async function supersedeClaim(
  supabase: SupabaseClient,
  oldClaimId: string,
  newClaimId: string,
  actorEmail?: string | null,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("claims")
    .select("id, status, field, proposed_value, best_evidence")
    .eq("id", oldClaimId)
    .single();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("claims")
    .update({
      status: "superseded",
      superseded_by: newClaimId,
      resolved_at: now,
    })
    .eq("id", oldClaimId)
    .in("status", ["unverified", "supported", "conflicted"]);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "claim.superseded",
    entityType: "claim",
    entityId: oldClaimId,
    source: "automation",
    before: { status: before.status, best_evidence: before.best_evidence },
    after: { status: "superseded", superseded_by: newClaimId },
  });
}

// ---------------------------------------------------------------------------
// Human-confirm a claim: upgrade to human_confirmed evidence
// ---------------------------------------------------------------------------

export async function humanConfirmClaim(
  supabase: SupabaseClient,
  input: {
    claimId: string;
    actorEmail: string;
  },
): Promise<RecordEvidenceResult> {
  const { data: claim, error: readError } = await supabase
    .from("claims")
    .select("id, entity_type, entity_id, field, proposed_value")
    .eq("id", input.claimId)
    .single();
  if (readError) throw new Error(readError.message);

  return recordEvidence(supabase, {
    entityType: claim.entity_type,
    entityId: claim.entity_id,
    field: claim.field,
    proposedValue: claim.proposed_value,
    sourceType: "human_entry",
    observation: `Human confirmed: ${claim.proposed_value}`,
    strength: "human_confirmed",
    actorEmail: input.actorEmail,
  });
}

// ---------------------------------------------------------------------------
// Get unresolved conflicts for a tenant
// ---------------------------------------------------------------------------

export async function listConflictedClaims(
  supabase: SupabaseClient,
  input?: { limit?: number },
): Promise<Claim[]> {
  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("status", "conflicted")
    .order("created_at", { ascending: true })
    .limit(input?.limit ?? 50);

  if (error) throw new Error(error.message);
  return (data ?? []) as Claim[];
}
