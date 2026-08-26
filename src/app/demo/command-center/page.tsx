import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";

export const metadata: Metadata = {
  title: "Command Center Demo Workspaces",
  description: "Explore the full Command Center with detailed fictional business data.",
  robots: { index: false, follow: false },
};

export default function AdminDemoLauncher() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-5 text-[#fbfbfa] antialiased sm:px-6 sm:py-7">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-48 top-0 size-[34rem] rounded-full bg-emerald-400/[0.07] blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-64 bottom-[-18rem] size-[38rem] rounded-full bg-violet-400/[0.045] blur-[140px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1320px]">
        <div className="admin-demo-enter admin-demo-d1 flex flex-wrap items-center justify-between gap-4 border-b border-white/12 pb-5">
          <Link href="/command-center" className="inline-flex min-h-11 items-center text-xs font-semibold text-white/55 transition-[color,transform] duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.96]">
            ← Command Center overview
          </Link>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-300/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200 shadow-[inset_0_0_0_1px_rgba(167,243,208,.15)]">
            <ShieldCheck className="size-4" />Browser-only fictional workspaces
          </span>
        </div>

        <header className="grid gap-8 pb-12 pt-[clamp(3.5rem,9vw,8rem)] lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.48fr)] lg:items-end lg:gap-16 lg:pb-20">
          <div>
            <p className="admin-demo-enter admin-demo-d2 font-mono text-[10px] font-semibold uppercase tracking-[0.19em] text-white/42">Full admin demo</p>
            <h1 className="admin-demo-enter admin-demo-d3 mt-4 max-w-[12ch] text-balance font-display text-[clamp(3.1rem,7.3vw,7.4rem)] font-semibold leading-[0.84] tracking-[-0.065em]">One system. Three operating worlds.</h1>
          </div>
          <div className="admin-demo-enter admin-demo-d4 border-l-2 border-emerald-300/70 pl-5 sm:pl-6">
            <p className="max-w-xl text-pretty text-base leading-7 text-white/62 sm:text-lg">Choose a fictional business, then explore the actual Command Center with complete records, workflows, metrics, and simulated actions.</p>
            <p className="mt-5 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-emerald-200/72">Nothing can send, schedule, or change a live record.</p>
          </div>
        </header>

        <section aria-labelledby="demo-scenarios">
          <div className="admin-demo-enter admin-demo-d5 mb-5 flex items-end justify-between gap-4 border-t border-white/12 pt-5">
            <h2 id="demo-scenarios" className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/62">Choose a business</h2>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-white/28 sm:inline">Session-isolated · reset anytime</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => (
              <div key={scenario.id} className="admin-demo-enter" style={{ animationDelay: `${520 + index * 110}ms` }}>
                <Link
                  href={`/demo/command-center/${scenario.id}/today`}
                  className="group relative flex min-h-[420px] overflow-hidden rounded-[14px] bg-[#f4f4ef] p-5 text-[#0b0b0b] shadow-[0_0_0_1px_rgba(255,255,255,.08),0_18px_50px_-36px_rgba(0,0,0,.8)] transition-[translate,box-shadow,background-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:bg-white hover:shadow-[0_0_0_1px_rgba(255,255,255,.16),0_30px_72px_-38px_rgba(0,0,0,.9)] focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-y-0 sm:min-h-[460px] sm:p-6"
                  aria-label={`Explore ${scenario.name} demo workspace`}
                >
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-[0.28] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" style={{ background: scenario.accent }} aria-hidden="true" />
                  <span className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-[0.07] blur-3xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110 group-hover:opacity-[0.13] group-focus-visible:scale-110 group-focus-visible:opacity-[0.13]" style={{ background: scenario.accent }} aria-hidden="true" />

                  <article className="relative flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4 pt-2">
                      <span className="grid size-12 place-items-center rounded-[10px] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.2),0_10px_28px_-16px_rgba(0,0,0,.55)]" style={{ background: scenario.accent }}><DemoScenarioMark scenarioId={scenario.id} className="size-8" /></span>
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-black/38">0{index + 1} / 03</span>
                    </div>

                    <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/42">{scenario.category}</p>
                    <h3 className="mt-2 max-w-[18ch] text-balance font-display text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold leading-[0.96] tracking-[-0.045em]">{scenario.name}</h3>
                    <p className="mt-4 max-w-[42ch] text-pretty text-sm leading-6 text-black/56">{scenario.description}</p>

                    <ul className="mt-6 space-y-2.5 border-t border-black/10 pt-5">
                      {scenario.story.slice(0, 3).map((step) => (
                        <li key={step} className="flex gap-2.5 text-xs leading-5 text-black/62">
                          <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: scenario.accent }} />{step}
                        </li>
                      ))}
                    </ul>

                    <span className="mt-auto flex min-h-12 items-center justify-between border-t border-black/12 pt-5 text-sm font-semibold">
                      Explore workspace
                      <span className="grid size-9 place-items-center rounded-full bg-black text-white transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-x-1 group-focus-visible:translate-x-1" aria-hidden="true"><ArrowUpRight className="size-4" /></span>
                    </span>
                  </article>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="admin-demo-enter py-8 text-center font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-white/32" style={{ animationDelay: "900ms" }}>Each business keeps separate browser-session state. Reset controls remain available inside every workspace.</p>
      </div>
    </main>
  );
}
