import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callSourceAuthorityRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import {
  DEFAULT_SOURCE_AUTHORITY_TIER,
  KNOWLEDGE_SOURCE_SYSTEMS,
  SOURCE_AUTHORITY_CONTRACT,
  SOURCE_AUTHORITY_TIERS,
  type SourceAuthorityAppliesTo,
  type SourceAuthorityConflict,
  type SourceAuthorityEntry,
  type SourceAuthorityTier,
  type SourceAuthorityReceipt,
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
  SourceAuthorityReceipt,
};
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
  return (
    KNOWLEDGE_SOURCE_SYSTEMS[source as keyof typeof KNOWLEDGE_SOURCE_SYSTEMS] ??
    (source.trim().toLowerCase() || "unregistered")
  );
}
export function isSourceStale(entry: SourceAuthorityEntry, now = Date.now()): boolean {
  const verified = Date.parse(entry.last_verified_at);
  return (
    !Number.isFinite(verified) ||
    verified > now ||
    verified + entry.verification_lapse_days * 86_400_000 < now
  );
}
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{0,62}$/);
const slugs = z
  .array(slug)
  .min(1)
  .max(32)
  .transform((values) => [...new Set(values)].sort());
const appliesTo = z
  .object({
    entityTypes: slugs.optional(),
    coworkerIds: z
      .array(z.string().trim().min(1).max(120))
      .min(1)
      .max(16)
      .transform((values) => [...new Set(values)].sort())
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
  .nullable()
  .optional();
const commandSchema = z
  .object({
    systemKey: slug,
    displayName: z.string().trim().min(1).max(120),
    truthDomains: slugs,
    authorityTier: z.enum(SOURCE_AUTHORITY_TIERS),
    ownerEmail: z.string().trim().toLowerCase().email().max(320),
    lastVerifiedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => Date.parse(value) <= Date.now(), "Verification cannot be in the future")
      .transform((value) => new Date(value).toISOString()),
    verificationLapseDays: z.number().int().min(1).max(3650).default(90),
    appliesTo,
    expectedVersion: z.number().int().min(0).max(2147483646).default(0),
    requestKey: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();
export class SourceAuthorityCommandError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SourceAuthorityCommandError";
  }
}
export function prepareSourceAuthorityCommand(input: unknown) {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new SourceAuthorityCommandError(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "Source"}: ${issue.message}`)
        .join("; "),
    );
  const { requestKey, ...value } = parsed.data;
  const normalized = { ...value, appliesTo: value.appliesTo ?? null };
  return { ...normalized, requestKey: requestKey ?? sourceAuthorityRequestKey(normalized) };
}
/** Hash structured content so delimiters in names cannot alias another command. */
export function sourceAuthorityRequestKey(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
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
  expectedVersion?: number;
  requestKey?: string;
  actorEmail?: string | null;
}
/** State, exact audit and immutable receipt are written by one host-owned command. */
export async function registerSourceAuthority(
  db: SupabaseClient,
  input: RegisterSourceAuthorityInput,
): Promise<SourceAuthorityReceipt> {
  const { actorEmail, ...raw } = input;
  const command = prepareSourceAuthorityCommand(raw);
  const { requestKey, ...payload } = command;
  let result;
  try {
    result = await callSourceAuthorityRpc(db, {
      p_command: payload,
      p_request_key: requestKey,
      p_actor_email: actorEmail,
    });
  } catch {
    throw new SourceAuthorityCommandError(
      "Save is unconfirmed. Keep this form and retry the same request to recover its receipt.",
      503,
    );
  }
  if (result.error) {
    const code = result.error.code;
    if (code === "40001")
      throw new SourceAuthorityCommandError(
        "This source changed. Reload its current version before proposing another change.",
        409,
      );
    if (code === "22023")
      throw new SourceAuthorityCommandError(
        "This request conflicts with an earlier command or contains invalid source settings. Reload before starting a new request.",
        409,
      );
    if (code === "55000")
      throw new SourceAuthorityCommandError(
        "The earlier save receipt could not be verified. Keep this request and review the audit history before retrying.",
        503,
      );
    if (code === "42501")
      throw new SourceAuthorityCommandError(
        "Current workspace administrator access is required.",
        403,
      );
    throw new SourceAuthorityCommandError(
      "Save is unconfirmed. Keep this form and retry the same request to recover its receipt.",
      503,
    );
  }
  const receipt = result.data as SourceAuthorityReceipt | null;
  if (!receipt?.entry?.id || receipt.requestKey !== requestKey || !receipt.auditId)
    throw new SourceAuthorityCommandError(
      "Save is unconfirmed. Retry the same request to recover its receipt.",
      503,
    );
  return receipt;
}
export async function listSourceAuthorities(
  db: SupabaseClient,
  input?: { limit?: number },
): Promise<SourceAuthorityEntry[]> {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Source authority requires a tenant-bound database");
  const limit = Math.min(200, Math.max(1, Math.trunc(input?.limit ?? 100)));
  const { data, error } = await db
    .from("source_authority_registry")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("system_key")
    .limit(limit);
  if (error) throw new Error("Source authority could not be loaded");
  return (data ?? []).sort(
    (a, b) =>
      authorityOrder(a.authority_tier) - authorityOrder(b.authority_tier) ||
      a.system_key.localeCompare(b.system_key),
  ) as SourceAuthorityEntry[];
}
export async function loadSourceAuthorityIndex(
  db: SupabaseClient,
): Promise<Map<string, SourceAuthorityEntry>> {
  const entries = await listSourceAuthorities(db, { limit: 200 });
  return new Map(entries.map((entry) => [entry.system_key, entry]));
}

function authorityApplies(entry: SourceAuthorityEntry, chunk: AuthorityAnnotatable): boolean {
  const scope = entry.applies_to;
  return (
    (!scope?.entityTypes || scope.entityTypes.includes(chunk.entityType)) &&
    (!scope?.coworkerIds ||
      Boolean(chunk.coworkerId && scope.coworkerIds.includes(chunk.coworkerId)))
  );
}

export interface AuthorityAnnotatable {
  source: string;
  systemKey?: string;
  coworkerId?: string;
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
    const systemKey = chunk.systemKey ?? systemKeyForKnowledgeSource(chunk.source);
    const candidate = index.get(systemKey);
    const entry = candidate && authorityApplies(candidate, chunk) ? candidate : undefined;
    const authorityTier = entry?.authority_tier ?? DEFAULT_SOURCE_AUTHORITY_TIER;
    const stale = entry ? isSourceStale(entry, now) : false;
    return {
      ...chunk,
      systemKey,
      authorityTier,
      authorityOwner: entry?.owner_email ?? null,
      lastVerifiedAt: entry?.last_verified_at ?? null,
      stale,
      current: Boolean(entry) && !stale,
      conflict: chunk.discrepancy ?? null,
    };
  });

  const conflicts: SourceAuthorityConflict[] = [];
  for (let i = 0; i < annotated.length; i += 1) {
    const left = annotated[i];
    if (!left) continue;
    const leftCandidate = index.get(left.systemKey);
    const leftEntry =
      leftCandidate && authorityApplies(leftCandidate, left) ? leftCandidate : undefined;
    const leftDomains = new Set(leftEntry?.truth_domains ?? []);
    for (let j = i + 1; j < annotated.length; j += 1) {
      const right = annotated[j];
      if (!right) continue;
      if (left.systemKey === right.systemKey) continue;
      if (left.entityType !== right.entityType || left.entityId !== right.entityId) continue;
      if (left.content === right.content) continue;
      const rightCandidate = index.get(right.systemKey);
      const rightEntry =
        rightCandidate && authorityApplies(rightCandidate, right) ? rightCandidate : undefined;
      const overlap = (rightEntry?.truth_domains ?? []).filter((domain) => leftDomains.has(domain));
      const domain = overlap[0];
      if (!domain) continue;
      const detail = `Potential conflict: ${left.systemKey} and ${right.systemKey} contain different evidence about ${domain} for ${left.entityType} ${left.entityId}. Sources are flagged; neither is auto-resolved.`;
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
    if (a.stale !== b.stale) return a.stale ? 1 : -1;
    if (a.current !== b.current) return a.current ? -1 : 1;
    const tier = authorityOrder(a.authorityTier) - authorityOrder(b.authorityTier);
    if (tier !== 0) return tier;
    return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  });

  return { chunks: annotated, conflicts };
}
