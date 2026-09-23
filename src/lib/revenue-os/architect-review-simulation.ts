import "server-only";
import { compileBlueprintPlan, type BlueprintCompilePlan } from "./workspace-blueprint-compiler";
import {
  diffBlueprints,
  parseBlueprint,
  type BlueprintDiff,
  type BlueprintLiveContext,
  type WorkspaceBlueprint,
} from "./workspace-blueprint";

export const ENTIRE_ACCOUNT_REFUSED = "Entire-account context is refused";
export const VERSION_CONFLICT = "Blueprint version conflict";

export interface SimulationTraceStep {
  key: string;
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

export function assertArchitectReviewScope(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  if (
    text.includes("entire account") ||
    text.includes("entire-account") ||
    text.includes("all tenants") ||
    text.includes("chain-of-thought") ||
    text.includes("chain of thought")
  ) {
    throw new Error(ENTIRE_ACCOUNT_REFUSED);
  }
}

export function assertExpectedVersion(actual: number, expected: number): void {
  if (!Number.isInteger(expected) || expected < 0 || actual !== expected) {
    throw new Error(VERSION_CONFLICT);
  }
}

export function proposalToTypedPatch(proposal: string): Record<string, unknown> {
  const text = proposal.trim();
  if (!text) throw new Error("proposal is required");
  assertArchitectReviewScope(text);
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("proposal JSON must be an object");
    }
    assertArchitectReviewScope(parsed);
    return parsed as Record<string, unknown>;
  }
  const summary = text.match(
    /^(?:please\s+)?(?:set\s+)?(?:the\s+)?(?:business\s+)?summary(?:\s+to|:)\s+(.+)$/i,
  );
  if (summary?.[1]) return { businessSummary: summary[1].trim() };
  if (text.length >= 12) return { businessSummary: text };
  throw new Error("Could not turn that proposal into a Blueprint patch");
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
