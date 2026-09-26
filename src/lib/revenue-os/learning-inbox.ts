import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { proposeAction } from "./actions";
import type { LearnedPolicyEntry } from "./memory";
import type {
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`${field} must be a valid UUID`);
}

/** Deterministic idempotency key: same type + normalized rule + scope collapses. */
export function learningDedupeKey(input: {
  type: LearningProposalType;
  rule: string;
  scope?: Record<string, unknown> | null;
  affectedWorkers?: string[];
  supersedesPolicyId?: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.type,
        normalizeRule(input.rule),
        input.scope
          ? Object.fromEntries(Object.entries(input.scope).sort(([a], [b]) => a.localeCompare(b)))
          : null,
        [...new Set(input.affectedWorkers ?? [])].sort(),
        input.supersedesPolicyId ?? null,
      ]),
    )
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
  if (input.rule.length > 10000 || (input.rationale?.length ?? 0) > 10000)
    throw new Error("Learning text exceeds 10000 characters");
  if (
    (input.affectedWorkers?.length ?? 0) > 50 ||
    input.affectedWorkers?.some((worker) => !/^[a-z0-9_-]{1,100}$/.test(worker))
  )
    throw new Error("Invalid affected workers");
  const confidence = input.confidence ?? "medium";
  if (!LEARNING_CONFIDENCES.includes(confidence)) throw new Error("Unknown confidence");
  if (input.supersedesPolicyId) requireUuid(input.supersedesPolicyId, "supersedesPolicyId");

  const dedupeKey = learningDedupeKey(input);

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
    .eq("status", current.status)
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

  const action = (await proposeAction(supabase, {
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
  })) as unknown as { id: string } | null;
  if (!action?.id) throw new Error("Approval action was not staged; try again");

  // Link the approval so the inbox shows awaiting-approval state. The
  // dedupe collapse may return a pre-existing action; either way the
  // stored id is the live approval for this proposal.
  if (!current.approval_action_id || current.approval_action_id !== action.id) {
    await supabase
      .from("learning_proposals")
      .update({ approval_action_id: action.id })
      .eq("id", current.id);
  }
  return action;
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
  requireUuid(input.proposalId, "proposalId");
  const { data, error } = await supabase.rpc("approve_learning_proposal", {
    p_proposal_id: input.proposalId,
    p_actor: input.actorEmail ?? "system",
  });
  if (error) throw new Error(`Failed to approve learning: ${error.message}`);
  if (!data?.proposal || !data?.policy) throw new Error("Approval returned no learning receipt");
  return data as { proposal: LearningProposal; policy: LearnedPolicyEntry };
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
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  let query = supabase
    .from("learning_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (input?.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list learnings: ${error.message}`);
  return ((data ?? []) as unknown[]).map(toProposal);
}

/** Flag legacy broad replacements for review. An explicit replacement is
 * intentional; a type-wide replacement must not silently reactivate history. */
export async function listDisplacedLearnings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("learned_policies")
    .select("id,rule,superseded_by,affected_workers,scope,proposal_type")
    .eq("source", "approved_learning")
    .not("superseded_at", "is", null)
    .order("superseded_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to inspect learning history: ${error.message}`);
  if (!data?.length) return [];
  const replacementIds = data.map((p) => p.superseded_by).filter(Boolean);
  if (!replacementIds.length) return [];
  const { data: replacements, error: replacementError } = await supabase
    .from("learning_proposals")
    .select("learned_policy_id,supersedes_policy_id")
    .in("learned_policy_id", replacementIds);
  if (replacementError)
    throw new Error(`Failed to inspect replacements: ${replacementError.message}`);
  return data.filter((p) =>
    replacements?.some(
      (r) => r.learned_policy_id === p.superseded_by && r.supersedes_policy_id !== p.id,
    ),
  );
}
