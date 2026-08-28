import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

export function DemoWorkspacePreview({ scenarioId }: { scenarioId: DemoScenarioId }) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  return (
    <div className="demo-workspace-preview mt-6 overflow-hidden rounded-[13px] shadow-[var(--demo-preview-shadow)]" aria-hidden="true">
      <div className="demo-workspace-preview-header flex items-center justify-between px-3 py-2.5">
        <span className="text-[9px] font-semibold">Today</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.11em] opacity-75 tabular-nums">{scenario.actions.length} need review</span>
      </div>
      <div className="divide-y divide-[var(--demo-preview-rule)]">
        {scenario.opportunities.slice(0, 3).map((opportunity, index) => (
          <div key={opportunity.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-3">
            <span className="grid size-6 place-items-center rounded-[7px]" style={{ color: scenario.accent, backgroundColor: `${scenario.accent}16` }}>
              {index === 0 ? <Clock3 className="size-3" /> : <CheckCircle2 className="size-3" />}
            </span>
            <span className="min-w-0"><span className="block truncate text-[9px] font-semibold text-[var(--demo-preview-ink)]">{opportunity.name}</span><span className="mt-0.5 block truncate text-[8px] text-[var(--demo-preview-muted)]">{opportunity.nextAction}</span></span>
            <ArrowUpRight className="size-3 text-[var(--demo-preview-faint)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
