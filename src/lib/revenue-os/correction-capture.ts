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

export interface CorrectionCandidate {
  suggestedRule: string;
  suggestedType: LearningProposalType;
  suggestedConfidence: LearningConfidence;
  removedSegments: string[];
  addedSegments: string[];
  sourceRefs: Record<string, unknown>;
}

function splitSegments(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
}

/**
 * Derive a candidate from an edited draft diff. Pure and deterministic:
 * multiset difference over sentences. Returns null when there is nothing
 * reusable (empty diff, whitespace-only change, or identical content).
 * Diff-derived candidates are ALWAYS low confidence — the human decides.
 */
export function diffDrafts(input: {
  before: string;
  after: string;
  context?: Record<string, unknown> | null;
}): CorrectionCandidate | null {
  if (typeof input.before !== "string" || typeof input.after !== "string") {
    throw new Error("before and after must be strings");
  }
  const beforeCounts = new Map<string, number>();
  for (const s of splitSegments(input.before)) beforeCounts.set(s, (beforeCounts.get(s) ?? 0) + 1);
  const removed: string[] = [];
  const added: string[] = [];
  for (const s of splitSegments(input.after)) {
    const remaining = beforeCounts.get(s) ?? 0;
    if (remaining > 0) beforeCounts.set(s, remaining - 1);
    else added.push(s);
  }
  for (const [s, n] of beforeCounts) for (let i = 0; i < n; i++) removed.push(s);
  if (added.length === 0) return null;

  return {
    suggestedRule: added.join(" ").slice(0, 500),
    suggestedType: "messaging",
    suggestedConfidence: "low",
    removedSegments: removed,
    addedSegments: added,
    sourceRefs: {
      origin: "draft-diff",
      ...(input.context ?? {}),
    },
  };
}

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
