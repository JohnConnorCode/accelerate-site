"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_SUMMARIES,
  isDemoScenarioId,
  type DemoScenarioId,
} from "@/lib/admin/demo/scenarios";
import { installAdminDemoRuntime } from "@/lib/admin/demo/runtime";
import { readDemoAppearance } from "@/lib/admin/demo/appearance-state";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { cn } from "@/lib/utils";
import { useNavigationRuntime } from "@/components/navigation/NavigationRuntime";

interface AdminDemoContextValue {
  scenarioId: DemoScenarioId;
  reset: () => void;
}

const AdminDemoContext = createContext<AdminDemoContextValue | null>(null);
export function AdminDemoBoundary({
  scenarioId,
  children,
}: {
  scenarioId: DemoScenarioId | null;
  children: React.ReactNode;
}) {
  const resetRef = useRef<null | (() => void)>(null);
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const pathnameScenario = pathname.match(/^\/demo\/command-center\/([^/]+)/)?.[1] || "";
  const activeScenarioId = isDemoScenarioId(pathnameScenario) ? pathnameScenario : scenarioId;

  if (typeof window !== "undefined" && activeScenarioId) {
    installAdminDemoRuntime(activeScenarioId);
  }

  useLayoutEffect(() => {
    if (!activeScenarioId) return;
    setTheme(readDemoAppearance(activeScenarioId));
    const runtime = installAdminDemoRuntime(activeScenarioId);
    resetRef.current = runtime.reset;
    (window as Window & { __accelerateAdminDemoRuntime?: string }).__accelerateAdminDemoRuntime =
      activeScenarioId;
    return () => {
      delete (window as Window & { __accelerateAdminDemoRuntime?: string })
        .__accelerateAdminDemoRuntime;
      resetRef.current = null;
      runtime.restore();
    };
  }, [activeScenarioId, setTheme]);

  const reset = useCallback(() => resetRef.current?.(), []);
  if (!activeScenarioId) return <>{children}</>;

  return (
    <AdminDemoContext.Provider value={{ scenarioId: activeScenarioId, reset }}>
      {children}
    </AdminDemoContext.Provider>
  );
}

export function useAdminDemo() {
  return useContext(AdminDemoContext);
}

export function AdminDemoControls({
  collapsed = false,
  controlsId = "admin-demo-controls",
}: {
  collapsed?: boolean;
  controlsId?: string;
}) {
  const demo = useContext(AdminDemoContext);
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useNavigationRuntime();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!demo) return null;
  const scenario = DEMO_SCENARIOS[demo.scenarioId];
  const publicPrefix = `/demo/command-center/${demo.scenarioId}`;
  const route = pathname.startsWith(`${publicPrefix}/`)
    ? pathname.slice(publicPrefix.length + 1)
    : pathname.startsWith("/admin/")
      ? pathname.slice("/admin/".length)
      : "today";
  const closeControls = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative", open && "z-40")}
      aria-label="Demo workspace controls"
      data-admin-demo-bar
      data-state={open ? "open" : "collapsed"}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeControls() : setOpen(true))}
        className={cn(
          "admin-nav-demo-control flex min-h-11 items-center rounded-[12px] text-left transition-[background-color,color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-nav-accent)] active:scale-[0.96]",
          collapsed ? "size-11 justify-center" : "w-full gap-2.5 px-2",
        )}
        aria-expanded={open}
        aria-controls={controlsId}
        aria-label={open ? "Hide demo controls" : "Open demo controls"}
        title={collapsed ? "Demo controls" : undefined}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,.7)]"
          style={{ backgroundColor: scenario.accent }}
        >
          <DemoScenarioMark scenarioId={demo.scenarioId} className="size-6" />
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[var(--admin-nav-ink)]">
                Demo controls
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-[var(--admin-nav-faint)]">
                {scenario.name}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-[var(--admin-nav-faint)] transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={controlsId}
            initial={collapsed ? { opacity: 0, x: -6, scale: 0.98 } : { height: 0, opacity: 0 }}
            animate={collapsed ? { opacity: 1, x: 0, scale: 1 } : { height: "auto", opacity: 1 }}
            exit={collapsed ? { opacity: 0, x: -4, scale: 0.98 } : { height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn(
              "overflow-hidden",
              collapsed &&
                "admin-demo-rail-popover absolute bottom-0 left-[calc(100%+0.65rem)] w-[17rem] rounded-[18px] p-2 shadow-[0_24px_70px_-30px_rgba(0,0,0,.72)]",
            )}
          >
            <div className={cn("space-y-2", !collapsed && "pt-2")}>
              <div className="admin-demo-control-panel rounded-[14px] p-2 shadow-[inset_0_0_0_1px_var(--admin-nav-rule)]">
                <label className="block">
                  <span className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-nav-faint)]">
                    Demo business
                  </span>
                  <select
                    aria-label="Demo business"
                    value={demo.scenarioId}
                    onChange={(event) => {
                      const nextScenario = event.target.value as DemoScenarioId;
                      navigation.beginNavigation({
                        href: `/demo/command-center/${nextScenario}/${route}`,
                        kind: "replace",
                        scroll: "top",
                      });
                      router.replace(`/demo/command-center/${nextScenario}/${route}`, {
                        scroll: false,
                      });
                    }}
                    className="mt-1 min-h-11 w-full rounded-[10px] bg-[var(--admin-nav-hover)] px-3 text-xs font-semibold text-[var(--admin-nav-ink)] outline-none ring-1 ring-[var(--admin-nav-rule)] focus:ring-2 focus:ring-[var(--admin-nav-accent)]"
                  >
                    {DEMO_SCENARIO_SUMMARIES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.category}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={demo.reset}
                    className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-2 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
                    aria-label="Reset this demo"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset
                  </button>
                  <Link
                    href="/demo/command-center"
                    className="admin-nav-utility inline-flex min-h-11 items-center justify-center rounded-[10px] px-2 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
                  >
                    All demos
                  </Link>
                </div>
              </div>
              <p className="px-2 text-pretty text-[9px] leading-3.5 text-[var(--admin-nav-faint)]">
                Fictional data. Actions stay in this browser session and never reach live systems.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
