import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withWorkItem, type WorkItem, type WorkExecutionStatus } from "./work-items";
import { recoverStaleWorkItemClaims } from "./work-items";
import { getCoworkerManifest } from "./coworkers";
import { storeAgentMemory } from "./memory";
import { checkBudgets } from "./budgets";
import { recordAudit } from "./audit";
import { safeErrorMessage } from "./db";
import { checkAutonomy } from "./autonomy-policy";

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
  deferred: number;
  partial: number;
  awaitingApproval: number;
  staleRecovered: number;
  errors: string[];
}

/** Job/HTTP adapters share the same interpretation of durable work receipts. */
export function workExecutionJobStatus(
  summary: WorkExecutionSummary,
): "partial" | "skipped" | "success" {
  if (summary.failed > 0 || summary.partial > 0 || summary.errors.length > 0) return "partial";
  return summary.executed > 0 || summary.completed > 0 ? "success" : "skipped";
}

export type WorkKindHandler = (
  supabase: SupabaseClient,
  workItem: WorkItem,
) => Promise<{ outcome: string; status?: WorkExecutionStatus; nextCheckAt?: string }>;

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
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100)
    throw new Error("maxItems must be between 1 and 100");
  const summary: WorkExecutionSummary = {
    claimed: 0,
    executed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    partial: 0,
    awaitingApproval: 0,
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
      const defer = (outcome: string) => ({
        status: "deferred" as const,
        value: null,
        outcome,
        nextCheckAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });

      // The action stores its work link in the original insert. This survives
      // interruption between proposal creation and updating the work/run trace.
      const { data: linkedActions, error: linkedError } = await supabase
        .from("action_queue")
        .select("id,status")
        .eq("work_item_id", workItem.id);
      if (linkedError) throw new Error(`Work approval lookup failed: ${linkedError.message}`);
      if (linkedActions?.length) workItem.action_ids = linkedActions.map((action) => action.id);
      if (workItem.action_ids?.length) {
        const { data: actions, error } = await supabase
          .from("action_queue")
          .select("id,status")
          .in("id", workItem.action_ids);
        if (error || actions?.length !== new Set(workItem.action_ids).size)
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
          ...defer("Waiting for linked action approval or execution"),
          status: "awaiting_approval" as const,
        };
      }
      if (workItem.coworker_id) {
        const manifest = await getCoworkerManifest(supabase, workItem.coworker_id);
        if (!manifest.readyToWork)
          return defer(`Coworker unavailable: ${manifest.capabilityGaps.join(", ")}`);
      }
      // Work orchestration is not permission to execute business actions. An
      // explicit work policy can stop it; every consequential action is gated
      // independently in the canonical action executor.
      const policy = await checkAutonomy(supabase, `work:${kind}`, workItem.coworker_id);
      if (policy.hardFloor || policy.level === "prohibited") return defer(policy.reason);
      if (policy.policyId && policy.requiresApproval)
        return defer(`Work requires policy review: ${policy.reason}`);
      const budgetResults = await checkBudgets(supabase, {
        coworkerId: workItem.coworker_id ?? "*",
        workItemId: workItem.id,
      });
      const exhausted = budgetResults.find((b) => !b.allowed);
      if (exhausted) return defer(exhausted.reason ?? `Budget exhausted: ${exhausted.budgetKind}`);

      // Execute the registered handler.
      try {
        summary.executed++;
        const handlerResult = await handler(supabase, workItem);

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

        const status = handlerResult.status ?? "completed";
        if (status === "deferred" || status === "awaiting_approval") {
          if (!handlerResult.nextCheckAt)
            throw new Error("Deferred work requires a next check time");
          return {
            status,
            value: handlerResult,
            outcome: handlerResult.outcome,
            nextCheckAt: handlerResult.nextCheckAt,
          };
        }
        return { status, value: handlerResult, outcome: handlerResult.outcome };
      } catch (err) {
        throw err; // withWorkItem will call failWorkItem
      }
    });

    // If the claim was skipped (already claimed or none available), that's fine.
    if (!result.claimed) continue;
    summary.claimed++;
    switch (result.status) {
      case "completed":
        summary.completed++;
        break;
      case "deferred":
        summary.deferred++;
        summary.skipped++;
        break;
      case "awaiting_approval":
        summary.awaitingApproval++;
        break;
      case "partial":
        summary.partial++;
        break;
      default:
        summary.failed++;
    }
    if (result.error) summary.errors.push(`${kind}:${result.error}`);
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
