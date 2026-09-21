import type { LearningConfidence, LearningProposalType } from "./learning-inbox-types";

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
  if (input.before.length > 50000 || input.after.length > 50000)
    throw new Error("Draft comparison is limited to 50000 characters");
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
