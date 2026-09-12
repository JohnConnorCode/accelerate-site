import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reversibility axis for the unified action executor (Plugin Platform
 * phase 1, primitive 3: Actions).
 *
 * Impact says how far an effect reaches; reversibility says whether core can
 * restore the prior state. They are separate declared axes — a merged field
 * would be wrong for one of them — so every entry below carries both, and
 * the gate test pins that they never collapse:
 * - reversible: core restores prior state automatically via a tested
 *   compensator below. An action counts as reversible only with a working
 *   compensator, never by declaration alone.
 * - compensable: a compensating action exists (reverse transition, manual
 *   removal, layout revert through history) but needs its own run.
 * - irreversible: the effect leaves the system (an email is delivered, money
 *   or a campaign moves). Permanently non-autonomous: the trust ladder has
 *   nothing to special-case because the executor refuses autonomous runs.
 */

export { ACTION_REVERSIBILITY, reversibilityOf } from "./action-reversibility-contract";
export type { ReversibilityClass, ActionImpact } from "./action-reversibility-contract";
import { reversibilityOf } from "./action-reversibility-contract";

type Row = Record<string, unknown>;

/**
 * Undo an executed action through its registered compensator. Only executed
 * rows qualify; anything else is a refusal, not a guess. Returns a truthful
 * receipt of what was restored.
 */
export async function compensateAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
): Promise<{ undone: string; detail: Row }> {
  const { data: action, error } = await supabase
    .from("action_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!action) throw new Error("Action not found");
  if (action.status !== "executed")
    throw new Error(`Only executed actions can be compensated (status is ${action.status})`);
  const entry = reversibilityOf(String(action.action_type));
  if (entry.reversibility !== "reversible")
    throw new Error(
      `${action.action_type} is ${entry.reversibility}: ${entry.rationale} Compensate it explicitly instead.`,
    );
  const { data, error: undoError } = await supabase.rpc("apply_local_action", {
    p_id: id,
    p_payload: action.payload,
    p_actor: actorEmail,
    p_undo: true,
  });
  if (undoError) throw new Error(undoError.message);
  return data as { undone: string; detail: Row };
}
