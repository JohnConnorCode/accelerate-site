import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";

export const metadata: Metadata = { title: "Command Center Demo Workspaces", description: "Explore the full Command Center with detailed fictional business data.", robots: { index: false, follow: false } };

export default function AdminDemoLauncher() {
  return <main className="relative min-h-screen overflow-hidden bg-[#0b0b0b] px-4 py-5 text-[#fbfbfa] antialiased sm:px-6 sm:py-7">
    <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden="true" />
    <div className="pointer-events-none absolute -right-48 top-0 size-[34rem] rounded-full bg-emerald-400/[0.07] blur-[120px]" aria-hidden="true" />
    <div className="relative mx-auto max-w-[1320px]">
      <div className="admin-demo-enter admin-demo-d1 flex flex-wrap items-center justify-between gap-4 border-b border-white/12 pb-5">
        <Link href="/command-center" className="inline-flex min-h-11 items-center text-xs font-semibold text-white/55 transition-[color,transform] hover:text-white active:scale-[0.96]">← Command Center overview</Link>
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-300/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200 ring-1 ring-emerald-200/15"><ShieldCheck className="size-4" />Browser-only fictional workspaces</span>
      </div>
      <header className="grid gap-8 pb-12 pt-[clamp(3.5rem,9vw,8rem)] lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.48fr)] lg:items-end lg:gap-16 lg:pb-20">
        <div>
          <p className="admin-demo-enter admin-demo-d2 font-mono text-[10px] font-semibold uppercase tracking-[0.19em] text-white/42">Full admin demo</p>
          <h1 className="admin-demo-enter admin-demo-d3 mt-4 max-w-[12ch] text-balance font-display text-[clamp(3.1rem,7.3vw,7.4rem)] font-semibold leading-[0.84] tracking-[-0.065em]">One system. Three operating worlds.</h1>
        </div>
        <div className="admin-demo-enter admin-demo-d4 border-l-2 border-emerald-300/70 pl-5 sm:pl-6">
          <p className="max-w-xl text-pretty text-base leading-7 text-white/62 sm:text-lg">Choose a fictional business, then use the actual Command Center routes and workflows with detailed records, emails, metrics, AI context, and simulated receipts.</p>
          <p className="mt-5 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-emerald-200/72">Nothing can send, schedule, or change a live record.</p>
        </div>
      </header>
      <section aria-labelledby="demo-scenarios">
        <div className="admin-demo-enter admin-demo-d5 mb-5 flex items-end justify-between gap-4 border-t border-white/12 pt-5">
          <h2 id="demo-scenarios" className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/62">Choose a business</h2>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/28">Session-isolated · reset anytime</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => <div key={scenario.id} className="admin-demo-enter" style={{ animationDelay: `${520 + index * 110}ms` }}>
            <article className="group relative flex min-h-[440px] flex-col overflow-hidden rounded-[2px] bg-[#f5f5f0] p-5 text-[#0b0b0b] shadow-[0_24px_70px_-42px_rgba(0,0,0,.8),0_0_0_1px_rgba(255,255,255,.08)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_34px_90px_-46px_rgba(0,0,0,.9),0_0_0_1px_rgba(255,255,255,.14)] sm:p-6">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: scenario.accent }} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4 pt-2"><span className="grid size-12 place-items-center rounded-[2px] text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.2),0_10px_28px_-16px_rgba(0,0,0,.55)]" style={{ background: scenario.accent }}>{scenario.name.slice(0, 1)}</span><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-black/38">0{index + 1} / 03</span></div>
              <p className="mt-9 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/42">{scenario.category}</p>
              <h3 className="mt-2 max-w-[17ch] text-balance font-display text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold leading-[0.96] tracking-[-0.045em]">{scenario.name}</h3>
              <p className="mt-4 max-w-[42ch] text-pretty text-sm leading-6 text-black/56">{scenario.description}</p>
              <ul className="mt-7 space-y-3 border-t border-black/10 pt-5">{scenario.story.slice(0, 3).map((step) => <li key={step} className="flex gap-2.5 text-xs leading-5 text-black/62"><Check className="mt-0.5 size-3.5 shrink-0" style={{ color: scenario.accent }} />{step}</li>)}</ul>
              <Link href={`/demo/command-center/${scenario.id}/today`} className="mt-auto inline-flex min-h-12 items-center justify-between rounded-[2px] bg-black px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-black/80 active:scale-[0.96]">Enter workspace <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" /></Link>
            </article>
          </div>)}
        </div>
      </section>
      <p className="admin-demo-enter py-8 text-center font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-white/32" style={{ animationDelay: "900ms" }}>Each business keeps separate browser-session state. Reset controls remain available inside every workspace.</p>
    </div>
  </main>;
}
