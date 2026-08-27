"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ListChecks, RotateCcw } from "lucide-react";
import { DEMO_SCENARIOS, DEMO_SCENARIO_SUMMARIES, type DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { installAdminDemoRuntime } from "@/lib/admin/demo/runtime";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { cn } from "@/lib/utils";

interface AdminDemoContextValue {
  scenarioId: DemoScenarioId;
  reset: () => void;
}

const AdminDemoContext = createContext<AdminDemoContextValue | null>(null);
const DEMO_APPEARANCE_SCENARIO_KEY = "accelerate:admin-demo:appearance-scenario";

export function AdminDemoBoundary({ scenarioId, children }: { scenarioId: DemoScenarioId | null; children: React.ReactNode }) {
  const resetRef = useRef<null | (() => void)>(null);
  const router = useRouter();
  const { setTheme } = useTheme();

  useLayoutEffect(() => {
    if (!scenarioId) return;
    if (window.sessionStorage.getItem(DEMO_APPEARANCE_SCENARIO_KEY) !== scenarioId) {
      setTheme(DEMO_SCENARIOS[scenarioId].appearance);
      window.sessionStorage.setItem(DEMO_APPEARANCE_SCENARIO_KEY, scenarioId);
    }
    const runtime = installAdminDemoRuntime(scenarioId);
    resetRef.current = runtime.reset;
    (window as Window & { __accelerateAdminDemoRuntime?: string }).__accelerateAdminDemoRuntime = scenarioId;
    const capture = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!href?.startsWith("/admin")) return;
      event.preventDefault();
      const suffix = href.replace(/^\/admin\/?/, "");
      router.push(`/demo/command-center/${scenarioId}/${suffix || "today"}`);
    };
    document.addEventListener("click", capture, true);
    return () => {
      document.removeEventListener("click", capture, true);
      delete (window as Window & { __accelerateAdminDemoRuntime?: string }).__accelerateAdminDemoRuntime;
      resetRef.current = null;
      runtime.restore();
    };
  }, [router, scenarioId, setTheme]);

  const reset = useCallback(() => resetRef.current?.(), []);
  if (!scenarioId) return <>{children}</>;

  return <AdminDemoContext.Provider value={{ scenarioId, reset }}>{children}</AdminDemoContext.Provider>;
}

