import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import {
  DEFAULT_SOURCE_AUTHORITY_TIER,
  KNOWLEDGE_SOURCE_SYSTEMS,
  SOURCE_AUTHORITY_CONTRACT,
  SOURCE_AUTHORITY_TIERS,
  type SourceAuthorityAppliesTo,
  type SourceAuthorityConflict,
  type SourceAuthorityEntry,
  type SourceAuthorityTier,
} from "./source-authority-types";

export {
  DEFAULT_SOURCE_AUTHORITY_TIER,
  KNOWLEDGE_SOURCE_SYSTEMS,
  SOURCE_AUTHORITY_CONTRACT,
  SOURCE_AUTHORITY_TIERS,
};
export type {
  SourceAuthorityAppliesTo,
  SourceAuthorityConflict,
  SourceAuthorityEntry,
  SourceAuthorityTier,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
const TIER_ORDER: Record<SourceAuthorityTier, number> = {
  official: 0,
  approved: 1,
  working: 2,
  low: 3,
};

export function authorityOrder(tier: SourceAuthorityTier): number {
  return TIER_ORDER[tier];
}

export function systemKeyForKnowledgeSource(source: string): string {
  if (source in KNOWLEDGE_SOURCE_SYSTEMS) {
    return KNOWLEDGE_SOURCE_SYSTEMS[source as keyof typeof KNOWLEDGE_SOURCE_SYSTEMS];
  }
  return source.trim().toLowerCase() || "unregistered";
}

export function isSourceStale(entry: SourceAuthorityEntry, now = Date.now()): boolean {
  const verified = Date.parse(entry.last_verified_at);
  if (Number.isNaN(verified)) return true;
  return verified + entry.verification_lapse_days * 86_400_000 < now;
}

function normalizeSlug(value: string, field: string): string {
  const slug = value.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new Error(`${field} must be a lowercase slug`);
  return slug;
}

function uniqueSlugs(values: string[], field: string): string[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${field} must not be empty`);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") throw new Error(`${field} must be a list of slugs`);
    const slug = normalizeSlug(value, field);
    if (seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
  }
  if (!result.length) throw new Error(`${field} must not be empty`);
  return result;
}

function requireTier(value: unknown): SourceAuthorityTier {
  if (typeof value !== "string" || !(SOURCE_AUTHORITY_TIERS as readonly string[]).includes(value)) {
    throw new Error("Unknown authority tier");
  }
  return value as SourceAuthorityTier;
}

function requireEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error("ownerEmail must be a valid email");
  return email;
}

function requireIsoDate(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`${field} must be an ISO date`);
  return new Date(parsed).toISOString();
}

function requireLapse(value: unknown): number {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error("verificationLapseDays must be an integer from 1 to 3650");
  }
  return days;
}

function normalizeAppliesTo(value: unknown): SourceAuthorityAppliesTo | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("appliesTo is invalid");
  const record = value as Record<string, unknown>;
  const applies: SourceAuthorityAppliesTo = {};
  if (record.entityTypes !== undefined) {
    applies.entityTypes = uniqueSlugs(record.entityTypes as string[], "appliesTo.entityTypes");
  }
  if (record.coworkerIds !== undefined) {
    if (
      !Array.isArray(record.coworkerIds) ||
      record.coworkerIds.some((id) => typeof id !== "string")
    ) {
      throw new Error("appliesTo.coworkerIds must be a list of strings");
    }
    applies.coworkerIds = record.coworkerIds.map((id) => id.trim()).filter(Boolean);
  }
  return Object.keys(applies).length ? applies : null;
}

/** Deterministic replay key over the exact registry mutation. */
export function sourceAuthorityRequestKey(input: {
  systemKey: string;
  displayName: string;
  truthDomains: string[];
  authorityTier: SourceAuthorityTier;
  ownerEmail: string;
  lastVerifiedAt: string;
  verificationLapseDays: number;
  appliesTo?: SourceAuthorityAppliesTo | null;
}): string {
  return createHash("sha256")
    .update(
      [
        input.systemKey,
        input.displayName.trim(),
        input.truthDomains.join(","),
        input.authorityTier,
        input.ownerEmail,
        input.lastVerifiedAt,
        String(input.verificationLapseDays),
        JSON.stringify(input.appliesTo ?? null),
      ].join("|"),
    )
    .digest("hex");
}

function toEntry(row: unknown): SourceAuthorityEntry {
  return row as SourceAuthorityEntry;
}

export interface RegisterSourceAuthorityInput {
  systemKey: string;
  displayName: string;
  truthDomains: string[];
  authorityTier: SourceAuthorityTier;
  ownerEmail: string;
  lastVerifiedAt: string;
  verificationLapseDays?: number;
  appliesTo?: SourceAuthorityAppliesTo | null;
  requestKey?: string;
  actorEmail?: string | null;
}

/**
 * Register or update a connected system against the truth domains it owns.
 * Authority is explicit: never inferred from volume or recency. Replay of the
 * same request key returns the existing row without mutation.
 */
export async function registerSourceAuthority(
  supabase: SupabaseClient,
  input: RegisterSourceAuthorityInput,
): Promise<SourceAuthorityEntry> {
  const systemKey = normalizeSlug(input.systemKey, "systemKey");
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("displayName must not be empty");
  const truthDomains = uniqueSlugs(input.truthDomains, "truthDomains");
  const authorityTier = requireTier(input.authorityTier);
  const ownerEmail = requireEmail(input.ownerEmail);
  const lastVerifiedAt = requireIsoDate(input.lastVerifiedAt, "lastVerifiedAt");
  const verificationLapseDays = requireLapse(input.verificationLapseDays ?? 90);
  const appliesTo = normalizeAppliesTo(input.appliesTo ?? null);
  const requestKey =
    input.requestKey?.trim() ||
    sourceAuthorityRequestKey({
      systemKey,
      displayName,
      truthDomains,
      authorityTier,
      ownerEmail,
      lastVerifiedAt,
      verificationLapseDays,
      appliesTo,
    });
  if (!requestKey) throw new Error("requestKey must not be empty");

  const { data: replay, error: replayError } = await supabase
    .from("source_authority_registry")
    .select("*")
    .eq("request_key", requestKey)
    .maybeSingle();
  if (replayError) throw new Error(`Failed to read source authority: ${replayError.message}`);
  if (replay) {
    const existing = toEntry(replay);
    if (existing.system_key !== systemKey) {
      throw new Error("requestKey is already bound to a different system");
    }
    return existing;
  }

  const now = new Date().toISOString();
  const payload = {
    system_key: systemKey,
    display_name: displayName,
    truth_domains: truthDomains,
    authority_tier: authorityTier,
    owner_email: ownerEmail,
    last_verified_at: lastVerifiedAt,
    verification_lapse_days: verificationLapseDays,
    applies_to: appliesTo,
    request_key: requestKey,
    updated_at: now,
  };

  const { data: current, error: currentError } = await supabase
    .from("source_authority_registry")
    .select("*")
    .eq("system_key", systemKey)
    .maybeSingle();
  if (currentError) throw new Error(`Failed to read source authority: ${currentError.message}`);

  if (current) {
    const before = toEntry(current);
    const { data, error } = await supabase
      .from("source_authority_registry")
      .update(payload)
      .eq("id", before.id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update source authority: ${error.message}`);
    const entry = toEntry(data);
    await recordAudit(supabase, {
      actorEmail: input.actorEmail || "system",
      action: "source_authority.updated",
      entityType: "source_authority",
      entityId: entry.id,
      before: {
        system_key: before.system_key,
        authority_tier: before.authority_tier,
        last_verified_at: before.last_verified_at,
      },
      after: {
        system_key: entry.system_key,
        authority_tier: entry.authority_tier,
        last_verified_at: entry.last_verified_at,
      },
    });
    return entry;
  }

  const { data, error } = await supabase
    .from("source_authority_registry")
    .insert({ ...payload, created_at: now })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const winner = await supabase
        .from("source_authority_registry")
        .select("*")
        .eq("system_key", systemKey)
        .maybeSingle();
      if (!winner.error && winner.data) return toEntry(winner.data);
    }
    throw new Error(`Failed to register source authority: ${error.message}`);
  }

  const entry = toEntry(data);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "source_authority.registered",
    entityType: "source_authority",
    entityId: entry.id,
    after: { system_key: entry.system_key, authority_tier: entry.authority_tier },
  });
  return entry;
}

