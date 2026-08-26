import type { DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { cn } from "@/lib/utils";

export function DemoScenarioMark({
  scenarioId,
  className,
}: {
  scenarioId: DemoScenarioId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn("demo-scenario-mark", `demo-scenario-mark--${scenarioId}`, className)}
      aria-hidden="true"
    >
      {scenarioId === "sprout-and-spark" && (
        <>
          <path className="demo-mark-stem" d="M20 31V19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path className="demo-mark-leaf demo-mark-leaf--left" d="M19.8 22.5C12.4 22.2 8.5 18.4 8 11c7.4.4 11.2 4.2 11.8 11.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path className="demo-mark-leaf demo-mark-leaf--right" d="M20.2 18.4C21 11.5 24.9 8 32 8c-.6 7.1-4.5 10.6-11.8 10.4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <circle className="demo-mark-core" cx="20" cy="31" r="2.2" fill="currentColor" />
        </>
      )}
      {scenarioId === "northline-roofing" && (
        <>
          <path className="demo-mark-roof demo-mark-roof--back" d="M5 21 20 8l15 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path className="demo-mark-roof demo-mark-roof--front" d="m10 25 10-9 10 9v8H10v-8Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path className="demo-mark-door" d="M17 33v-7h6v7" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </>
      )}
      {scenarioId === "harborline-growth" && (
        <>
          <path className="demo-mark-horizon" d="M6 31h28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path className="demo-mark-rise demo-mark-rise--one" d="M10 27v-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path className="demo-mark-rise demo-mark-rise--two" d="M20 27V15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path className="demo-mark-rise demo-mark-rise--three" d="M30 27V9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path className="demo-mark-arrow" d="m23 10 7-3 3 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
