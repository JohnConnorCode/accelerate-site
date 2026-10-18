import { assertArchitectReviewScope } from "./architect-review-contract";
export {
  proposalToTypedPatch,
  assertArchitectReviewScope,
  ENTIRE_ACCOUNT_REFUSED,
} from "./architect-review-contract";
import "server-only";
import { compileBlueprintPlan, type BlueprintCompilePlan } from "./workspace-blueprint-compiler";
import {
  diffBlueprints,
  parseBlueprint,
  type BlueprintDiff,
  type BlueprintLiveContext,
  type WorkspaceBlueprint,
} from "./workspace-blueprint";

export const VERSION_CONFLICT = "Blueprint version conflict";

export interface SimulationTraceStep {
  key: string;
  description: string;
  capabilityKey: string | null;
  outcome: string;
}

export interface SimulationTrace {
  event: string;
  workflowKey: string;
  steps: SimulationTraceStep[];
}

export interface BlueprintSimulation {
  kind: "simulation";
  writes: [];
  sends: [];
  moduleEnablement: [];
  plan: BlueprintCompilePlan;
  scenario: { event: string | null };
  traces: SimulationTrace[];
}

export function assertExpectedVersion(actual: number, expected: number): void {
  if (!Number.isInteger(expected) || expected < 0 || actual !== expected) {
    throw new Error(VERSION_CONFLICT);
  }
}

export function applyConversationalPatch(
  current: WorkspaceBlueprint,
  patch: Record<string, unknown>,
): { next: WorkspaceBlueprint; diff: BlueprintDiff } {
  assertArchitectReviewScope(patch);
  const next = parseBlueprint({ ...current, ...patch, schemaVersion: current.schemaVersion });
  return { next, diff: diffBlueprints(current, next) };
}

function stepOutcome(kind: string): string {
  if (kind === "action" || kind === "external") {
    return "Would invoke the cited capability. No live send or write.";
  }
  if (kind === "approval") return "Would wait for operator approval. No live effect.";
  return "Would draft internally. No live write.";
}

export function simulateBlueprint(
  blueprint: WorkspaceBlueprint,
  context: BlueprintLiveContext,
  scenario?: { event?: string | null },
): BlueprintSimulation {
  assertArchitectReviewScope(blueprint);
  assertArchitectReviewScope(scenario ?? {});
  const event = typeof scenario?.event === "string" ? scenario.event.trim() : "";
  const traces: SimulationTrace[] = [];
  for (const workflow of blueprint.workflows) {
    const trigger = workflow.trigger.ref;
    if (event && trigger !== event && !trigger.includes(event) && !event.includes(trigger)) {
      continue;
    }
    traces.push({
      event: trigger,
      workflowKey: workflow.key,
      steps: workflow.steps.map((step) => ({
        key: step.key,
        description: step.description,
        capabilityKey: step.capabilityKey ?? null,
        outcome: stepOutcome(step.kind),
      })),
    });
  }
  return {
    kind: "simulation",
    writes: [],
    sends: [],
    moduleEnablement: [],
    plan: compileBlueprintPlan(blueprint, context),
    scenario: { event: event || null },
    traces,
  };
}
