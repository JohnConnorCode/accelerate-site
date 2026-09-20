import type { SupabaseClient } from "@supabase/supabase-js";
import {
  proposeLearning,
  type LearningConfidence,
  type LearningProposal,
  type LearningProposalType,
} from "./learning-inbox";

// ---------------------------------------------------------------------------
// Correction capture: notice reusable corrections in normal work and file
// them as reviewable Learning Inbox candidates. Detection READS conversation
// and draft state only; it never writes shared knowledge directly. Every
// candidate still waits for human review, and low-confidence or ambiguous
// input stays a suggestion that never auto-files.
// ---------------------------------------------------------------------------

export { diffDrafts } from "./correction-diff";
import type { CorrectionCandidate } from "./correction-diff";
export type { CorrectionCandidate } from "./correction-diff";

/**
 * File an explicitly user-marked correction. This is the only path from
 * detection to the inbox, and it files through proposeLearning — so replay
 * collapse, validation and audit come along unchanged.
 */
export async function fileMarkedCorrection(
  supabase: SupabaseClient,
  input: {
    rule: string;
    rationale?: string;
    type?: LearningProposalType;
    scope?: Record<string, unknown> | null;
    confidence?: LearningConfidence;
    affectedWorkers?: string[];
    sourceRefs?: Record<string, unknown> | null;
    actorEmail?: string | null;
  },
): Promise<LearningProposal> {
  return proposeLearning(supabase, {
    type: input.type ?? "messaging",
    rule: input.rule,
    rationale: input.rationale ?? "",
    scope: input.scope ?? null,
    confidence: input.confidence,
    affectedWorkers: input.affectedWorkers,
    sourceRefs: { origin: "user-marked", ...(input.sourceRefs ?? {}) },
    actorEmail: input.actorEmail,
  });
}

/**
 * File a diff-derived candidate after human review. Candidates never
 * self-file: calling this is the human (or human-approved) decision.
 */
export async function fileCandidate(
  supabase: SupabaseClient,
  candidate: CorrectionCandidate,
  input?: {
    type?: LearningProposalType;
    rationale?: string;
    actorEmail?: string | null;
  },
): Promise<LearningProposal> {
  return proposeLearning(supabase, {
    type: input?.type ?? candidate.suggestedType,
    rule: candidate.suggestedRule,
    rationale: input?.rationale ?? "",
    confidence: candidate.suggestedConfidence,
    sourceRefs: candidate.sourceRefs,
    actorEmail: input?.actorEmail,
  });
}
