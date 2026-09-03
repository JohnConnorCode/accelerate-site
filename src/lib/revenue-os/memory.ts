import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { retrieveKnowledge, type KnowledgeSearchResult } from "./knowledge";
import { listClaimsForEntity } from "./claims";
import { loadActivityTimeline } from "./activities";

// ---------------------------------------------------------------------------
// Memory architecture (northstar §23)
//
// Memory should not be treated as a single vector database. There are
// different categories that should not be casually collapsed together:
//
//   1. Canonical memory — actual business records (contacts, opportunities, etc.)
//   2. Activity memory   — what happened (emails, calls, stage changes, etc.)
//   3. Knowledge memory  — documents and indexed sources (Drive, PDFs, playbooks)
//   4. Agent memory      — agent-specific context (prior work, research, questions)
//   5. Learned policy    — explicit rules derived from human decisions
//
// Categories 1–3 already have backing stores (CRM tables, activities, knowledge).
// This module adds categories 4–5 and a unified query interface that routes
// across all five without collapsing them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const MEMORY_CATEGORIES = [
  "canonical",
  "activity",
  "knowledge",
  "agent",
  "learned_policy",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface AgentMemoryEntry {
  id: string;
  tenant_id: string;
  coworker_id: string | null;
  agent_run_id: string | null;
  category: "prior_work" | "prior_research" | "scheduled_check" | "unresolved_question";
  subject: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  relevance_horizon: "session" | "daily" | "weekly" | "permanent";
  created_at: string;
  expires_at: string | null;
}

export interface LearnedPolicyEntry {
  id: string;
  tenant_id: string;
  action_key: string;
  rule: string;
  rationale: string;
  source: "human_decision" | "founder_override" | "incident_remediation" | "policy_review";
  coworker_id: string | null;
  scope_entity_type: string | null;
  scope_entity_id: string | null;
  superseded_by: string | null;
  created_at: string;
  superseded_at: string | null;
}

// ---------------------------------------------------------------------------
// Agent memory: store and retrieve agent-specific context
// ---------------------------------------------------------------------------

/**
 * Store agent memory — prior work results, research findings, unresolved
 * questions, or scheduled check reminders. These are scoped to a coworker
 * and/or agent run and decay over time based on the relevance horizon.
 */
