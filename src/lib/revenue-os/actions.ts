import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordStaleClaimRecovery, STALE_CLAIM_WINDOW_MS } from "./runs";
import { recordLearnedPolicy } from "./memory";
import { storeAgentMemory } from "./memory";

const proposalWorkContext = new AsyncLocalStorage<string>();
export function withProposalWorkContext<T>(
  workItemId: string | undefined,
  work: () => Promise<T>,
): Promise<T> {
  return workItemId ? proposalWorkContext.run(workItemId, work) : work();
}

export const ACTION_URGENCY_ORDER = ["critical", "high", "normal", "low"] as const;
export type ActionUrgency = (typeof ACTION_URGENCY_ORDER)[number];

/**
 * Retire proposals that are past their expiry.
 *
 * `expired` was a valid status from the start and nothing ever wrote it, so a
 * proposal past `expires_at` sat `pending` forever. That is not cosmetic: the
 * dedupe unique index is scoped to `status = 'pending'`, so a dead proposal
 * held its dedupe key permanently. The next time the agent proposed the same
 * follow-up it hit a 23505, fell back to returning the existing pending row,
 * and reported success — handing back a proposal the approval path refuses as
 * expired and the operator queue hides. The action could then never be staged
 * again for that key. Silent, permanent, and exactly the class of failure that
 * loses a lead.
 *
 * Vercel Hobby has two cron slots and both are spoken for, so this runs inline
 * on the paths that care, in the same spirit as the stale job-claim recovery.
 * Best-effort: expiring old rows must never be the reason a new proposal fails.
 */
