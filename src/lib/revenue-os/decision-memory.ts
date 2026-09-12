import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Decision Memory: record why the business decided, supersede cleanly, and
// surface implications. Decisions are human-authored and human-approved;
// implications are offered, never applied automatically. Superseded
// decisions stay readable as history with forward links.
// ---------------------------------------------------------------------------

export interface DecisionEntry {
  id: string;
  tenant_id: string;
  title: string;
  decision: string;
  why: string;
  owner_email: string | null;
  decided_at: string;
  evidence: Record<string, unknown> | null;
  supersedes_id: string | null;
  superseded_by: string | null;
  superseded_at: string | null;
  implications: Record<string, unknown> | null;
  dedupe_key: string;
  created_at: string;
}

export interface DecisionConflict {
  kind: "policy" | "learning";
  id: string;
  rule: string;
  overlapTerms: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STOPWORDS = new Set(
  "a,an,the,and,or,but,of,to,in,on,for,with,by,from,as,at,is,are,was,were,be,been,it,its,this,that,these,those,we,you,they,our,your,their,will,shall,should,must,can,not,no,never,always,when,what,which,who,how,all,any,each,more,most,other,than,then,there,here,into,out,up,down,over,under,again,once,just,don,does".split(
    ",",
  ),
);

function significantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/** Deterministic idempotency key: same normalized title + decision collapses. */
export function decisionDedupeKey(input: { title: string; decision: string }): string {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256")
    .update(`${norm(input.title)}|${norm(input.decision)}`)
    .digest("hex");
}

function toDecision(row: unknown): DecisionEntry {
  return row as unknown as DecisionEntry;
}

/**
 * Record a decision. Replay-safe: an identical decision returns the existing
 * row. A supersedes target must exist and be active; it is forward-linked.
 */
export async function recordDecision(
  supabase: SupabaseClient,
  input: {
    title: string;
    decision: string;
    why?: string;
    ownerEmail?: string | null;
    decidedAt?: string | null;
    evidence?: Record<string, unknown> | null;
    supersedesId?: string | null;
    implications?: Record<string, unknown> | null;
    actorEmail?: string | null;
  },
): Promise<DecisionEntry> {
  if (!input.title.trim()) throw new Error("Decision title must not be empty");
  if (!input.decision.trim()) throw new Error("Decision text must not be empty");
  if (input.supersedesId && !UUID_PATTERN.test(input.supersedesId))
    throw new Error("supersedesId must be a valid UUID");

  const dedupeKey = decisionDedupeKey({ title: input.title, decision: input.decision });
  const { data: existing, error: readError } = await supabase
    .from("decisions")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (readError) throw new Error(`Failed to check duplicate decision: ${readError.message}`);
  if (existing) return toDecision(existing);

  if (input.supersedesId) {
    const { data: target, error: targetError } = await supabase
      .from("decisions")
      .select("id,superseded_at")
      .eq("id", input.supersedesId)
      .maybeSingle();
    if (targetError) throw new Error(`Failed to read superseded decision: ${targetError.message}`);
    if (!target) throw new Error("Superseded decision not found");
    if ((target as { superseded_at: string | null }).superseded_at)
      throw new Error("Superseded decision is already superseded");
  }

  const newId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      id: newId,
      title: input.title.trim(),
      decision: input.decision.trim(),
      why: input.why ?? "",
      owner_email: input.ownerEmail ?? null,
      decided_at: input.decidedAt ?? new Date().toISOString(),
      evidence: input.evidence ?? null,
      supersedes_id: input.supersedesId ?? null,
      implications: input.implications ?? null,
      dedupe_key: dedupeKey,
    })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const winner = await supabase
        .from("decisions")
        .select("*")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (!winner.error && winner.data) return toDecision(winner.data);
    }
    throw new Error(`Failed to record decision: ${error.message}`);
  }

  if (input.supersedesId) {
    await supabase
      .from("decisions")
      .update({ superseded_at: new Date().toISOString(), superseded_by: newId })
      .eq("id", input.supersedesId)
      .is("superseded_at", null);
  }

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "decision.recorded",
    entityType: "decision",
    entityId: newId,
    after: { title: input.title, supersedes: input.supersedesId ?? null },
  });

  return toDecision(data);
}

/** Active decisions, newest first. History stays queryable with includeHistory. */
export async function listDecisions(
  supabase: SupabaseClient,
  input?: { includeHistory?: boolean; limit?: number },
): Promise<DecisionEntry[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  let query = supabase
    .from("decisions")
    .select("*")
    .order("decided_at", { ascending: false })
    .limit(limit);
  if (!input?.includeHistory) query = query.is("superseded_at", null);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list decisions: ${error.message}`);
  return ((data ?? []) as unknown[]).map(toDecision);
}

/**
 * Surface conflicts between a decision draft and active learned policies:
 * shared significant terms (2+) flag a candidate for human review. Pure and
 * deterministic; surfacing is not resolution.
 */
export function flagDecisionConflicts(
  draft: { title: string; decision: string },
  policies: Array<{ id: string; rule: string }>,
): DecisionConflict[] {
  const draftTerms = significantTerms(`${draft.title} ${draft.decision}`);
  const conflicts: DecisionConflict[] = [];
  for (const p of policies) {
    const overlap = [...significantTerms(p.rule)].filter((t) => draftTerms.has(t));
    if (overlap.length >= 2) {
      conflicts.push({ kind: "policy", id: p.id, rule: p.rule, overlapTerms: overlap.sort() });
    }
  }
  return conflicts;
}
