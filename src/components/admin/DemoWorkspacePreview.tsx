import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

export function DemoWorkspacePreview({ scenarioId }: { scenarioId: DemoScenarioId }) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  return (
    <div className="demo-workspace-preview mt-5 overflow-hidden rounded-[12px] shadow-[var(--demo-preview-shadow)]" aria-hidden="true">
      <div className="demo-workspace-preview-header flex items-center justify-between px-3 py-2">
        <span className="text-[9px] font-semibold tracking-[0.01em]">Today</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] opacity-70 tabular-nums">{scenario.story[0]}</span>
      </div>
      <div className="divide-y divide-[var(--demo-preview-rule)]">
        {scenario.opportunities.slice(0, 2).map((opportunity) => (
          <div key={opportunity.id} className="px-3 py-2.5">
            <span className="block truncate text-[11px] font-medium leading-4 text-[var(--demo-preview-ink)]">{opportunity.name}</span>
            <span className="mt-0.5 block truncate text-[10px] leading-4 text-[var(--demo-preview-muted)]">{opportunity.nextAction}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
