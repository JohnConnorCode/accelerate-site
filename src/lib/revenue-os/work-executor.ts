import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withWorkItem, type WorkItem } from "./work-items";
import { recoverStaleWorkItemClaims } from "./work-items";
import { getCoworkerManifest } from "./coworkers";
import { getPoliciesForAction, storeAgentMemory } from "./memory";
import { checkBudgets, recordBudgetUsage } from "./budgets";
import { recordAudit } from "./audit";
import { safeErrorMessage } from "./db";

// ---------------------------------------------------------------------------
// Work executor: claims and executes claimable work items.
//
// This is the scheduler that closes the loop from "work created" to
// "work executed by a Coworker". It:
//   1. Recovers any stale claims
//   2. Iterates over claimable work items
//   3. For each item, checks coworker readiness and autonomy
//   4. Executes the work via the registered handler for that kind
//   5. Records the outcome
// ---------------------------------------------------------------------------

export interface WorkExecutionSummary {
  claimed: number;
  executed: number;
  completed: number;
  failed: number;
  skipped: number;
  staleRecovered: number;
  errors: string[];
}

export type WorkKindHandler = (
  supabase: SupabaseClient,
  workItem: WorkItem,
) => Promise<{ outcome: string }>;

// Registry of work kind handlers. In production this would be loaded from
// coworker manifests, but for the reference implementation we wire them here.
const WORK_KIND_HANDLERS = new Map<string, WorkKindHandler>();

export function registerWorkKindHandler(kind: string, handler: WorkKindHandler): void {
  WORK_KIND_HANDLERS.set(kind, handler);
}

export function getWorkKindHandler(kind: string): WorkKindHandler | undefined {
  return WORK_KIND_HANDLERS.get(kind);
}

// ---------------------------------------------------------------------------
// Execute claimable work: the main loop
// ---------------------------------------------------------------------------

