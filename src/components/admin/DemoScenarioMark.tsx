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
      {scenarioId === "alder-ridge-law" && (
        <>
          <path
            className="demo-mark-law demo-mark-law--beam"
            d="M20 8v24M9 13h22"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            className="demo-mark-law demo-mark-law--left"
            d="m9 13-5 10h10L9 13Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-law demo-mark-law--right"
            d="m31 13-5 10h10l-5-10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-law demo-mark-law--base"
            d="M13 33h14"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      )}
      {scenarioId === "northline-roofing" && (
        <>
          <path
            className="demo-mark-roof demo-mark-roof--back"
            d="M5 21 20 8l15 13"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-roof demo-mark-roof--front"
            d="m10 25 10-9 10 9v8H10v-8Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-door"
            d="M17 33v-7h6v7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </>
      )}
      {scenarioId === "ledgerstone-advisory" && (
        <>
          <path
            className="demo-mark-ledger demo-mark-ledger--frame"
            d="M9 7h22v26H9z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-ledger demo-mark-ledger--line-one"
            d="M14 14h12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            className="demo-mark-ledger demo-mark-ledger--line-two"
            d="M14 20h12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            className="demo-mark-ledger demo-mark-ledger--line-three"
            d="M14 26h7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}
      {scenarioId === "hearthline-realty" && (
        <>
          <path
            className="demo-mark-home demo-mark-home--roof"
            d="M5 20 20 8l15 12"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-home demo-mark-home--frame"
            d="M10 19v14h20V19"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-home demo-mark-home--door"
            d="M17 33V23h7v10"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </>
      )}
      {scenarioId === "common-table-network" && (
        <>
          <path
            className="demo-mark-table demo-mark-table--top"
            d="M7 19h26"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            className="demo-mark-table demo-mark-table--legs"
            d="m12 19-3 14m19-14 3 14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            className="demo-mark-table demo-mark-table--bowl"
            d="M13 12c1.5 4 4 6 7 6s5.5-2 7-6H13Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="demo-mark-table demo-mark-table--leaf"
            d="M20 12c0-3 2-5 5-5 0 3-2 5-5 5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
