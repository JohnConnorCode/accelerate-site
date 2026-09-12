import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import {
  retrieveKnowledge,
  type KnowledgeChunk,
  type KnowledgeQueryInput,
  type KnowledgeSearchResult,
} from "./knowledge";

// ---------------------------------------------------------------------------
// Brain source authority: tell the model what to believe. A registry maps
// each connected system to the truth domains it owns, with an authority
// tier, an owner, last verification and applies-to scope. Retrieval orders
// and tags context by tier; conflicts flag instead of resolving silently;
// stale entries surface instead of serving as current. Authority is
// configured explicitly, never inferred from volume or recency.
// ---------------------------------------------------------------------------

export const SOURCE_AUTHORITIES = ["official", "approved", "working", "historical"] as const;

export type SourceAuthorityTier = (typeof SOURCE_AUTHORITIES)[number];

const TIER_RANK: Record<SourceAuthorityTier, number> = {
  official: 4,
  approved: 3,
  working: 2,
  historical: 1,
};

/** Verification lapse after which an entry surfaces as stale. */
export const SOURCE_STALENESS_LAPSE_DAYS = 90;

export interface SourceAuthorityEntry {
  id: string;
  tenant_id: string;
  source_key: string;
  truth_domains: string[];
  authority: SourceAuthorityTier;
  owner_email: string | null;
  last_verified_at: string | null;
  applies_to: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorityChunk extends KnowledgeChunk {
  authority: SourceAuthorityTier;
  stale: boolean;
}

export interface AuthorityConflict {
  entityType: string;
  entityId: string;
  tiers: SourceAuthorityTier[];
  chunkCount: number;
}

export interface AuthoritySearchResult extends KnowledgeSearchResult {
  chunks: AuthorityChunk[];
  conflicts: AuthorityConflict[];
  staleSources: string[];
}

/**
 * Register or update a source authority. Idempotent on (tenant, source_key):
 * repeat registration updates the entry instead of duplicating it.
 */
export async function registerSource(
  supabase: SupabaseClient,
  input: {
    sourceKey: string;
    truthDomains: string[];
    authority?: SourceAuthorityTier;
    ownerEmail?: string | null;
    appliesTo?: Record<string, unknown> | null;
    actorEmail?: string | null;
  },
): Promise<SourceAuthorityEntry> {
  const key = input.sourceKey.trim().toLowerCase();
  if (!key) throw new Error("sourceKey must not be empty");
  if (!input.truthDomains.length) throw new Error("At least one truth domain is required");
  const authority = input.authority ?? "working";
  if (!SOURCE_AUTHORITIES.includes(authority)) throw new Error("Unknown authority tier");

  const now = new Date().toISOString();
  const { data: existing, error: readError } = await supabase
    .from("source_authorities")
    .select("*")
    .eq("source_key", key)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read source registry: ${readError.message}`);

  if (existing) {
    const { data, error } = await supabase
      .from("source_authorities")
      .update({
        truth_domains: input.truthDomains,
        authority,
        owner_email: input.ownerEmail ?? (existing as { owner_email: string | null }).owner_email,
        applies_to: input.appliesTo ?? (existing as { applies_to: unknown }).applies_to,
        updated_at: now,
      })
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update source authority: ${error.message}`);
    await recordAudit(supabase, {
      actorEmail: input.actorEmail || "system",
      action: "source_authority.updated",
      entityType: "source_authority",
      entityId: (data as { id: string }).id,
      after: { sourceKey: key, authority },
    });
    return data as unknown as SourceAuthorityEntry;
  }

  const { data, error } = await supabase
    .from("source_authorities")
    .insert({
      source_key: key,
      truth_domains: input.truthDomains,
      authority,
      owner_email: input.ownerEmail ?? null,
      applies_to: input.appliesTo ?? null,
    })
    .select("*")
    .single();
  if (error) {
    // Lost race with a concurrent identical registration: return the winner.
    if ((error as { code?: string }).code === "23505") {
      const winner = await supabase
        .from("source_authorities")
        .select("*")
        .eq("source_key", key)
        .maybeSingle();
      if (!winner.error && winner.data) return winner.data as unknown as SourceAuthorityEntry;
    }
    throw new Error(`Failed to register source authority: ${error.message}`);
  }

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "source_authority.registered",
    entityType: "source_authority",
    entityId: (data as { id: string }).id,
    after: { sourceKey: key, authority },
  });

  return data as unknown as SourceAuthorityEntry;
}

