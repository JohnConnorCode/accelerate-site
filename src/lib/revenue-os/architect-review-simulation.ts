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

export interface BlueprintSimulation {
  kind: "simulation";
  writes: [];
  sends: [];
  moduleEnablement: [];
  plan: BlueprintCompilePlan;
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

export function applyConversationalPatch(
  current: WorkspaceBlueprint,
  patch: Record<string, unknown>,
): { next: WorkspaceBlueprint; diff: BlueprintDiff } {
  assertArchitectReviewScope(patch);
  const next = parseBlueprint({ ...current, ...patch, schemaVersion: current.schemaVersion });
  return { next, diff: diffBlueprints(current, next) };
}

export function simulateBlueprint(
  blueprint: WorkspaceBlueprint,
  context: BlueprintLiveContext,
): BlueprintSimulation {
  assertArchitectReviewScope(blueprint);
  return {
    kind: "simulation",
    writes: [],
    sends: [],
    moduleEnablement: [],
    plan: compileBlueprintPlan(blueprint, context),
  };
}
