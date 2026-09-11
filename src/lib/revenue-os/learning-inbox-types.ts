// Client-safe Learning Inbox vocabulary: types and constants only.
// This module must never import server code (Supabase, audit, actions,
// node:crypto) so admin client components can share it without poisoning
// the browser bundle.

export const LEARNING_PROPOSAL_TYPES = [
  "positioning_policy",
  "workflow_preference",
  "offering",
  "messaging",
  "process_rule",
  "other",
] as const;

export type LearningProposalType = (typeof LEARNING_PROPOSAL_TYPES)[number];

export const LEARNING_AUTHORITIES = ["official", "approved", "working", "historical"] as const;

export type LearningAuthority = (typeof LEARNING_AUTHORITIES)[number];

export const LEARNING_CONFIDENCES = ["high", "medium", "low"] as const;

export type LearningConfidence = (typeof LEARNING_CONFIDENCES)[number];

export const LEARNING_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "conversation_only",
  "ignored",
] as const;

export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export interface LearningProposal {
  id: string;
  tenant_id: string;
  proposal_type: LearningProposalType;
  rule: string;
  rationale: string;
  scope: Record<string, unknown> | null;
  confidence: LearningConfidence;
  conflicts: Record<string, unknown> | null;
  affected_workers: string[];
  supersedes_policy_id: string | null;
  source_refs: Record<string, unknown> | null;
  authority: LearningAuthority;
  status: LearningStatus;
  dedupe_key: string;
  learned_policy_id: string | null;
  approval_action_id: string | null;
  created_at: string;
  decided_at: string | null;
}