export async function executeClaimableWork(
  supabase: SupabaseClient,
  input?: {
    maxItems?: number;
    kinds?: string[];
  },
): Promise<WorkExecutionSummary> {
  const maxItems = input?.maxItems ?? 10;
  const summary: WorkExecutionSummary = {
    claimed: 0,
    executed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    staleRecovered: 0,
    errors: [],
  };

  // Step 1: Recover stale claims.
  summary.staleRecovered = await recoverStaleWorkItemClaims(supabase);

  // Step 2: For each requested kind, try to claim and execute.
  const kinds = input?.kinds ?? Array.from(WORK_KIND_HANDLERS.keys());
  for (const kind of kinds) {
    if (summary.claimed >= maxItems) break;

    const handler = WORK_KIND_HANDLERS.get(kind);
    if (!handler) {
      summary.skipped++;
      summary.errors.push(`No handler registered for kind: ${kind}`);
      continue;
    }

    const result = await withWorkItem(supabase, kind, async (workItem) => {
      summary.claimed++;
      summary.executed++;

      // Check coworker readiness (if the item has a coworker_id).
      if (workItem.coworker_id) {
        try {
          const manifest = await getCoworkerManifest(supabase, workItem.coworker_id);
          if (!manifest.readyToWork) {
            return {
              value: null as unknown as Record<string, unknown>,
              outcome: `Skipped: coworker not ready (gaps: ${manifest.capabilityGaps.join(", ")})`,
            };
          }
        } catch (err) {
          return {
            value: null as unknown as Record<string, unknown>,
            outcome: `Skipped: coworker manifest check failed (${safeErrorMessage(err)})`,
          };
        }
      }

      // Check learned policies that may constrain this work kind. A gate
      // that cannot be evaluated must not silently pass — fail closed and
      // skip the item rather than proceed as if no policy applied (northstar
      // principle 6: deterministic logic stays deterministic, it does not
      // degrade into "assume allowed" on error).
      const actionKey = `work:${kind}`;
      let policies: Awaited<ReturnType<typeof getPoliciesForAction>>;
      try {
        policies = await getPoliciesForAction(supabase, { actionKey });
      } catch (err) {
        const message = safeErrorMessage(err);
        console.error(`[work-executor] learned-policy check failed for ${kind}: ${message}`);
        summary.skipped++;
        summary.errors.push(`${kind}:learned-policy-check-failed:${message}`);
        return {
          value: null as unknown as Record<string, unknown>,
          outcome: `Skipped: could not evaluate learned-policy gate (fail-closed): ${message}`,
        };
      }
      if (policies.length > 0) {
        const blocking = policies.find((p) =>
          /never|must not|do not|prohibited|always ask/i.test(p.rule),
        );
        if (blocking) {
          summary.skipped++;
          return {
            value: null as unknown as Record<string, unknown>,
            outcome: `Blocked by learned policy: "${blocking.rule}" (${blocking.action_key})`,
          };
        }
      }

      // Check budgets before execution (northstar §24). Same fail-closed
      // rule: an unevaluable budget check skips the item rather than letting
      // it run with an unknown/possibly-exhausted budget.
      if (workItem.coworker_id) {
        let budgetResults: Awaited<ReturnType<typeof checkBudgets>>;
        try {
          budgetResults = await checkBudgets(supabase, { coworkerId: workItem.coworker_id });
        } catch (err) {
          const message = safeErrorMessage(err);
          console.error(`[work-executor] budget check failed for ${kind}: ${message}`);
          summary.skipped++;
          summary.errors.push(`${kind}:budget-check-failed:${message}`);
          return {
            value: null as unknown as Record<string, unknown>,
            outcome: `Skipped: could not evaluate budget gate (fail-closed): ${message}`,
          };
        }
        const exhausted = budgetResults.find((b) => !b.allowed);
        if (exhausted) {
          summary.skipped++;
          return {
            value: null as unknown as Record<string, unknown>,
            outcome: exhausted.reason ?? `Budget exhausted: ${exhausted.budgetKind}`,
          };
        }
      }

      // Execute the registered handler.
      try {
        const handlerResult = await handler(supabase, workItem);
        summary.completed++;

        // Store agent memory so future turns can reference what was found.
        // Best-effort in the sense that a memory-write failure does not
        // undo the handler's already-completed work, but it is never
        // silent: it is logged and recorded on the summary so an operator
        // can see agent memory stopped persisting.
        await storeAgentMemory(supabase, {
          coworkerId: workItem.coworker_id ?? undefined,
          category: "prior_work",
          subject: `${kind}: ${workItem.objective.slice(0, 80)}`,
          body: handlerResult.outcome,
          entityType: workItem.entity_type ?? undefined,
          entityId: workItem.entity_id ?? undefined,
          relevanceHorizon: "daily",
        }).catch((err) => {
          const message = safeErrorMessage(err);
          console.error(`[work-executor] storeAgentMemory failed for ${kind}: ${message}`);
          summary.errors.push(`${kind}:store-agent-memory-failed:${message}`);
        });

        // Record budget usage for the execution (northstar §24). Same
        // logged-not-swallowed treatment as above.
        await recordBudgetUsage(supabase, {
          coworkerId: workItem.coworker_id ?? null,
          budgetKind: "vendor_api_calls",
          value: 1,
        }).catch((err) => {
          const message = safeErrorMessage(err);
          console.error(`[work-executor] recordBudgetUsage failed for ${kind}: ${message}`);
          summary.errors.push(`${kind}:record-budget-usage-failed:${message}`);
        });

        return { value: handlerResult as unknown as Record<string, unknown>, outcome: handlerResult.outcome };
      } catch (err) {
        summary.failed++;
        summary.errors.push(`${kind}:${safeErrorMessage(err)}`);
        throw err; // withWorkItem will call failWorkItem
      }
    });

    // If the claim was skipped (already claimed or none available), that's fine.
    if (!result.claimed) {
      // No item available for this kind — move to the next.
      continue;
    }
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