export function AdminDemoControls({ collapsed = false }: { collapsed?: boolean }) {
  const demo = useContext(AdminDemoContext);
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const controlsId = useId();
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setGuideOpen(false);
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (guideOpen) setGuideOpen(false);
      else {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [guideOpen, open]);

  if (!demo) return null;
  const scenario = DEMO_SCENARIOS[demo.scenarioId];
  const publicPrefix = `/demo/command-center/${demo.scenarioId}`;
  const route = pathname.startsWith(`${publicPrefix}/`)
    ? pathname.slice(publicPrefix.length + 1)
    : pathname.startsWith("/admin/")
      ? pathname.slice("/admin/".length)
      : "today";
  const guideRoutes = ["today", "conversations", "pipeline", "revenue", "analytics"];
  const openGuideStep = (step: number) => {
    setGuideStep(step);
    router.push(`/demo/command-center/${demo.scenarioId}/${guideRoutes[step]}`);
  };
  const closeControls = () => {
    setGuideOpen(false);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={rootRef} className={cn("relative", open && "z-40")} aria-label="Demo workspace controls" data-admin-demo-bar data-state={open ? "open" : "collapsed"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? closeControls() : setOpen(true)}
        className={cn(
          "admin-nav-demo-control flex min-h-11 items-center rounded-[12px] text-left transition-[background-color,color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-nav-accent)] active:scale-[0.96]",
          collapsed ? "size-11 justify-center" : "w-full gap-2.5 px-2",
        )}
        aria-expanded={open}
        aria-controls={controlsId}
        aria-label={open ? "Hide demo controls" : "Open demo controls"}
        title={collapsed ? "Demo controls" : undefined}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,.7)]" style={{ backgroundColor: scenario.accent }}><DemoScenarioMark scenarioId={demo.scenarioId} className="size-6" /></span>
        {!collapsed && <>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--admin-nav-ink)]">Demo controls</span><span className="mt-0.5 block truncate text-[10px] text-[var(--admin-nav-faint)]">{scenario.name}</span></span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-[var(--admin-nav-faint)] transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={controlsId}
            initial={collapsed ? { opacity: 0, x: -6, scale: 0.98 } : { height: 0, opacity: 0 }}
            animate={collapsed ? { opacity: 1, x: 0, scale: 1 } : { height: "auto", opacity: 1 }}
            exit={collapsed ? { opacity: 0, x: -4, scale: 0.98 } : { height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn("overflow-hidden", collapsed && "admin-demo-rail-popover absolute bottom-0 left-[calc(100%+0.65rem)] w-[17rem] rounded-[18px] p-2 shadow-[0_24px_70px_-30px_rgba(0,0,0,.72)]")}
          >
            <div className={cn("space-y-2", !collapsed && "pt-2")}>
              <div className="admin-demo-control-panel rounded-[14px] p-2 shadow-[inset_0_0_0_1px_var(--admin-nav-rule)]">
                <label className="block">
                  <span className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-nav-faint)]">Demo business</span>
                  <select aria-label="Demo business" value={demo.scenarioId} onChange={(event) => {
                    const nextScenario = event.target.value as DemoScenarioId;
                    setTheme(DEMO_SCENARIOS[nextScenario].appearance);
                    window.sessionStorage.setItem(DEMO_APPEARANCE_SCENARIO_KEY, nextScenario);
                    window.location.assign(`/demo/command-center/${nextScenario}/${route}`);
                  }} className="mt-1 min-h-11 w-full rounded-[10px] bg-[var(--admin-nav-hover)] px-3 text-xs font-semibold text-[var(--admin-nav-ink)] outline-none ring-1 ring-[var(--admin-nav-rule)] focus:ring-2 focus:ring-[var(--admin-nav-accent)]">
                    {DEMO_SCENARIO_SUMMARIES.map((item) => <option key={item.id} value={item.id}>{item.category}</option>)}
                  </select>
                </label>

                <button type="button" onClick={() => setGuideOpen((current) => !current)} className="admin-nav-utility mt-1.5 flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]" aria-expanded={guideOpen} aria-label="Open guided demo">
                  <ListChecks className="size-4 shrink-0" /><span className="flex-1 text-left">Guided tour</span><span className="font-mono text-[9px] tabular-nums text-[var(--admin-nav-faint)]">{guideStep + 1}/{scenario.story.length}</span>
                </button>

                <AnimatePresence initial={false}>
                  {guideOpen && (
                    <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }} className="overflow-hidden" aria-label="Guided demo story" data-admin-demo-guide>
                      <div className="mx-1 mb-1 mt-1.5 rounded-[10px] bg-[var(--admin-nav-hover)] p-3">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-nav-faint)]">Step {guideStep + 1} of {scenario.story.length}</p>
                        <p className="mt-1.5 text-pretty text-xs font-medium leading-[1.45] text-[var(--admin-nav-ink)]">{scenario.story[guideStep]}</p>
                        <div className="mt-3 grid grid-cols-5 gap-1" aria-label="Story steps">
                          {scenario.story.map((step, index) => <button key={step} type="button" onClick={() => openGuideStep(index)} className={cn("grid size-10 place-items-center rounded-[9px] font-mono text-[10px] font-semibold tabular-nums transition-[background-color,color,transform] duration-150 active:scale-[0.96]", index === guideStep ? "admin-nav-demo-primary" : "admin-nav-utility")} aria-label={`Open story step ${index + 1}`} aria-current={index === guideStep ? "step" : undefined}>{index + 1}</button>)}
                        </div>
                        <div className="mt-3 grid grid-cols-[2.75rem_1fr_2.75rem] gap-1.5">
                          <button type="button" onClick={() => openGuideStep(Math.max(0, guideStep - 1))} disabled={guideStep === 0} className="admin-nav-utility grid size-11 place-items-center rounded-[10px] transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-30" aria-label="Previous story step"><ArrowLeft className="size-4" /></button>
                          <button type="button" onClick={() => openGuideStep(guideStep)} className="admin-nav-demo-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-xs font-semibold transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.96]">Open step <Check className="size-3.5" /></button>
                          <button type="button" onClick={() => openGuideStep(Math.min(scenario.story.length - 1, guideStep + 1))} disabled={guideStep === scenario.story.length - 1} className="admin-nav-utility grid size-11 place-items-center rounded-[10px] transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-30" aria-label="Next story step"><ArrowRight className="size-4" /></button>
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={demo.reset} className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-2 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]" aria-label="Reset this demo"><RotateCcw className="size-3.5" />Reset</button>
                  <Link href="/demo/command-center" className="admin-nav-utility inline-flex min-h-11 items-center justify-center rounded-[10px] px-2 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]">All demos</Link>
                </div>
              </div>
              <p className="px-2 text-pretty text-[9px] leading-3.5 text-[var(--admin-nav-faint)]">Fictional data. Actions stay in this browser session and never reach live systems.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
