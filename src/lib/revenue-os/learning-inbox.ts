import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { proposeAction } from "./actions";
import { recordLearnedPolicy, type LearnedPolicyEntry } from "./memory";
import type {
  LearningAuthority,
  LearningConfidence,
  LearningProposal,
  LearningProposalType,
  LearningStatus,
} from "./learning-inbox-types";
import { LEARNING_CONFIDENCES, LEARNING_PROPOSAL_TYPES } from "./learning-inbox-types";

export {
  LEARNING_AUTHORITIES,
  LEARNING_CONFIDENCES,
  LEARNING_PROPOSAL_TYPES,
  LEARNING_STATUSES,
} from "./learning-inbox-types";
export type {
  LearningAuthority,
  LearningConfidence,
  LearningProposal,
  LearningProposalType,
  LearningStatus,
} from "./learning-inbox-types";

// ---------------------------------------------------------------------------
// Institutional Learning Inbox: reusable human corrections become proposed,
// approved, shared intelligence. Nothing enters shared knowledge without
// explicit approval; approval executes through the existing action/autonomy
// path (approve_learning) and persists via the extended learned-policy
// record. Conversation-derived content defaults to the lowest authority.
// ---------------------------------------------------------------------------

function normalizeRule(rule: string): string {
  return rule.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Deterministic idempotency key: same type + normalized rule + scope collapses. */
export function learningDedupeKey(input: {
  type: LearningProposalType;
  rule: string;
  scope?: Record<string, unknown> | null;
}): string {
  return createHash("sha256")
    .update(`${input.type}|${normalizeRule(input.rule)}|${JSON.stringify(input.scope ?? null)}`)
    .digest("hex");
}

function toProposal(row: unknown): LearningProposal {
  return row as unknown as LearningProposal;
}

async function getProposal(supabase: SupabaseClient, id: string): Promise<LearningProposal | null> {
  const { data, error } = await supabase
    .from("learning_proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to read learning proposal: ${error.message}`);
  return data ? toProposal(data) : null;
}

/**
 * Propose a reusable correction. Replay-safe: a live row with the same
 * idempotency key is returned instead of duplicated. Terminal rows are
 * returned as-is; revival goes through setDisposition with full history.
 */
export async function proposeLearning(
  supabase: SupabaseClient,
  input: {
    type: LearningProposalType;
    rule: string;
    rationale?: string;
    scope?: Record<string, unknown> | null;
    confidence?: LearningConfidence;
    conflicts?: Record<string, unknown> | null;
    affectedWorkers?: string[];
    supersedesPolicyId?: string | null;
    sourceRefs?: Record<string, unknown> | null;
    actorEmail?: string | null;
  },
): Promise<LearningProposal> {
  if (!LEARNING_PROPOSAL_TYPES.includes(input.type)) throw new Error("Unknown proposal type");
  if (!normalizeRule(input.rule)) throw new Error("Rule must not be empty");
  const confidence = input.confidence ?? "medium";
  if (!LEARNING_CONFIDENCES.includes(confidence)) throw new Error("Unknown confidence");

  const dedupeKey = learningDedupeKey({ type: input.type, rule: input.rule, scope: input.scope });

  const { data: existing, error: readError } = await supabase
    .from("learning_proposals")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (readError) throw new Error(`Failed to check duplicate learning: ${readError.message}`);
  if (existing) return toProposal(existing);

  const { data, error } = await supabase
    .from("learning_proposals")
    .insert({
      proposal_type: input.type,
      rule: input.rule.trim(),
      rationale: input.rationale ?? "",
      scope: input.scope ?? null,
      confidence,
      conflicts: input.conflicts ?? null,
      affected_workers: input.affectedWorkers ?? [],
      supersedes_policy_id: input.supersedesPolicyId ?? null,
      source_refs: input.sourceRefs ?? null,
      authority: "working",
      status: "proposed",
      dedupe_key: dedupeKey,
    })
    .select("*")
    .single();
  if (error) {
    // Lost race with a concurrent identical proposal: return the winner.
    if ((error as { code?: string }).code === "23505") {
      const winner = await supabase
        .from("learning_proposals")
        .select("*")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (!winner.error && winner.data) return toProposal(winner.data);
    }
    throw new Error(`Failed to propose learning: ${error.message}`);
  }

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "learning.proposed",
    entityType: "learning_proposal",
    entityId: (data as { id: string }).id,
    after: { type: input.type, confidence },
  });

  return toProposal(data);
}

const ALLOWED_TRANSITIONS: Record<LearningStatus, LearningStatus[]> = {
  proposed: ["rejected", "conversation_only", "ignored"],
  approved: [],
  rejected: ["proposed"],
  conversation_only: [],
  ignored: ["proposed"],
};

/**
 * Record a disposition. Terminal states are explicit and audited; rejected
 * and ignored rows can be revived to proposed with history intact. The
 * proposed -> approved transition is refused here: approval must execute
 * through approveLearningProposal via the action path.
 */
