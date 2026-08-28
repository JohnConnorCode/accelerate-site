import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { DemoWorkspacePreview } from "@/components/admin/DemoWorkspacePreview";
import { DemoLauncherThemeToggle } from "@/components/admin/DemoLauncherThemeToggle";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Command Center Demo Workspaces",
  description: "Explore the full Command Center with detailed fictional business data.",
  robots: { index: false, follow: false },
};

export default function AdminDemoLauncher() {
  return (
    <main className="demo-launcher relative min-h-screen overflow-hidden bg-[var(--demo-launcher-canvas)] px-4 py-5 text-[var(--demo-launcher-ink)] antialiased transition-colors duration-200 sm:px-6 sm:py-7">
      <div className="demo-launcher-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="demo-launcher-glow demo-launcher-glow--top pointer-events-none absolute -right-48 top-0 size-[34rem] rounded-full blur-[120px]" aria-hidden="true" />
      <div className="demo-launcher-glow demo-launcher-glow--bottom pointer-events-none absolute -left-64 bottom-[-18rem] size-[38rem] rounded-full blur-[140px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1320px]">
        <div className="admin-demo-enter admin-demo-d1 flex items-center justify-between gap-4 border-b border-[var(--demo-launcher-rule)] pb-5">
          <Link href="/command-center" className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--demo-launcher-muted)] transition-[color,transform] duration-200 hover:text-[var(--demo-launcher-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--demo-launcher-focus)] active:scale-[0.96]">
            ← Command Center overview
          </Link>
          <div className="flex items-center gap-2">
            <span className="demo-launcher-safety hidden min-h-10 items-center gap-2 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[var(--demo-launcher-pill-shadow)] sm:inline-flex">
              <ShieldCheck className="size-4" />Browser-only fictional workspaces
            </span>
            <DemoLauncherThemeToggle />
          </div>
        </div>

        <header className="grid gap-8 pb-12 pt-[clamp(3.5rem,9vw,8rem)] lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.48fr)] lg:items-end lg:gap-16 lg:pb-20">
          <div>
            <p className="admin-demo-enter admin-demo-d2 font-mono text-[10px] font-semibold uppercase tracking-[0.19em] text-[var(--demo-launcher-faint)]">Full admin demo</p>
            <h1 className="admin-demo-enter admin-demo-d3 mt-4 max-w-[14ch] text-balance font-display text-[clamp(3rem,6.8vw,6.9rem)] font-semibold leading-[0.86] tracking-[-0.06em]">Explore the full admin through five real operating models.</h1>
          </div>
          <div className="admin-demo-enter admin-demo-d4 border-l-2 border-[var(--demo-launcher-accent)] pl-5 sm:pl-6">
            <p className="max-w-xl text-pretty text-base leading-7 text-[var(--demo-launcher-muted)] sm:text-lg">Choose the business closest to yours, then explore every admin workspace with complete fictional records, connected workflows, metrics, and safe simulated actions.</p>
            <p className="mt-5 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-[var(--demo-launcher-accent)]">Nothing can send, schedule, or change a live record.</p>
          </div>
        </header>

        <section aria-labelledby="demo-scenarios">
          <div className="admin-demo-enter admin-demo-d5 mb-5 flex items-end justify-between gap-4 border-t border-[var(--demo-launcher-rule)] pt-5">
            <h2 id="demo-scenarios" className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--demo-launcher-muted)]">Choose a business</h2>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--demo-launcher-faint)] sm:inline">Full admin · session-isolated · reset anytime</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => (
              <div key={scenario.id} className={cn("admin-demo-enter lg:col-span-2", index === 4 && "sm:col-span-2", index >= 3 && "lg:col-span-3")} style={{ animationDelay: `${520 + index * 100}ms` }}>
                <Link
                  href={`/demo/command-center/${scenario.id}/today`}
                  className="demo-launcher-card group relative flex min-h-[420px] overflow-hidden rounded-[18px] p-5 text-[var(--demo-card-ink)] shadow-[var(--demo-card-shadow)] transition-[translate,box-shadow,background-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-[var(--demo-card-shadow-hover)] focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--demo-launcher-focus)] active:translate-y-0 sm:min-h-[460px] sm:p-6"
                  aria-label={`Explore ${scenario.name} demo workspace`}
                >
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-[0.28] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" style={{ background: scenario.accent }} aria-hidden="true" />
                  <span className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-[0.07] blur-3xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110 group-hover:opacity-[0.13] group-focus-visible:scale-110 group-focus-visible:opacity-[0.13]" style={{ background: scenario.accent }} aria-hidden="true" />

                  <article className="relative flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4 pt-2">
                      <span className="grid size-12 place-items-center rounded-[10px] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.2),0_10px_28px_-16px_rgba(0,0,0,.55)]" style={{ background: scenario.accent }}><DemoScenarioMark scenarioId={scenario.id} className="size-8" /></span>
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--demo-card-faint)] tabular-nums">0{index + 1} / 05</span>
                    </div>

                    <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--demo-card-faint)]">{scenario.category}</p>
                    <h3 className="mt-2 max-w-[18ch] text-balance font-display text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold leading-[0.96] tracking-[-0.045em]">{scenario.name}</h3>
                    <p className="mt-4 max-w-[42ch] text-pretty text-sm leading-6 text-[var(--demo-card-muted)]">{scenario.description}</p>

                    <DemoWorkspacePreview scenarioId={scenario.id} />

                    <div className="mt-5 border-t border-[var(--demo-card-rule)] pt-4">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--demo-card-faint)]">Inside this workspace</p>
                      <ul className="mt-3 space-y-2.5">
                      {scenario.story.slice(0, 2).map((step) => (
                        <li key={step} className="flex gap-2.5 text-xs leading-5 text-[var(--demo-card-muted)]">
                          <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: scenario.accent }} />{step}
                        </li>
                      ))}
                      </ul>
                    </div>

                    <span className="mt-auto flex min-h-12 items-center justify-between border-t border-[var(--demo-card-rule)] pt-5 text-sm font-semibold">
                      Explore workspace
                      <span className="grid size-10 place-items-center rounded-full bg-[var(--demo-card-action)] text-[var(--demo-card-action-ink)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-x-1 group-focus-visible:translate-x-1" aria-hidden="true"><ArrowUpRight className="size-4" /></span>
                    </span>
                  </article>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="admin-demo-enter py-8 text-center font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[var(--demo-launcher-faint)]" style={{ animationDelay: "1020ms" }}>Each business keeps separate data and appearance state in this browser session.</p>
      </div>
    </main>
  );
}
