import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withWorkItem, recoverStaleWorkItemClaims, type WorkItem } from "./work-items";
import { deferWork, workResultText, type WorkResult } from "./work-result";
import { getCoworkerManifest } from "./coworkers";
import { getPoliciesForAction, storeAgentMemory } from "./memory";
import { checkBudgets, recordBudgetUsage } from "./budgets";
import { recordAudit } from "./audit";
import { safeErrorMessage } from "./db";

export interface WorkExecutionSummary {
  claimed: number;
  executed: number;
  completed: number;
  failed: number;
  skipped: number;
  deferred: number;
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
    return summary.completed || summary.deferred || summary.partial ? "partial" : "failed";
  }
  if (summary.deferred) return "partial";
  return summary.completed ? "success" : "skipped";
}

export async function executeClaimableWork(
  supabase: SupabaseClient,
  input?: { maxItems?: number; kinds?: string[] },
): Promise<WorkExecutionSummary> {
  const summary: WorkExecutionSummary = {
    claimed: 0,
    executed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
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
      // Gate failures throw into the bounded retry path; absent prerequisites defer.
      if (item.coworker_id) {
        const manifest = await getCoworkerManifest(supabase, item.coworker_id);
        if (!manifest.readyToWork)
          return deferWork(`Coworker not ready: ${manifest.capabilityGaps.join(", ")}`);
      }
      const policies = await getPoliciesForAction(supabase, { actionKey: `work:${kind}` });
      const blocking = policies.find((p) =>
        /never|must not|do not|prohibited|always ask/i.test(p.rule),
      );
      if (blocking)
        return deferWork(`Blocked by learned policy: "${blocking.rule}" (${blocking.action_key})`);
      if (item.coworker_id) {
        const budgets = await checkBudgets(supabase, { coworkerId: item.coworker_id });
        const exhausted = budgets.find((b) => !b.allowed);
        if (exhausted) {
          const nextDay = new Date();
          nextDay.setUTCHours(24, 0, 0, 0);
          return deferWork(
            exhausted.reason ?? `Budget exhausted: ${exhausted.budgetKind}`,
            nextDay.toISOString(),
          );
        }
      }
      executedItem = item;
      summary.executed++;
      const outcome = await handler(supabase, item);
      if (outcome.status !== "deferred") {
        try {
          await recordBudgetUsage(supabase, {
            coworkerId: item.coworker_id,
            budgetKind: "vendor_api_calls",
            value: 1,
          });
        } catch (error) {
          const message = safeErrorMessage(error);
          console.error("[work-executor] budget receipt failed:", message);
          summary.errors.push(`${kind}:record-budget-usage-failed:${message}`);
        }
      }
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
    if (result.persisted && result.value) summary[result.value.status]++;
    else summary.failed++;
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
