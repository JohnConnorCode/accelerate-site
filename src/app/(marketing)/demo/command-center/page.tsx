import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DEMO_SCENARIO_SHELL_NAMES, DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { DemoWorkspacePreview } from "@/components/admin/DemoWorkspacePreview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Command Center Demo Workspaces",
  description: "Explore the full Command Center with detailed fictional business data.",
  robots: { index: false, follow: false },
};

export default function AdminDemoLauncher() {
  return (
    <main className="demo-launcher relative min-h-screen overflow-x-hidden bg-[var(--demo-launcher-canvas)] px-[var(--gut)] pb-16 pt-[calc(var(--site-header-h)+env(safe-area-inset-top)+1rem)] text-[var(--demo-launcher-ink)] antialiased transition-colors duration-200 sm:pb-20 sm:pt-[calc(var(--site-header-h)+env(safe-area-inset-top)+1.5rem)]">
      <div className="demo-launcher-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="demo-launcher-glow demo-launcher-glow--top pointer-events-none absolute -right-40 top-8 size-[28rem] rounded-full blur-[110px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1120px]">
        <header className="grid items-end gap-6 pb-10 pt-[clamp(2.25rem,6vw,4.75rem)] sm:pb-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,.7fr)] lg:gap-16">
          <div>
            <p className="admin-demo-enter admin-demo-d1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--demo-launcher-faint)]">Full admin demo</p>
            <h1 id="demo-launcher-title" className="admin-demo-enter admin-demo-d2 mt-4 max-w-[13ch] text-balance font-display text-[clamp(2.35rem,5.2vw,4.35rem)] font-semibold leading-[0.94] tracking-[-0.055em]">
              Explore the full admin through five real operating models.
            </h1>
          </div>
          <div className="admin-demo-enter admin-demo-d3 lg:pb-1">
            <p className="max-w-[28rem] text-pretty text-[15px] leading-7 text-[var(--demo-launcher-muted)] sm:text-base">
              Pick the business closest to yours. Each workspace uses complete fictional records and safe simulated actions.
            </p>
            <p className="admin-demo-enter admin-demo-d4 mt-4 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-[var(--demo-launcher-accent)]">
              Browser-only fictional workspaces. Nothing can send, schedule, or change a live record.
            </p>
          </div>
        </header>

        <section aria-labelledby="demo-launcher-title">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
            {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => (
              <div
                key={scenario.id}
                className={cn(
                  "admin-demo-enter min-w-0 lg:col-span-2",
                  index === 3 && "lg:col-start-2",
                  index === 4 && "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-[calc(50%-0.625rem)] lg:col-span-2 lg:max-w-none",
                )}
                style={{ animationDelay: `${380 + index * 90}ms` }}
              >
                <Link
                  href={`/demo/command-center/${scenario.id}/today`}
                  className="demo-launcher-card group relative flex h-full flex-col overflow-hidden rounded-[20px] p-5 text-[var(--demo-card-ink)] shadow-[var(--demo-card-shadow)] transition-[translate,box-shadow,background-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-[var(--demo-card-shadow-hover)] focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--demo-launcher-focus)] active:translate-y-0 sm:p-5"
                  aria-label={`Explore ${scenario.name} demo workspace`}
                >
                  <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-[0.2] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" style={{ background: scenario.accent }} aria-hidden="true" />

                  <article className="relative flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: scenario.accent }}>
                        <DemoScenarioMark scenarioId={scenario.id} className="size-6" />
                      </span>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--demo-card-faint)]">{scenario.category}</p>
                    </div>

                    <h2 className="mt-5 text-balance font-display text-[1.65rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[1.75rem]">
                      {DEMO_SCENARIO_SHELL_NAMES[scenario.id]}
                    </h2>
                    <p className="mt-2.5 text-pretty text-[13px] leading-5 text-[var(--demo-card-muted)]">{scenario.description}</p>

                    <DemoWorkspacePreview scenarioId={scenario.id} />

                    <span className="mt-auto flex min-h-11 items-center justify-between pt-5 text-[13px] font-semibold">
                      Open workspace
                      <span className="grid size-9 place-items-center rounded-full bg-[var(--demo-card-action)] text-[var(--demo-card-action-ink)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" aria-hidden="true">
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    </span>
                  </article>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="admin-demo-enter mt-10 text-center font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[var(--demo-launcher-faint)]" style={{ animationDelay: "860ms" }}>
          Each business keeps separate data and appearance in this browser session.
        </p>
      </div>
    </main>
  );
}
