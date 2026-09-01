import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordStaleClaimRecovery, STALE_CLAIM_WINDOW_MS } from "./runs";

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
  },
) {
  const row = {
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
  };
  const { data, error } = await supabase.from("action_queue").insert(row).select("*").single();
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
) {
  await recoverStaleExecutingActions(supabase);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("action_queue")
    .update({
      status: "executing",
      approved_by: actorEmail,
      approved_at: now,
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
    action: "action.approved",
    entityType: "action_queue",
    entityId: id,
    after: { action_type: data.action_type, status: "executing" },
  });
  return data;
}

export async function finishAction(supabase: SupabaseClient, id: string, result: unknown) {
  const { error } = await supabase
    .from("action_queue")
    .update({
      status: "executed",
      executed_at: new Date().toISOString(),
      result,
      error: null,
    })
    .eq("id", id)
    .eq("status", "executing");
  if (error) throw new Error(error.message);
}

export async function failAction(supabase: SupabaseClient, id: string, errorMessage: string) {
  await supabase
    .from("action_queue")
    .update({ status: "failed", error: errorMessage })
    .eq("id", id)
    .eq("status", "executing");
}

export async function rejectAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
  reason?: string,
) {
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
}
