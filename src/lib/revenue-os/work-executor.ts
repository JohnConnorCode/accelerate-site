import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withWorkItem, recoverStaleWorkItemClaims, type WorkItem } from "./work-items";
import { deferWork, workResultText, type WorkResult } from "./work-result";
import { getCoworkerManifest } from "./coworkers";
import { storeAgentMemory } from "./memory";
import { checkBudgets } from "./budgets";
import { recordAudit } from "./audit";
import { safeErrorMessage } from "./db";
import { checkAutonomy } from "./autonomy-policy";

export interface WorkExecutionSummary {
  claimed: number;
  executed: number;
  completed: number;
  failed: number;
  skipped: number;
  deferred: number;
  awaitingApproval: number;
  partial: number;
  staleRecovered: number;
  errors: string[];
}

export type WorkKindHandler = (supabase: SupabaseClient, workItem: WorkItem) => Promise<WorkResult>;
const WORK_KIND_HANDLERS = new Map<string, WorkKindHandler>();
export function registerWorkKindHandler(kind: string, handler: WorkKindHandler): void {
  WORK_KIND_HANDLERS.set(kind, handler);
}
export function getWorkKindHandler(kind: string): WorkKindHandler | undefined {
  return WORK_KIND_HANDLERS.get(kind);
}

/** Job execution is successful only when no unfinished or unrecorded work remains. */
export function workExecutionStatus(
  summary: WorkExecutionSummary,
): "success" | "partial" | "skipped" | "failed" {
  if (summary.errors.length || summary.failed || summary.partial) {
    return summary.completed || summary.deferred || summary.awaitingApproval || summary.partial
      ? "partial"
      : "failed";
  }
  if (summary.deferred || summary.awaitingApproval) return "partial";
  return summary.completed ? "success" : "skipped";
}

export const workExecutionJobStatus = workExecutionStatus;

export async function executeClaimableWork(
  supabase: SupabaseClient,
  input?: { maxItems?: number; kinds?: string[] },
): Promise<WorkExecutionSummary> {
  const maxItems = input?.maxItems ?? 10;
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100)
    throw new Error("maxItems must be between 1 and 100");
  const summary: WorkExecutionSummary = {
    claimed: 0,
    executed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    awaitingApproval: 0,
    partial: 0,
    staleRecovered: 0,
    errors: [],
  };
  summary.staleRecovered = await recoverStaleWorkItemClaims(supabase);
  for (const kind of input?.kinds ?? Array.from(WORK_KIND_HANDLERS.keys())) {
    if (summary.claimed >= (input?.maxItems ?? 10)) break;
    const handler = WORK_KIND_HANDLERS.get(kind);
    if (!handler) {
      summary.errors.push(`No handler registered for kind: ${kind}`);
      continue;
    }
    let executedItem: WorkItem | undefined;
    const result = await withWorkItem(supabase, kind, async (item) => {
      // Draft preparation completes on a saved proposal; action execution work waits for execution receipts.
      if (kind !== "draft_followup") {
        // The action stores its work link in the original insert. This survives
        // interruption between proposal creation and updating the work/run trace.
        const { data: linkedActions, error: linkedError } = await supabase
          .from("action_queue")
          .select("id,status")
          .eq("work_item_id", item.id);
        if (linkedError) throw new Error(`Work approval lookup failed: ${linkedError.message}`);
        if (linkedActions?.length) item.action_ids = linkedActions.map((action) => action.id);
        if (item.action_ids?.length) {
          const { data: actions, error } = await supabase
            .from("action_queue")
            .select("id,status")
            .in("id", item.action_ids);
          if (error || actions?.length !== new Set(item.action_ids).size)
            throw new Error("Work approval receipts are unavailable");
          if (actions.some((action) => ["failed", "rejected", "expired"].includes(action.status)))
            return {
              status: "failed" as const,
              value: null,
              outcome:
                "A required action was rejected, expired, or failed; operator review is required",
            };
          if (actions.every((action) => action.status === "executed"))
            return {
              status: "completed" as const,
              value: null,
              outcome: "All linked action receipts confirm execution",
            };
          return {
            ...deferWork("Waiting for linked action approval or execution"),
            status: "awaiting_approval" as const,
          };
        }
      }
      // Gate failures throw into the bounded retry path; absent prerequisites defer.
      if (item.coworker_id) {
        const manifest = await getCoworkerManifest(supabase, item.coworker_id);
        if (!manifest.readyToWork)
          return deferWork(`Coworker not ready: ${manifest.capabilityGaps.join(", ")}`);
      }
      // Work orchestration is not permission to execute business actions. An
      // explicit work policy can stop it; every consequential action is gated
      // independently in the canonical action executor.
      const policy = await checkAutonomy(supabase, `work:${kind}`, item.coworker_id);
      if (policy.hardFloor || policy.level === "prohibited") return deferWork(policy.reason);
      if (policy.policyId && policy.requiresApproval)
        return deferWork(`Work requires policy review: ${policy.reason}`);
      const budgetResults = await checkBudgets(supabase, {
        coworkerId: item.coworker_id ?? "*",
        workItemId: item.id,
      });
      const exhausted = budgetResults.find((b) => !b.allowed);
      if (exhausted)
        return deferWork(exhausted.reason ?? `Budget exhausted: ${exhausted.budgetKind}`);

      executedItem = item;
      summary.executed++;
      const outcome = await handler(supabase, item);
      return outcome;
    });
    if (!result.claimed) continue;
    summary.claimed++;
    summary.errors.push(...result.errors.map((error) => `${kind}:${error}`));
    if (result.persisted && result.value && executedItem) {
      const item = executedItem;
      const outcome = result.value;
      // Keep the disposition in memory; partial output must not masquerade as success.
      try {
        await storeAgentMemory(supabase, {
          coworkerId: item.coworker_id ?? undefined,
          category: "prior_work",
          subject: `${kind}: ${outcome.status}: ${item.objective.slice(0, 80)}`,
          body: `${outcome.status}: ${workResultText(outcome)}`,
          entityType: item.entity_type ?? undefined,
          entityId: item.entity_id ?? undefined,
          relevanceHorizon: "daily",
        });
      } catch (error) {
        const message = safeErrorMessage(error);
        console.error("[work-executor] memory receipt failed:", message);
        summary.errors.push(`${kind}:store-agent-memory-failed:${message}`);
      }
    }
    if (result.persisted && result.value) {
      if (result.value.status === "awaiting_approval") summary.awaitingApproval++;
      else summary[result.value.status]++;
    } else summary.failed++;
  }
  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_engine.execution_cycle",
    entityType: "work_engine",
    entityId: "cycle",
    source: "automation",
    after: summary,
  });
  return summary;
}