/** Mark a source verified now. Verification is an explicit human act. */
export async function verifySource(
  supabase: SupabaseClient,
  input: { id: string; actorEmail?: string | null },
): Promise<SourceAuthorityEntry> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("source_authorities")
    .update({ last_verified_at: now, updated_at: now })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to verify source: ${error.message}`);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "source_authority.verified",
    entityType: "source_authority",
    entityId: input.id,
    after: { verifiedAt: now },
  });
  return data as unknown as SourceAuthorityEntry;
}

/** Bounded registry listing, most recently updated first. */
export async function listSources(supabase: SupabaseClient): Promise<SourceAuthorityEntry[]> {
  const { data, error } = await supabase
    .from("source_authorities")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to list source authorities: ${error.message}`);
  return ((data ?? []) as unknown[]).map((r) => r as SourceAuthorityEntry);
}

/** Effective tier for a source key. Unregistered sources fail closed to low authority. */
export function resolveSourceAuthority(
  sourceKey: string,
  entries: Pick<SourceAuthorityEntry, "source_key" | "authority">[],
): SourceAuthorityTier {
  const found = entries.find((e) => e.source_key === sourceKey.trim().toLowerCase());
  return found ? found.authority : "historical";
}

/** True when verification lapsed (or never happened): surface, don't serve as current. */
export function isSourceStale(
  entry: Pick<SourceAuthorityEntry, "last_verified_at">,
  now: Date = new Date(),
): boolean {
  if (!entry.last_verified_at) return true;
  const lapseMs = SOURCE_STALENESS_LAPSE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - new Date(entry.last_verified_at).getTime() > lapseMs;
}

/**
 * Flag entities described differently across authority levels. Deterministic
 * and pure: same entity with different content from more than one tier is a
 * conflict to surface, never to resolve silently.
 */
export function flagSourceConflicts(
  chunks: Array<
    Pick<KnowledgeChunk, "entityType" | "entityId" | "content"> & { authority: SourceAuthorityTier }
  >,
): AuthorityConflict[] {
  const byEntity = new Map<
    string,
    {
      tiers: Set<SourceAuthorityTier>;
      contents: Set<string>;
      count: number;
      entityType: string;
      entityId: string;
    }
  >();
  for (const c of chunks) {
    const key = `${c.entityType}:${c.entityId}`;
    let group = byEntity.get(key);
    if (!group) {
      group = {
        tiers: new Set(),
        contents: new Set(),
        count: 0,
        entityType: c.entityType,
        entityId: c.entityId,
      };
      byEntity.set(key, group);
    }
    group.tiers.add(c.authority);
    group.contents.add(c.content);
    group.count += 1;
  }
  return [...byEntity.values()]
    .filter((g) => g.tiers.size > 1 && g.contents.size > 1)
    .map((g) => ({
      entityType: g.entityType,
      entityId: g.entityId,
      tiers: [...g.tiers].sort((a, b) => TIER_RANK[b] - TIER_RANK[a]),
      chunkCount: g.count,
    }));
}

/**
 * Retrieval with explicit source authority: run grounded retrieval, then
 * order chunks by tier, tag each chunk, surface stale sources, and flag
 * cross-tier conflicts. The base refusal contract is unchanged.
 */
export async function retrieveKnowledgeWithAuthority(
  supabase: SupabaseClient,
  input: KnowledgeQueryInput,
): Promise<AuthoritySearchResult> {
  const base = await retrieveKnowledge(supabase, input);
  const entries = await listSources(supabase);
  const staleSources = entries.filter((e) => isSourceStale(e)).map((e) => e.source_key);

  const enriched: AuthorityChunk[] = base.chunks
    .map((chunk) => {
      const authority = resolveSourceAuthority(chunk.source, entries);
      return {
        ...chunk,
        authority,
        stale: staleSources.includes(chunk.source),
      };
    })
    .sort((a, b) => TIER_RANK[b.authority] - TIER_RANK[a.authority]);

  return {
    ...base,
    chunks: enriched,
    conflicts: flagSourceConflicts(enriched),
    staleSources,
  };
}
