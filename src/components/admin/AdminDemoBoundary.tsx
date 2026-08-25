"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ListChecks, RotateCcw, ShieldCheck, X } from "lucide-react";
import { DEMO_SCENARIOS, DEMO_SCENARIO_SUMMARIES, type DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { installAdminDemoRuntime } from "@/lib/admin/demo/runtime";

export function AdminDemoBoundary({ scenarioId, children }: { scenarioId: DemoScenarioId | null; children: React.ReactNode }) {
  const resetRef = useRef<null | (() => void)>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const pathname = usePathname(); const router = useRouter();
  useLayoutEffect(() => {
    if (!scenarioId) return;
    const runtime = installAdminDemoRuntime(scenarioId);
    resetRef.current = runtime.reset;
    document.documentElement.dataset.adminDemoRuntime = scenarioId;
    const capture = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a"); const href = anchor?.getAttribute("href");
      if (!href?.startsWith("/admin")) return;
      event.preventDefault(); const suffix = href.replace(/^\/admin\/?/, ""); router.push(`/demo/command-center/${scenarioId}/${suffix || "today"}`);
    };
    document.addEventListener("click", capture, true);
    return () => { document.removeEventListener("click", capture, true); delete document.documentElement.dataset.adminDemoRuntime; resetRef.current = null; runtime.restore(); };
  }, [router, scenarioId]);
  if (!scenarioId) return <>{children}</>;
  const scenario = DEMO_SCENARIOS[scenarioId];
  const route = pathname.split("/").slice(4).join("/") || "today";
  const guideRoutes = ["today", "conversations", "pipeline", "revenue", "analytics"];
  const openGuideStep = (step: number) => { setGuideStep(step); router.push(`/demo/command-center/${scenarioId}/${guideRoutes[step]}`); };
  return <>
    {children}
    <aside className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-[760px] flex-col gap-2 rounded-[18px] bg-[#111]/95 p-2.5 text-white shadow-[0_24px_80px_-24px_rgba(0,0,0,.72)] ring-1 ring-white/12 backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:top-4 sm:bottom-auto sm:flex-row sm:items-center" aria-label="Demo workspace controls" data-admin-demo-bar>
      {guideOpen && <section className="absolute inset-x-0 bottom-[calc(100%+0.6rem)] rounded-[18px] bg-[#111]/98 p-4 text-white shadow-[0_20px_65px_-24px_rgba(0,0,0,.8)] ring-1 ring-white/12 backdrop-blur-xl sm:bottom-auto sm:top-[calc(100%+0.6rem)]" aria-label="Guided demo story" data-admin-demo-guide>
        <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">Story {guideStep + 1} of {scenario.story.length}</p><h2 className="mt-1 text-balance text-sm font-semibold">{scenario.story[guideStep]}</h2></div><button type="button" onClick={() => setGuideOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-[9px] text-white/58 transition-[background-color,color,transform] hover:bg-white/8 hover:text-white active:scale-[0.96]" aria-label="Close guided story"><X className="size-4" /></button></div>
        <p className="mt-2 text-pretty text-xs leading-5 text-white/55">Follow this step in the real admin workspace. Records and outcomes remain fictional, and any action is staged locally.</p>
        <div className="mt-4 flex items-center gap-2"><div className="flex flex-1 gap-1">{scenario.story.map((step, index) => <button key={step} type="button" onClick={() => openGuideStep(index)} className={`h-1.5 flex-1 rounded-full transition-colors ${index <= guideStep ? "bg-white" : "bg-white/16"}`} aria-label={`Open story step ${index + 1}`} aria-current={index === guideStep ? "step" : undefined} />)}</div><button type="button" onClick={() => openGuideStep(Math.min(scenario.story.length - 1, guideStep + 1))} disabled={guideStep === scenario.story.length - 1} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-white px-3 text-xs font-semibold text-black transition-[opacity,transform] hover:opacity-85 active:scale-[0.96] disabled:opacity-35">Next <ArrowRight className="size-3.5" /></button></div>
      </section>}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-emerald-400/12 text-emerald-300"><ShieldCheck className="size-4" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold">{scenario.name}</p><p className="truncate text-[10px] text-white/50">Fictional data · no live systems</p></div></div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 sm:flex">
        <label><span className="sr-only">Demo business</span><select aria-label="Demo business" value={scenarioId} onChange={(event) => router.push(`/demo/command-center/${event.target.value}/${route}`)} className="min-h-10 w-full rounded-[10px] bg-white/8 px-3 text-xs font-semibold text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/35 sm:w-auto">{DEMO_SCENARIO_SUMMARIES.map((item) => <option key={item.id} value={item.id} className="bg-[#111]">{item.category}</option>)}</select></label>
        <button type="button" onClick={() => setGuideOpen((current) => !current)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-white/8 px-3 text-xs font-semibold text-white/72 transition-[background-color,color,transform] hover:bg-white/12 hover:text-white active:scale-[0.96]" aria-expanded={guideOpen} aria-label="Open guided demo"><ListChecks className="size-4" /><span className="hidden sm:inline">Guide</span></button>
        <button type="button" onClick={() => resetRef.current?.()} className="grid size-10 place-items-center rounded-[10px] bg-white/8 text-white/70 transition-[background-color,color,transform] hover:bg-white/12 hover:text-white active:scale-[0.96]" aria-label="Reset this demo" title="Reset this demo"><RotateCcw className="size-4" /></button>
        <Link href="/demo/command-center" className="inline-flex min-h-10 items-center rounded-[10px] bg-white px-3 text-xs font-semibold text-black transition-[opacity,transform] hover:opacity-85 active:scale-[0.96]">All demos</Link>
      </div>
    </aside>
  </>;
}