export async function sweepExpiredActions(supabase: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("action_queue")
    .update({ status: "expired", updated_at: now })
    .eq("status", "pending")
    .not("expires_at", "is", null)
    .lt("expires_at", now)
    .select("id");

  if (error) {
    console.error("[actions] expiry sweep failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function proposeAction(
  supabase: SupabaseClient,
  input: {
    actionType: string;
    title: string;
    description?: string;
    urgency?: ActionUrgency;
    payload: Record<string, unknown>;
    reasoning?: string;
    sourceContext: string;
    entityType?: string;
    entityId?: string;
    dedupeKey?: string;
    proposedBy?: string;
    expiresAt?: string;
    /** Structured evidence for the write-provenance validator (quotes,
     * receipts, resolved entities). Stored verbatim; validated downstream. */
    evidence?: Record<string, unknown>;
  },
) {
  // Learned observations remain reviewable context. Authority is evaluated
  // from structured autonomy policies at execution, never from prose keywords.
  const row = {
    ...(proposalWorkContext.getStore() ? { work_item_id: proposalWorkContext.getStore() } : {}),
    action_type: input.actionType,
    title: input.title,
    description: input.description ?? null,
    urgency: input.urgency ?? "normal",
    payload: input.payload,
    reasoning: input.reasoning ?? null,
    source_context: input.sourceContext,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    proposed_by: input.proposedBy ?? null,
    expires_at: input.expiresAt ?? null,
    evidence: input.evidence ?? {},
  };
  // The evidence column arrives with the reversibility migration; on trees
  // where it has not applied yet, retry once without it rather than failing
  // the proposal. Only the missing-column code takes this path.
  let insertResult = await supabase.from("action_queue").insert(row).select("*").single();
  if (insertResult.error && (insertResult.error as { code?: string }).code === "42703") {
    const rowWithoutEvidence: Record<string, unknown> = { ...row };
    delete rowWithoutEvidence.evidence;
    insertResult = await supabase
      .from("action_queue")
      .insert(rowWithoutEvidence)
      .select("*")
      .single();
  }
  const { data, error } = insertResult;
  if (error) {
    if (error.code === "23505" && input.dedupeKey) {
      // The colliding row may be an expired proposal squatting on the key. Retire
      // it and retry once, so a stale proposal cannot permanently block a live
      // one. Only then treat a surviving row as a genuine duplicate.
      if (await sweepExpiredActions(supabase)) {
        const retried = await supabase.from("action_queue").insert(row).select("*").single();
        if (!retried.error && retried.data) return retried.data;
      }
      const { data: existing } = await supabase
        .from("action_queue")
        .select("*")
        .eq("dedupe_key", input.dedupeKey)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) return existing;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function recoverStaleExecutingActions(supabase: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_CLAIM_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("action_queue")
    .update({
      status: "failed",
      error:
        "Action abandoned before reporting a terminal state and was recovered by a later claim",
      updated_at: now,
    })
    .eq("status", "executing")
    .lt("updated_at", staleBefore)
    .select("id,action_type");
  if (error) {
    console.error("[actions] stale executing recovery failed:", error.message);
    return 0;
  }
  for (const row of data ?? []) {
    await recordStaleClaimRecovery(supabase, {
      entityType: "action_queue",
      entityId: String(row.id),
      detail: `Action ${row.action_type} stayed executing past the stale window and was closed as failed so it cannot block the queue forever.`,
    });
  }
  return data?.length ?? 0;
}

export async function claimApprovedAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
  mode: "approved" | "autonomous" = "approved",
) {
  await recoverStaleExecutingActions(supabase);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("action_queue")
    .update({
      status: "executing",
      ...(mode === "approved" ? { approved_by: actorEmail, approved_at: now } : {}),
    })
    .eq("id", id)
    .eq("status", "pending")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This action was already handled or has expired");
  await recordAudit(supabase, {
    actorEmail,
    action: mode === "approved" ? "action.approved" : "action.claimed",
    entityType: "action_queue",
    entityId: id,
    after: { action_type: data.action_type, status: "executing" },
  });

  if (mode === "autonomous") return data;

  // Approval trust signal: record as agent memory so the autonomy policy
  // trust ladder and future AI context can see that this action type was
  // approved. For coworker-originated actions, store under the coworker's
  // memory so its learned context grows.
  const coworkerId = data.proposed_by?.startsWith("coworker:")
    ? data.proposed_by.replace("coworker:", "")
    : null;
  await storeAgentMemory(supabase, {
    coworkerId: coworkerId ?? undefined,
    category: "prior_work",
    subject: `approved: ${data.action_type}${data.entity_type ? ` for ${data.entity_type}` : ""}`,
    body: `Human approved ${data.action_type} action${data.entity_type && data.entity_id ? ` on ${data.entity_type}/${data.entity_id}` : ""}. This counts as a positive trust signal for the action type.`,
    entityType: data.entity_type ?? undefined,
    entityId: data.entity_id ?? undefined,
    relevanceHorizon: "weekly",
    actorEmail,
  }).catch(() => {});

  return data;
}

export async function finishAction(supabase: SupabaseClient, id: string, result: unknown) {
  const { data, error } = await supabase
    .from("action_queue")
    .update({ status: "executed", executed_at: new Date().toISOString(), result, error: null })
    .eq("id", id)
    .eq("status", "executing")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Action execution receipt was superseded");
}

export async function failAction(supabase: SupabaseClient, id: string, errorMessage: string) {
  const { data, error } = await supabase
    .from("action_queue")
    .update({ status: "failed", error: errorMessage })
    .eq("id", id)
    .eq("status", "executing")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Action failure receipt was superseded");
}

export async function rejectAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
  reason?: string,
) {
  // Fetch the action details first to support learned policy creation.
  const { data: pending } = await supabase
    .from("action_queue")
    .select("id, action_type, entity_type, entity_id, proposed_by, source_context")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();

  const { data, error } = await supabase
    .from("action_queue")
    .update({
      status: "rejected",
      approved_by: actorEmail,
      approved_at: new Date().toISOString(),
      result: reason ? { reason } : {},
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This action was already handled");
  await recordAudit(supabase, {
    actorEmail,
    action: "action.rejected",
    entityType: "action_queue",
    entityId: id,
    metadata: { reason },
  });

  // Rejection feedback loop: create a learned policy from the human decision.
  // This is how the system learns "don't do X" from real operational experience.
  // Future AI runs can surface these observations for review. Only structured
  // autonomy policies govern execution; this prose cannot change authority.
  if (pending) {
    const actionKey = pending.action_type;
    const coworkerId = pending.proposed_by?.startsWith("coworker:")
      ? pending.proposed_by.replace("coworker:", "")
      : null;
    const rule = reason
      ? `Human rejected ${actionKey}: "${reason}"`
      : `Human rejected ${actionKey} without providing a reason`;
    await recordLearnedPolicy(supabase, {
      actionKey,
      rule,
      rationale:
        reason ||
        "Rejection without explicit reason — pattern may indicate incorrect action target, timing, or content",
      source: "human_decision",
      coworkerId,
      scopeEntityType: pending.entity_type,
      scopeEntityId: pending.entity_id,
      actorEmail,
    }).catch(() => {});
  }
}
