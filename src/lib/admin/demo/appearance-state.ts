import { DEMO_SCENARIOS, type DemoAppearance, type DemoScenarioId } from "./scenarios";

const APPEARANCE_VERSION = "v1";
const appearances = new Set<DemoAppearance>(["light", "dark", "signal", "studio", "frost"]);

export function demoAppearanceKey(scenarioId: DemoScenarioId) {
  return `accelerate:admin-demo:${scenarioId}:appearance:${APPEARANCE_VERSION}`;
}

export function readDemoAppearance(scenarioId: DemoScenarioId): DemoAppearance {
  const saved = window.sessionStorage.getItem(demoAppearanceKey(scenarioId));
  return saved && appearances.has(saved as DemoAppearance)
    ? saved as DemoAppearance
    : DEMO_SCENARIOS[scenarioId].appearance;
}

export function saveDemoAppearance(scenarioId: DemoScenarioId, appearance: DemoAppearance) {
  window.sessionStorage.setItem(demoAppearanceKey(scenarioId), appearance);
}

export function clearDemoAppearance(scenarioId: DemoScenarioId) {
  window.sessionStorage.removeItem(demoAppearanceKey(scenarioId));
}
