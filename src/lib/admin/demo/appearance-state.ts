import { DEMO_SCENARIOS, type DemoAppearance, type DemoScenarioId } from "./scenarios";
import { isAdminAppearance } from "@/lib/admin/appearances";

const APPEARANCE_VERSION = "v1";

export function demoAppearanceKey(scenarioId: DemoScenarioId) {
  return `accelerate:admin-demo:${scenarioId}:appearance:${APPEARANCE_VERSION}`;
}

export function readDemoAppearance(scenarioId: DemoScenarioId): DemoAppearance {
  const saved = window.sessionStorage.getItem(demoAppearanceKey(scenarioId));
  return isAdminAppearance(saved) ? saved : DEMO_SCENARIOS[scenarioId].appearance;
}

export function saveDemoAppearance(scenarioId: DemoScenarioId, appearance: DemoAppearance) {
  window.sessionStorage.setItem(demoAppearanceKey(scenarioId), appearance);
}

export function clearDemoAppearance(scenarioId: DemoScenarioId) {
  window.sessionStorage.removeItem(demoAppearanceKey(scenarioId));
}
