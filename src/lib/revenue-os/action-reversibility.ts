import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { revertLayoutChange } from "./admin-layout";

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
  const compensation = (action.compensation ?? {}) as Row;
  // State fencing: an undo is itself a state transition. A row that already
  // carries a compensation receipt must refuse a second undo rather than
  // re-running its compensator against post-undo state.
  if (compensation.compensatedAt)
    throw new Error(`Action ${id} was already compensated at ${compensation.compensatedAt}`);
  const detail: Row = { action_type: action.action_type };

  switch (action.action_type) {
    case "create_task": {
      const taskId = compensation.createdTaskId;
      if (typeof taskId !== "string" || !taskId)
        throw new Error("Compensation data is missing the created task id; cannot undo safely");
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);
      if (deleteError) throw new Error(`Could not remove task ${taskId}: ${deleteError.message}`);
      detail.removed_task_id = taskId;
      break;
    }
    case "update_next_action": {
      const opportunityId = (action.payload as Row)?.opportunityId;
      const prior = compensation.prior as Row | undefined;
      if (typeof opportunityId !== "string" || !prior)
        throw new Error("Compensation data is missing the prior next action; cannot undo safely");
      const { error: restoreError } = await supabase
        .from("opportunities")
        .update({
          next_action: prior.next_action ?? null,
          next_action_at: prior.next_action_at ?? null,
        })
        .eq("id", opportunityId);
      if (restoreError) throw new Error(`Could not restore next action: ${restoreError.message}`);
      detail.restored = prior;
      break;
    }
    case "update_task": {
      const taskId = (action.payload as Row)?.taskId;
      const before = compensation.before as Row | undefined;
      if (typeof taskId !== "string" || !before)
        throw new Error("Compensation data is missing the prior task state; cannot undo safely");
      const { error: restoreError } = await supabase
        .from("tasks")
        .update({
          title: before.title,
          description: before.description ?? null,
          priority: before.priority,
          due_date: before.due_date ?? null,
          status: before.status,
          snoozed_until: before.snoozed_until ?? null,
          completed_at: before.completed_at ?? null,
        })
        .eq("id", taskId);
      if (restoreError) throw new Error(`Could not restore task: ${restoreError.message}`);
      detail.restored_task_id = taskId;
      break;
    }
    case "delete_task": {
      const deletedRow = compensation.deletedRow as Row | undefined;
      if (!deletedRow || typeof deletedRow.id !== "string")
        throw new Error("Compensation data is missing the deleted row; cannot undo safely");
      const { error: restoreError } = await supabase.from("tasks").insert(deletedRow);
      if (restoreError) throw new Error(`Could not restore task: ${restoreError.message}`);
      detail.restored_task_id = deletedRow.id;
      break;
    }
    case "admin_layout_change": {
      const scope = (action.payload as Row)?.scope;
      const tenantId = String((action as Row).tenant_id ?? "");
      if (typeof scope !== "string" || !scope)
        throw new Error("Compensation data is missing the layout scope; cannot undo safely");
      if (!tenantId) throw new Error("Compensation data is missing the tenant; cannot undo safely");
      await revertLayoutChange(supabase, { scope, actorEmail, tenantId });
      detail.reverted_scope = scope;
      break;
    }
    default:
      throw new Error(`${action.action_type} has no automatic compensator`);
  }

  await recordAudit(supabase, {
    actorEmail,
    action: "action.compensated",
    entityType: "action_queue",
    entityId: id,
    before: { action_type: action.action_type, status: action.status },
    after: { compensated: true },
    metadata: { detail },
  });
  // Fence the row against a second undo: the receipt above is the audit
  // trail, this stamp is the machine fence the next compensate checks.
  const { error: fenceError } = await supabase
    .from("action_queue")
    .update({
      compensation: {
        ...(action.compensation as Row | null),
        compensatedAt: new Date().toISOString(),
        compensatedBy: actorEmail,
      },
    })
    .eq("id", id);
  if (fenceError) throw new Error(`Compensation receipt was superseded: ${fenceError.message}`);
  await recordActivity(supabase, {
    activityType: "action_compensated",
    title: `Undid ${action.action_type}`,
    summary: `Operator reversed an executed ${action.action_type} action.`,
    actorEmail,
    source: "operator",
    externalId: `compensate:${id}:${Date.now()}`,
    occurredAt: new Date().toISOString(),
  });
  return { undone: String(action.action_type), detail };
}