export async function setLearningDisposition(
  supabase: SupabaseClient,
  input: { id: string; to: LearningStatus; actorEmail?: string | null },
): Promise<LearningProposal> {
  const current = await getProposal(supabase, input.id);
  if (!current) throw new Error("Learning proposal not found");
  if (input.to === "approved") throw new Error("Approval must execute through the action path");
  if (!ALLOWED_TRANSITIONS[current.status].includes(input.to))
    throw new Error(`Disposition ${current.status} -> ${input.to} is not allowed`);

  const { data, error } = await supabase
    .from("learning_proposals")
    .update({ status: input.to, decided_at: new Date().toISOString() })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to set learning disposition: ${error.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "learning.disposition",
    entityType: "learning_proposal",
    entityId: input.id,
    before: { status: current.status },
    after: { status: input.to },
  });

  return toProposal(data);
}

/**
 * Route a proposal into the existing approval lifecycle: a founder
 * confirmation in the Today approvals surface, executed by the executor.
 */
export async function requestLearningApproval(
  supabase: SupabaseClient,
  input: { id: string; actorEmail?: string | null },
): Promise<Record<string, unknown>> {
  const current = await getProposal(supabase, input.id);
  if (!current) throw new Error("Learning proposal not found");
  if (current.status !== "proposed")
    throw new Error(`Only proposed learnings can seek approval (status: ${current.status})`);

  return (await proposeAction(supabase, {
    actionType: "approve_learning",
    title: `Approve learning: ${current.rule.slice(0, 120)}`,
    description: current.rationale || undefined,
    payload: { proposalId: current.id },
    reasoning: `Learning proposal ${current.id} (${current.proposal_type}, confidence ${current.confidence})`,
    sourceContext: "learning-inbox",
    entityType: "learning_proposal",
    entityId: current.id,
    dedupeKey: `approve-learning:${current.id}`,
    proposedBy: input.actorEmail ?? undefined,
  })) as unknown as Record<string, unknown>;
}

/**
 * Execute an approved learning: freshness recheck, then persist through the
 * extended learned-policy record with authority tier and provenance.
 * Idempotent: an already-approved row returns its current state.
 */
export async function approveLearningProposal(
  supabase: SupabaseClient,
  input: { proposalId: string; actorEmail?: string | null },
): Promise<{ proposal: LearningProposal; policy: LearnedPolicyEntry }> {
  const current = await getProposal(supabase, input.proposalId);
  if (!current) throw new Error("Learning proposal not found");

  if (current.status === "approved") {
    if (!current.learned_policy_id)
      throw new Error("Proposal approved without a recorded policy; refusing to diverge");
    const { data: policy, error: policyError } = await supabase
      .from("learned_policies")
      .select("*")
      .eq("id", current.learned_policy_id)
      .maybeSingle();
    if (policyError || !policy)
      throw new Error("Approved learning lost its policy record; refusing to diverge");
    return { proposal: current, policy: policy as unknown as LearnedPolicyEntry };
  }
  if (current.status !== "proposed")
    throw new Error(`Only proposed learnings can be approved (status: ${current.status})`);

  const policy = await recordLearnedPolicy(supabase, {
    actionKey: `learning:${current.proposal_type}`,
    rule: current.rule,
    rationale: current.rationale || `Approved from learning proposal ${current.id}`,
    source: "approved_learning",
    scopeEntityType: null,
    scopeEntityId: null,
    actorEmail: input.actorEmail,
    proposalType: current.proposal_type,
    scope: current.scope,
    confidence: current.confidence,
    conflicts: current.conflicts,
    affectedWorkers: current.affected_workers,
    authority: current.authority,
  });

  // Forward-link an explicitly superseded policy, if it is still active.
  if (current.supersedes_policy_id) {
    await supabase
      .from("learned_policies")
      .update({ superseded_at: new Date().toISOString(), superseded_by: policy.id })
      .eq("id", current.supersedes_policy_id)
      .is("superseded_at", null);
  }

  const { data, error } = await supabase
    .from("learning_proposals")
    .update({
      status: "approved",
      learned_policy_id: policy.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .eq("status", "proposed")
    .select("*")
    .single();
  if (error) throw new Error(`Failed to close approved learning: ${error.message}`);

  return { proposal: toProposal(data), policy };
}

/** Reject a proposal with a truthful terminal receipt. No shared residue. */
export async function rejectLearningProposal(
  supabase: SupabaseClient,
  input: { id: string; reason?: string; actorEmail?: string | null },
): Promise<LearningProposal> {
  const rejected = await setLearningDisposition(supabase, {
    id: input.id,
    to: "rejected",
    actorEmail: input.actorEmail,
  });
  if (input.reason) {
    await recordAudit(supabase, {
      actorEmail: input.actorEmail || "system",
      action: "learning.rejected",
      entityType: "learning_proposal",
      entityId: input.id,
      after: { reason: input.reason },
    });
  }
  return rejected;
}

/** Bounded inbox listing, newest first. Unapproved content stays queryable here, never in shared reads. */
export async function listLearningProposals(
  supabase: SupabaseClient,
  input?: { status?: LearningStatus; limit?: number },
): Promise<LearningProposal[]> {
  let query = supabase
    .from("learning_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50);
  if (input?.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list learnings: ${error.message}`);
  return ((data ?? []) as unknown[]).map(toProposal);
}