export async function listSourceAuthorities(
  supabase: SupabaseClient,
  input?: { limit?: number },
): Promise<SourceAuthorityEntry[]> {
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  const { data, error } = await supabase.from("source_authority_registry").select("*").limit(limit);
  if (error) throw new Error(`Failed to list source authority: ${error.message}`);
  return (data ?? [])
    .map(toEntry)
    .sort(
      (a, b) =>
        authorityOrder(a.authority_tier) - authorityOrder(b.authority_tier) ||
        a.system_key.localeCompare(b.system_key),
    );
}

export async function loadSourceAuthorityIndex(
  supabase: SupabaseClient,
): Promise<Map<string, SourceAuthorityEntry>> {
  try {
    const entries = await listSourceAuthorities(supabase, { limit: 200 });
    return new Map(entries.map((entry) => [entry.system_key, entry]));
  } catch {
    // Retrieval fails closed to low authority rather than trusting silence.
    return new Map();
  }
}

export interface AuthorityAnnotatable {
  source: string;
  entityType: string;
  entityId: string;
  content: string;
  occurredAt: string;
  discrepancy?: string | null;
}

export type AuthorityAnnotated<T extends AuthorityAnnotatable> = T & {
  systemKey: string;
  authorityTier: SourceAuthorityTier;
  authorityOwner: string | null;
  lastVerifiedAt: string | null;
  stale: boolean;
  current: boolean;
  conflict: string | null;
};