export async function storeAgentMemory(
  supabase: SupabaseClient,
  input: {
    coworkerId?: string | null;
    agentRunId?: string | null;
    category: AgentMemoryEntry["category"];
    subject: string;
    body: string;
    entityType?: string | null;
    entityId?: string | null;
    relevanceHorizon?: AgentMemoryEntry["relevance_horizon"];
    actorEmail?: string | null;
  },
): Promise<AgentMemoryEntry> {
  const horizon = input.relevanceHorizon ?? "daily";
  const expiresAt = computeExpiry(horizon);

  const { data, error } = await supabase
    .from("agent_memory")
    .insert({
      coworker_id: input.coworkerId ?? null,
      agent_run_id: input.agentRunId ?? null,
      category: input.category,
      subject: input.subject,
      body: input.body,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      relevance_horizon: horizon,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to store agent memory: ${error.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "agent_memory.stored",
    entityType: "agent_memory",
    entityId: data.id,
    source: "ai",
    after: { category: input.category, subject: input.subject, horizon },
  });

  return data as AgentMemoryEntry;
}

/**
 * Retrieve agent memory relevant to a scope. Returns non-expired entries
 * ordered by recency, optionally filtered by coworker, category, or entity.
 */
export async function retrieveAgentMemory(
  supabase: SupabaseClient,
  input: {
    coworkerId?: string;
    category?: AgentMemoryEntry["category"];
    entityType?: string;
    entityId?: string;
    limit?: number;
  },
): Promise<AgentMemoryEntry[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from("agent_memory")
    .select()
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (input.coworkerId) query = query.eq("coworker_id", input.coworkerId);
  if (input.category) query = query.eq("category", input.category);
  if (input.entityType) query = query.eq("entity_type", input.entityType);
  if (input.entityId) query = query.eq("entity_id", input.entityId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to retrieve agent memory: ${error.message}`);
  return (data ?? []) as AgentMemoryEntry[];
}

// ---------------------------------------------------------------------------
// Learned policy: explicit rules derived from human decisions
// ---------------------------------------------------------------------------

/**
 * Record a learned policy — an explicit rule derived from a human decision.
 * These are the "don't do X" and "always ask before Y" rules that emerge
 * from real operational experience.
 */
export async function recordLearnedPolicy(
  supabase: SupabaseClient,
  input: {
    actionKey: string;
    rule: string;
    rationale: string;
    source: LearnedPolicyEntry["source"];
    coworkerId?: string | null;
    scopeEntityType?: string | null;
    scopeEntityId?: string | null;
    actorEmail?: string | null;
  },
): Promise<LearnedPolicyEntry> {
  // Only one active (superseded_at IS NULL) row may exist per action_key +
  // scope (learned_policies_active_global / _active_scoped partial unique
  // indexes) — so the old row must be superseded BEFORE the new one is
  // inserted, not after, or the insert violates that constraint. Generating
  // the new row's id up front (rather than letting the DB default it) lets
  // the supersede step point at it without a placeholder value or a second
  // back-fill write, and keeps this race-free across concurrent action keys.
  const newId = crypto.randomUUID();

  let supersedeQuery = supabase
    .from("learned_policies")
    .update({ superseded_at: new Date().toISOString(), superseded_by: newId })
    .eq("action_key", input.actionKey)
    .is("superseded_at", null);

  supersedeQuery =
    input.scopeEntityType && input.scopeEntityId
      ? supersedeQuery
          .eq("scope_entity_type", input.scopeEntityType)
          .eq("scope_entity_id", input.scopeEntityId)
      : supersedeQuery.is("scope_entity_type", null).is("scope_entity_id", null);

  const { error: supersedeError } = await supersedeQuery;
  if (supersedeError) {
    throw new Error(`Failed to supersede prior learned policy: ${supersedeError.message}`);
  }

  const { data, error } = await supabase
    .from("learned_policies")
    .insert({
      id: newId,
      action_key: input.actionKey,
      rule: input.rule,
      rationale: input.rationale,
      source: input.source,
      coworker_id: input.coworkerId ?? null,
      scope_entity_type: input.scopeEntityType ?? null,
      scope_entity_id: input.scopeEntityId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record learned policy: ${error.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "learned_policy.recorded",
    entityType: "learned_policy",
    entityId: data.id,
    source: input.source === "human_decision" ? "admin" : "automation",
    after: { actionKey: input.actionKey, rule: input.rule, source: input.source },
  });

  return data as LearnedPolicyEntry;
}

/**
 * List active learned policies, optionally filtered by action key or scope.
 * Only returns non-superseded policies.
 */
export async function listLearnedPolicies(
  supabase: SupabaseClient,
  input?: {
    actionKey?: string;
    coworkerId?: string;
    scopeEntityType?: string;
    scopeEntityId?: string;
  },
): Promise<LearnedPolicyEntry[]> {
  let query = supabase
    .from("learned_policies")
    .select()
    .is("superseded_at", null)
    .order("created_at", { ascending: false });

  if (input?.actionKey) query = query.eq("action_key", input.actionKey);
  if (input?.coworkerId) query = query.eq("coworker_id", input.coworkerId);
  if (input?.scopeEntityType) query = query.eq("scope_entity_type", input.scopeEntityType);
  if (input?.scopeEntityId) query = query.eq("scope_entity_id", input.scopeEntityId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list learned policies: ${error.message}`);
  return (data ?? []) as LearnedPolicyEntry[];
}

/**
 * Look up learned policies that constrain a given action. Returns both
 * global policies (no scope) and entity-scoped policies for the given entity.
 */
export async function getPoliciesForAction(
  supabase: SupabaseClient,
  input: {
    actionKey: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<LearnedPolicyEntry[]> {
  // Global policies for this action.
  const { data: globalPolicies } = await supabase
    .from("learned_policies")
    .select()
    .eq("action_key", input.actionKey)
    .is("scope_entity_type", null)
    .is("superseded_at", null);

  // Entity-scoped policies (if entity provided).
  let scopedPolicies: LearnedPolicyEntry[] = [];
  if (input.entityType && input.entityId) {
    const { data } = await supabase
      .from("learned_policies")
      .select()
      .eq("action_key", input.actionKey)
      .eq("scope_entity_type", input.entityType)
      .eq("scope_entity_id", input.entityId)
      .is("superseded_at", null);
    scopedPolicies = (data ?? []) as LearnedPolicyEntry[];
  }

  return [...(globalPolicies ?? []), ...scopedPolicies] as LearnedPolicyEntry[];
}

// ---------------------------------------------------------------------------
// Unified memory query: route across all five categories
// ---------------------------------------------------------------------------

export interface MemoryQueryResult {
  category: MemoryCategory;
  items: unknown[];
  truncated: boolean;
}

export interface MemoryQueryInput {
  /** Which categories to query. Defaults to all. */
  categories?: MemoryCategory[];
  /** Entity to scope the query (used by canonical, activity, agent, knowledge). */
  entityType?: string;
  entityId?: string;
  /** Free-text query (used by knowledge). */
  query?: string;
  /** Coworker to scope agent memory. */
  coworkerId?: string;
  /** Action key to scope learned policy. */
  actionKey?: string;
  /** Max items per category. */
  limit?: number;
}

/**
 * Query across memory categories without collapsing them.
 * Each category retains its own shape; the caller handles them accordingly.
 */
export async function queryMemory(
  supabase: SupabaseClient,
  input: MemoryQueryInput,
): Promise<MemoryQueryResult[]> {
  const categories = input.categories ?? [...MEMORY_CATEGORIES];
  const limit = input.limit ?? 10;
  const results: MemoryQueryResult[] = [];

  for (const category of categories) {
    switch (category) {
      case "canonical": {
        if (!input.entityType || !input.entityId) {
          results.push({ category, items: [], truncated: false });
          break;
        }
        // Canonical memory lives in CRM tables. For the unified query, we
        // return claims as a proxy for what the system believes about the entity.
        const claims = await listClaimsForEntity(supabase, {
          entityType: input.entityType,
          entityId: input.entityId,
        });
        results.push({
          category,
          items: claims.slice(0, limit),
          truncated: claims.length > limit,
        });
        break;
      }

      case "activity": {
        if (!input.entityType || !input.entityId) {
          results.push({ category, items: [], truncated: false });
          break;
        }
        const activities = await loadActivityTimeline(supabase, {
          [`${input.entityType}Id`]: input.entityId,
          limit,
        });
        results.push({
          category,
          items: activities,
          truncated: activities.length === limit,
        });
        break;
      }

      case "knowledge": {
        if (!input.query && !input.entityType) {
          results.push({ category, items: [], truncated: false });
          break;
        }
        const knowledge: KnowledgeSearchResult = await retrieveKnowledge(supabase, {
          topic: input.query,
          entityName: input.entityType,
          limit,
        });
        results.push({
          category,
          items: knowledge.chunks.slice(0, limit),
          truncated: knowledge.chunks.length > limit,
        });
        break;
      }

      case "agent": {
        const agentMem = await retrieveAgentMemory(supabase, {
          coworkerId: input.coworkerId,
          entityType: input.entityType ?? undefined,
          entityId: input.entityId ?? undefined,
          limit,
        });
        results.push({
          category,
          items: agentMem,
          truncated: agentMem.length === limit,
        });
        break;
      }

      case "learned_policy": {
        if (!input.actionKey) {
          // Return all active policies when no action key specified.
          const policies = await listLearnedPolicies(supabase);
          results.push({
            category,
            items: policies.slice(0, limit),
            truncated: policies.length > limit,
          });
        } else {
          const policies = await getPoliciesForAction(supabase, {
            actionKey: input.actionKey,
            entityType: input.entityType,
            entityId: input.entityId,
          });
          results.push({
            category,
            items: policies.slice(0, limit),
            truncated: policies.length > limit,
          });
        }
        break;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeExpiry(horizon: AgentMemoryEntry["relevance_horizon"]): string | null {
  const now = Date.now();
  switch (horizon) {
    case "session":
      return new Date(now + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
    case "daily":
      return new Date(now + 26 * 60 * 60 * 1000).toISOString(); // ~1 day (slightly over to survive cron)
    case "weekly":
      return new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString(); // ~1 week
    case "permanent":
      return null; // Never expires
  }
}
