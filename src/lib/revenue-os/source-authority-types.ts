// Client-safe Source Authority vocabulary: types and constants only.
// This module must never import server code so admin client components can
// share it without poisoning the browser bundle.

export const SOURCE_AUTHORITY_CONTRACT = "revenue-os-source-authority.v1";

export const SOURCE_AUTHORITY_TIERS = ["official", "approved", "working", "low"] as const;

export type SourceAuthorityTier = (typeof SOURCE_AUTHORITY_TIERS)[number];

export const DEFAULT_SOURCE_AUTHORITY_TIER: SourceAuthorityTier = "low";

/** Explicit mapping from retrieval sources to registry system keys. */
export const KNOWLEDGE_SOURCE_SYSTEMS = {
  canonical_record: "canonical_crm",
  founder_note: "founder_notes",
  activity_ledger: "activity_ledger",
  conversation: "conversations",
} as const;

export type KnowledgeSourceSystem =
  (typeof KNOWLEDGE_SOURCE_SYSTEMS)[keyof typeof KNOWLEDGE_SOURCE_SYSTEMS];

export interface SourceAuthorityAppliesTo {
  entityTypes?: string[];
  coworkerIds?: string[];
}

export interface SourceAuthorityEntry {
  id: string;
  tenant_id: string;
  system_key: string;
  display_name: string;
  truth_domains: string[];
  authority_tier: SourceAuthorityTier;
  owner_email: string;
  last_verified_at: string;
  verification_lapse_days: number;
  applies_to: SourceAuthorityAppliesTo | null;
  request_key: string;
  created_at: string;
  updated_at: string;
}

export interface SourceAuthorityConflict {
  domain: string;
  systemKeys: string[];
  entityType: string;
  entityId: string;
  detail: string;
}