/**
 * Tag retrieval chunks with configured authority. Unregistered sources stay
 * low. Conflicts are flagged; they are never silently resolved. Stale entries
 * are marked not-current instead of served as present truth.
 */
export function applySourceAuthority<T extends AuthorityAnnotatable>(
  chunks: T[],
  index: Map<string, SourceAuthorityEntry>,
  now = Date.now(),
): { chunks: AuthorityAnnotated<T>[]; conflicts: SourceAuthorityConflict[] } {
  const annotated: AuthorityAnnotated<T>[] = chunks.map((chunk) => {
    const systemKey = systemKeyForKnowledgeSource(chunk.source);
    const entry = index.get(systemKey);
    const authorityTier = entry?.authority_tier ?? DEFAULT_SOURCE_AUTHORITY_TIER;
    const stale = entry ? isSourceStale(entry, now) : false;
    return {
      ...chunk,
      systemKey,
      authorityTier,
      authorityOwner: entry?.owner_email ?? null,
      lastVerifiedAt: entry?.last_verified_at ?? null,
      stale,
      current: !stale,
      conflict: chunk.discrepancy ?? null,
    };
  });

  const conflicts: SourceAuthorityConflict[] = [];
  for (let i = 0; i < annotated.length; i += 1) {
    const left = annotated[i];
    const leftEntry = index.get(left.systemKey);
    const leftDomains = new Set(leftEntry?.truth_domains ?? []);
    for (let j = i + 1; j < annotated.length; j += 1) {
      const right = annotated[j];
      if (left.systemKey === right.systemKey) continue;
      if (left.entityType !== right.entityType || left.entityId !== right.entityId) continue;
      if (left.content === right.content) continue;
      const rightEntry = index.get(right.systemKey);
      const overlap = (rightEntry?.truth_domains ?? []).filter((domain) => leftDomains.has(domain));
      if (!overlap.length) continue;
      const domain = overlap[0];
      const detail = `Conflict: ${left.systemKey} and ${right.systemKey} disagree on ${domain} for ${left.entityType} ${left.entityId}. Sources are flagged; neither is auto-resolved.`;
      conflicts.push({
        domain,
        systemKeys: [left.systemKey, right.systemKey],
        entityType: left.entityType,
        entityId: left.entityId,
        detail,
      });
      left.conflict = left.conflict ?? detail;
      right.conflict = right.conflict ?? detail;
    }
  }

  annotated.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    const tier = authorityOrder(a.authorityTier) - authorityOrder(b.authorityTier);
    if (tier !== 0) return tier;
    return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  });

  return { chunks: annotated, conflicts };
}
