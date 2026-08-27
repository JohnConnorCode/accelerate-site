import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

export function DemoWorkspacePreview({ scenarioId }: { scenarioId: DemoScenarioId }) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  return (
    <div className="mt-6 overflow-hidden rounded-[13px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.07),0_18px_38px_-28px_rgba(0,0,0,.34)]" aria-hidden="true">
      <div className="flex items-center justify-between bg-[#111] px-3 py-2.5 text-white">
        <span className="text-[9px] font-semibold">Today</span>
        <span className="font-mono text-[7px] uppercase tracking-[0.11em] text-white/45">{scenario.actions.length} need review</span>
      </div>
      <div className="divide-y divide-black/[0.06]">
        {scenario.opportunities.slice(0, 3).map((opportunity, index) => (
          <div key={opportunity.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-3">
            <span className="grid size-6 place-items-center rounded-[7px]" style={{ color: scenario.accent, backgroundColor: `${scenario.accent}16` }}>
              {index === 0 ? <Clock3 className="size-3" /> : <CheckCircle2 className="size-3" />}
            </span>
            <span className="min-w-0"><span className="block truncate text-[9px] font-semibold text-black/78">{opportunity.name}</span><span className="mt-0.5 block truncate text-[7px] text-black/38">{opportunity.nextAction}</span></span>
            <ArrowUpRight className="size-3 text-black/22" />
          </div>
        ))}
      </div>
    </div>
  );
}
