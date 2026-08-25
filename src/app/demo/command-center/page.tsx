import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";

export const metadata: Metadata = { title: "Command Center Demo Workspaces", description: "Explore the full Command Center with detailed fictional business data.", robots: { index: false, follow: false } };

export default function AdminDemoLauncher() {
  return <main className="min-h-screen bg-[#ecece7] px-4 py-6 text-[#0b0b0b] antialiased sm:px-6 sm:py-10">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/command-center" className="inline-flex min-h-10 items-center text-xs font-semibold text-black/55 transition-[color,transform] hover:text-black active:scale-[0.96]">← Command Center overview</Link><span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-700/8 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800"><ShieldCheck className="size-4" />Browser-only fictional workspaces</span></div>
      <header className="pb-9 pt-12 sm:pb-12 sm:pt-20"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">Full admin demo</p><h1 className="mt-3 max-w-4xl text-balance font-display text-[clamp(2.7rem,8vw,6.8rem)] font-semibold leading-[0.88] tracking-[-0.06em]">See the same system run three different businesses.</h1><p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-black/58 sm:text-lg">These are the actual Command Center routes and workflows, populated with detailed fictional records, emails, metrics, AI context, and simulated receipts. Nothing can reach a live system.</p></header>
      <section className="grid gap-4 lg:grid-cols-3">
        {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => <article key={scenario.id} className="group flex min-h-[430px] flex-col rounded-[24px] bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,0,0,.35),0_0_0_1px_rgba(0,0,0,.06)] sm:p-6" style={{ animationDelay: `${index * 90}ms` }}>
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-[13px] text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]" style={{ background: scenario.accent }}>{scenario.name.slice(0, 1)}</span><span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-black/48">Scenario {index + 1}</span></div>
          <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-black/42">{scenario.category}</p><h2 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.035em]">{scenario.name}</h2><p className="mt-3 text-pretty text-sm leading-6 text-black/55">{scenario.description}</p>
          <ul className="mt-6 space-y-2.5">{scenario.story.slice(0, 3).map((step) => <li key={step} className="flex gap-2.5 text-xs leading-5 text-black/60"><Check className="mt-0.5 size-3.5 shrink-0" />{step}</li>)}</ul>
          <Link href={`/demo/command-center/${scenario.id}/today`} className="mt-auto inline-flex min-h-12 items-center justify-between rounded-[13px] bg-black px-4 text-sm font-semibold text-white transition-[opacity,transform] hover:opacity-82 active:scale-[0.96]">Open full workspace <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></Link>
        </article>)}
      </section>
      <p className="py-8 text-center text-xs text-black/42">Each business keeps separate session state. Reset controls are always available inside the workspace.</p>
    </div>
  </main>;
}
