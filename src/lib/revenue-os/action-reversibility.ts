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

export type ReversibilityClass = "reversible" | "compensable" | "irreversible";
export type ActionImpact = "read" | "internal_write" | "external_action";

interface ActionReversibility {
  actionType: string;
  impact: ActionImpact;
  reversibility: ReversibilityClass;
  rationale: string;
}

export const ACTION_REVERSIBILITY: readonly ActionReversibility[] = [
  {
    actionType: "create_task_batch",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Assigned tasks remain individually editable; no automatic deletion of an approved delivery checklist is implied.",
  },
  ...["create_stripe_invoice_draft", "send_stripe_invoice", "publish_invoice_page"].map(
    (actionType) => ({
      actionType,
      impact: "external_action" as const,
      reversibility: "irreversible" as const,
      rationale:
        "Creates or sends an external billing document; no automatic compensator is registered, so explicit human approval is permanent.",
    }),
  ),
  ...["bootstrap_coworker", "store_agent_memory", "record_learned_policy"].map((actionType) => ({
    actionType,
    impact: "internal_write" as const,
    reversibility: "compensable" as const,
    rationale:
      "A reviewed configuration change or superseding memory entry compensates for this action; no automatic inverse is promised.",
  })),
  {
    actionType: "send_email",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Delivery leaves the system; no recall exists.",
  },
  {
    actionType: "send_gmail_reply",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Delivery leaves the system; no recall exists.",
  },
  {
    actionType: "transition_opportunity",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "A reverse transition restores the stage, but terminal-role rules may demand justification, so it runs as its own action rather than silently.",
  },
  {
    actionType: "create_task",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "The created row is removed; creation left no other trace.",
  },
  {
    actionType: "update_task",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "Prior field values are captured at execution and restored.",
  },
  {
    actionType: "update_next_action",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "Prior next_action values are captured at execution and restored.",
  },
  {
    actionType: "activate_campaign",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Activation starts real sends; traffic already emitted cannot be recalled.",
  },
  {
    actionType: "admin_layout_change",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "revertLayoutChange restores the prior doc from audit history.",
  },
  {
    actionType: "create_founder_note",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Notes have no delete primitive by design; removal is a deliberate manual act, not an automatic undo.",
  },
  {
    actionType: "identity_review",
    impact: "internal_write",
    reversibility: "irreversible",
    rationale:
      "The executor always refuses this type and points at the review workbench, so no effect ever exists to undo; autonomous runs refuse like all irreversible effects.",
  },
] as const;

export function reversibilityOf(actionType: string): ActionReversibility {
  const entry = ACTION_REVERSIBILITY.find((candidate) => candidate.actionType === actionType);
  if (!entry) throw new Error(`Action type ${actionType} declares no reversibility class`);
  return entry;
}

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
