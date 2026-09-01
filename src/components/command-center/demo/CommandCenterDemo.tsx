"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion as useFramerReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { Variants } from "framer-motion";
import {
  MessageSquareWarning,
  Inbox,
  Users,
  Columns3,
  Sparkles,
  FileText,
  Check,
  Pencil,
  X,
  Sun,
  Mail,
  Building2,
  Share2,
  FolderKanban,
  CheckSquare,
  Files,
  Newspaper,
  HelpCircle,
  BarChart3,
  History,
  Workflow,
  Plug,
  RotateCcw,
  ShieldCheck,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "@/lib/animations";
import { ActionModal } from "./ActionModal";
import {
  ACTION_KIND,
  DEMO_ACTIONS,
  DEMO_ANSWERS,
  DEMO_EXTRACTED,
  DEMO_PEOPLE,
  DEMO_PIPELINE,
  DEMO_TRANSCRIPT,
  OVERNIGHT,
  RAIL,
  STUBS,
  type DemoAction,
} from "./demo-data";
import {
  DEMO_INTEGRATIONS,
  DEMO_SCENARIOS,
  type DemoOutcome,
  type DemoScenarioId,
} from "./demo-contract";
import { resetDemoSession, useDemoSessionState } from "./demo-session";

/* An interactive mock of the Command Center, with invented data.

   Everything is client state; nothing calls anything. The point is that a
   visitor can work the queue, open a person, ask a question and apply a
   meeting rather than read a paragraph claiming those things are possible.

   Motion is deliberate here: every view enters on a stagger, the rail marker
   slides between tabs, answers stream in word by word. A tool that claims to
   run your business should not feel like a slide deck. All of it collapses to
   plain state changes under prefers-reduced-motion. */

const ICONS: Record<string, LucideIcon> = {
  Sun,
  Inbox,
  Mail,
  Users,
  Building2,
  Columns3,
  Share2,
  FolderKanban,
  CheckSquare,
  FileText,
  Files,
  Sparkles,
  Newspaper,
  HelpCircle,
  BarChart3,
  History,
  Workflow,
  Plug,
  Settings,
};

const MONO = "font-mono text-[0.62rem] uppercase tracking-[0.16em]";
/* Citations stay sentence case. The uppercase label style turns a quiet
   "here is where this came from" into shouting. */
const CITE = "font-mono text-[0.68rem] tracking-[0.01em]";

// Framer resolves the media query during client hydration while SSR has no
// preference. Deferring that preference by one paint avoids a style mismatch
// (and a dev overlay) for people who explicitly prefer reduced motion.
function useDemoReducedMotion() {
  const preference = useFramerReducedMotion();
  const [mounted, setMounted] = useState(false);
  // The client-only media preference intentionally follows the SSR-safe first paint.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted && preference;
}

/* One motion vocabulary, shared by every view. */
const VIEW: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE, staggerChildren: 0.05, delayChildren: 0.04 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
};

const CORE_DEMO_VIEWS = new Set(["today", "approvals", "people", "ask", "meeting"]);

export function CommandCenterDemo({ standalone = false }: { standalone?: boolean }) {
  const [view, setView, demoHydrated] = useDemoSessionState<string>("view", "approvals");
  const [approved, setApproved] = useDemoSessionState("approved", 11);
  const [pending, setPending] = useDemoSessionState("pending", DEMO_ACTIONS.length);
  const [visited, setVisited] = useDemoSessionState<string[]>("visited", ["approvals"]);
  const [scenarioId, setScenarioId] = useDemoSessionState<DemoScenarioId>(
    "scenario",
    "revenue-recovery",
  );
  const [scenarioStep, setScenarioStep] = useDemoSessionState("scenario-step", 0);
  const [outcomes, setOutcomes] = useDemoSessionState<DemoOutcome[]>("outcomes", []);
  const reduced = useDemoReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const scenario =
    DEMO_SCENARIOS.find((candidate) => candidate.id === scenarioId) ?? DEMO_SCENARIOS[0]!;

  const selectView = (next: string) => {
    setView(next);
    if (CORE_DEMO_VIEWS.has(next))
      setVisited((current) => (current.includes(next) ? current : [...current, next]));
  };

  const reset = () => {
    resetDemoSession();
    setView("approvals");
  };

  const selectScenario = (next: DemoScenarioId) => {
    const nextScenario =
      DEMO_SCENARIOS.find((candidate) => candidate.id === next) ?? DEMO_SCENARIOS[0]!;
    setScenarioId(nextScenario.id);
    setScenarioStep(0);
    selectView(nextScenario.steps[0]!.view);
  };

  const advanceScenario = () => {
    const nextStep = Math.min(scenarioStep + 1, scenario.steps.length - 1);
    setScenarioStep(nextStep);
    selectView(scenario.steps[nextStep]!.view);
  };

  const recordOutcome = (outcome: DemoOutcome) => {
    setOutcomes((current) =>
      current.some((item) => item.key === outcome.key) ? current : [outcome, ...current],
    );
  };

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [-1, 1], [1.5, -1.5]);
  const rotateY = useTransform(smoothX, [-1, 1], [-1.5, 1.5]);

  const handlePointerMove = (e: React.PointerEvent) => {
    // A 3D tilt is a desktop affordance. Updating springs while a finger is
    // dragging the document makes the demo feel attached to the scroll.
    if (e.pointerType !== "mouse" || !ref.current || reduced) return;
    const rect = ref.current.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseX.set(normX);
    mouseY.set(normY);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      data-demo-interactive={demoHydrated ? "true" : "false"}
      aria-busy={!demoHydrated}
      inert={!demoHydrated}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={reduced ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`cc overflow-hidden rounded-[14px] border border-white/10 bg-[#0B0B0B] shadow-[0_40px_90px_-40px_rgba(0,0,0,.55)] transition-[box-shadow,transform] duration-300 ${standalone ? "min-h-[min(720px,calc(100vh-120px))] sm:min-h-[min(780px,calc(100vh-180px))]" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          </span>
          <span className={`${MONO} truncate text-white/45`}>
            <span className="text-white/75 sm:hidden">Workspace</span>
            <span className="hidden sm:inline">
              <span className="text-white/75">Command Center</span> / your workspace
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`${MONO} inline-flex min-h-11 items-center gap-1.5 rounded-[8px] bg-[rgb(163,230,53)]/10 px-2.5 text-[rgb(190,242,100)]`}
          >
            <ShieldCheck className="size-3.5" /> Safe demo
          </span>
          <button
            type="button"
            onClick={reset}
            className={`${MONO} inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-white/15 px-2.5 text-white/55 transition-[border-color,color,transform] hover:border-white/35 hover:text-white active:scale-[0.96]`}
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-white/10 bg-white/[0.025] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4 sm:items-center">
        <p className="text-pretty text-[0.76rem] leading-relaxed text-white/55">
          Fictional sample data. Every approval, message, calendar change, and record update is
          simulated in this browser only.
        </p>
        <div
          className="flex items-center gap-2"
          aria-label={`${Math.min(visited.length, 5)} of 5 core demo views explored`}
        >
          <span className={`${MONO} tabular-nums text-white/40`}>
            {Math.min(visited.length, 5)} / 5 explored
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-5 rounded-full transition-colors duration-200 ${index < visited.length ? "bg-[rgb(163,230,53)]" : "bg-white/12"}`}
              />
            ))}
          </span>
        </div>
      </div>

      {standalone && (
        <DemoGuide
          scenario={scenario}
          scenarioStep={scenarioStep}
          outcomes={outcomes}
          onScenario={selectScenario}
          onAdvance={advanceScenario}
        />
      )}

      <div className="border-b border-white/10 p-2 lg:hidden">
        <label className="sr-only" htmlFor="command-center-demo-view">
          Demo view
        </label>
        <select
          id="command-center-demo-view"
          value={view}
          onChange={(event) => selectView(event.target.value)}
          className="min-h-11 w-full appearance-none rounded-[10px] bg-white/[0.07] bg-[linear-gradient(45deg,transparent_50%,rgba(255,255,255,.6)_50%),linear-gradient(135deg,rgba(255,255,255,.6)_50%,transparent_50%)] bg-[position:calc(100%-18px)_20px,calc(100%-13px)_20px] bg-[size:5px_5px,5px_5px] bg-no-repeat px-3 pr-9 font-mono text-[0.65rem] uppercase tracking-[0.13em] text-white outline-none transition-[background-color,box-shadow] focus:bg-white/[0.11] focus:shadow-[0_0_0_2px_rgba(255,255,255,.26)]"
        >
          {RAIL.map((group) => (
            <optgroup key={group.label} label={group.label} className="bg-[#0B0B0B] text-white">
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-[212px_1fr]">
        <nav
          aria-label="Command Center sections"
          className="cc-rail hidden border-r border-white/10 p-3 lg:block lg:overflow-y-auto"
        >
          {RAIL.map((group) => (
            <div key={group.label} className="contents lg:mb-3 lg:block lg:last:mb-0">
              <p className={`${MONO} hidden px-3 pb-1.5 pt-2 text-white/25 lg:block`}>
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Inbox;
                const on = view === item.id;
                const count =
                  item.id === "approvals"
                    ? pending > 0
                      ? String(pending)
                      : undefined
                    : item.badge;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectView(item.id)}
                    aria-current={on ? "page" : undefined}
                    className={`relative flex shrink-0 items-center gap-2.5 px-3 py-[7px] text-left text-[0.78rem] transition-colors duration-200 lg:w-full ${
                      on ? "text-white" : "text-white/45 hover:text-white/85"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId={reduced ? undefined : "cc-rail-marker"}
                        className="absolute inset-0 bg-white/10"
                        transition={{ duration: 0.3, ease: EASE }}
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="relative h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                    <span className="relative whitespace-nowrap">{item.label}</span>
                    {count && (
                      <motion.span
                        key={count}
                        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.26, ease: EASE }}
                        className="relative ml-auto hidden rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[0.58rem] text-white lg:inline"
                      >
                        {count}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="min-h-[420px] min-w-0 sm:min-h-[600px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              variants={reduced ? undefined : VIEW}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {view === "today" && (
                <Today pending={pending} outcomes={outcomes} onNavigate={selectView} />
              )}
              {view === "approvals" && (
                <Approvals
                  approved={approved}
                  setApproved={setApproved}
                  setPending={setPending}
                  onOutcome={recordOutcome}
                />
              )}
              {view === "people" && <People outcomes={outcomes} />}
              {view === "pipeline" && <Pipeline outcomes={outcomes} />}
              {view === "ask" && <Ask />}
              {view === "meeting" && <Meeting onOutcome={recordOutcome} />}
              {view === "tasks" && <TasksWorkspace outcomes={outcomes} onOutcome={recordOutcome} />}
              {view === "brief" && <DailyBrief outcomes={outcomes} onOutcome={recordOutcome} />}
              {view === "activity" && <ActivityLog outcomes={outcomes} />}
              {view === "integrations" && <IntegrationWorkspace onOutcome={recordOutcome} />}
              {view !== "today" &&
                view !== "tasks" &&
                view !== "brief" &&
                view !== "activity" &&
                view !== "integrations" &&
                STUBS[view] && <Stub id={view} outcomes={outcomes} onOutcome={recordOutcome} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function DemoGuide({
  scenario,
  scenarioStep,
  outcomes,
  onScenario,
  onAdvance,
}: {
  scenario: (typeof DEMO_SCENARIOS)[number];
  scenarioStep: number;
  outcomes: DemoOutcome[];
  onScenario: (id: DemoScenarioId) => void;
  onAdvance: () => void;
}) {
  const step = scenario.steps[scenarioStep] ?? scenario.steps[0]!;
  const lastStep = scenarioStep === scenario.steps.length - 1;
  const completionKeys = scenario.steps.flatMap((candidate) =>
    candidate.completionKey ? [candidate.completionKey] : [],
  );
  const complete =
    completionKeys.length > 0 &&
    completionKeys.every((key) =>
      outcomes.some((outcome) =>
        key.endsWith("*") ? outcome.key.startsWith(key.slice(0, -1)) : outcome.key === key,
      ),
    );
  return (
    <section
      className="border-b border-white/10 bg-[rgb(163,230,53)]/[0.045] px-4 py-3 sm:px-5"
      aria-label="Guided demo controls"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className={`${MONO} text-[rgb(190,242,100)]`}>{scenario.eyebrow}</p>
            <span className={`${CITE} tabular-nums text-white/35`}>
              {scenarioStep + 1} / {scenario.steps.length}
            </span>
            {outcomes.length > 0 && (
              <span className={`${CITE} text-white/45`}>
                {outcomes.length} simulated receipt{outcomes.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[0.88rem] font-medium text-white">{step.title}</p>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-white/55">{step.detail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="command-center-demo-scenario">
            Demo scenario
          </label>
          <select
            id="command-center-demo-scenario"
            aria-label="Demo scenario"
            value={scenario.id}
            onChange={(event) => onScenario(event.target.value as DemoScenarioId)}
            className="min-h-10 rounded-[8px] border border-white/14 bg-black/20 px-3 font-mono text-[0.62rem] uppercase tracking-[0.11em] text-white outline-none transition-[border-color,background-color] focus:border-white/45 focus:bg-black/35"
          >
            {DEMO_SCENARIOS.map((candidate) => (
              <option key={candidate.id} value={candidate.id} className="bg-[#0B0B0B]">
                {candidate.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdvance}
            disabled={lastStep}
            className="min-h-10 rounded-[8px] border border-[rgb(190,242,100)]/45 bg-[rgb(163,230,53)]/12 px-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[rgb(220,252,160)] transition-[border-color,background-color,transform] hover:border-[rgb(190,242,100)] hover:bg-[rgb(163,230,53)]/20 active:scale-[0.96] disabled:cursor-default disabled:opacity-45"
          >
            {lastStep ? "Story complete" : "Next step"}
          </button>
        </div>
      </div>
      {complete && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="mt-3 grid gap-3 rounded-[12px] bg-[rgb(163,230,53)]/[0.09] p-3.5 shadow-[inset_0_0_0_1px_rgba(190,242,100,0.16)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="min-w-0">
            <p className={`${MONO} text-[rgb(190,242,100)]`}>Simulated outcome recorded</p>
            <p className="mt-1.5 text-[0.88rem] font-medium text-white">{scenario.outcome}</p>
            <p className="mt-1.5 max-w-3xl text-[0.78rem] leading-relaxed text-white/60">
              {scenario.buyerTakeaway}
            </p>
          </div>
          <a
            href="/contact"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[rgb(190,242,100)]/45 bg-black/25 px-3 font-mono text-[0.62rem] uppercase tracking-[0.11em] text-[rgb(220,252,160)] transition-[border-color,background-color,transform] hover:border-[rgb(190,242,100)] hover:bg-black/40 active:scale-[0.96]"
          >
            Discuss your operation <ArrowUpRight className="size-3.5" />
          </a>
        </motion.div>
      )}
    </section>
  );
}

/* ── today ─────────────────────────────────────────────────────────────── */

function Today({
  pending,
  outcomes,
  onNavigate,
}: {
  pending: number;
  outcomes: DemoOutcome[];
  onNavigate: (view: string) => void;
}) {
  const reduced = useDemoReducedMotion();

  return (
    <div className="flex h-full flex-col">
      <Head
        title="Today"
        sub="Your operational overview. The system has already organized your morning."
        right="Updated just now"
      />
      <div className="cc-scroll flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* Top metrics */}
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <p className={`${MONO} text-white/35`}>Inbox Zero</p>
            <p className="mt-2 text-2xl font-light text-white">14</p>
            <p className="mt-1 text-[0.7rem] text-[rgb(163,230,53)]">✦ Processed overnight</p>
          </div>
          <div className="border border-[rgb(163,230,53)]/30 bg-[rgb(163,230,53)]/[0.05] p-3 transition-colors">
            <p className={`${MONO} text-white/35`}>Needs Approval</p>
            <p className="mt-2 text-2xl font-light text-white tabular-nums">{pending}</p>
            <p className="mt-1 text-[0.7rem] text-[rgb(163,230,53)]">Drafts ready to review</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <p className={`${MONO} text-white/35`}>Meetings</p>
            <p className="mt-2 text-2xl font-light text-white">2</p>
            <p className="mt-1 text-[0.7rem] text-white/45">Next at 10:00 AM</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <p className={`${MONO} text-white/35`}>Pipeline Risk</p>
            <p className="mt-2 text-2xl font-light text-[#F87171]">1</p>
            <p className="mt-1 text-[0.7rem] text-white/45">Atwell Construction</p>
          </div>
        </motion.div>

        {/* Priority items */}
        <motion.div variants={reduced ? undefined : ITEM}>
          <Sub>High Priority Context</Sub>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onNavigate("approvals")}
              className="flex w-full gap-4 border-l-2 border-[rgb(163,230,53)] bg-white/[0.03] p-3.5 text-left transition-colors hover:bg-white/[0.07]"
            >
              <div className="mt-0.5 text-[rgb(163,230,53)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[0.88rem] font-medium text-white">Northwind Proposal Ready</p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-white/60">
                  I&apos;ve generated the revised scope based on yesterday&apos;s kickoff call. The
                  reporting section is split out as requested. It is waiting in your Approvals
                  queue.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("people")}
              className="flex w-full gap-4 border-l-2 border-[#F87171] bg-white/[0.03] p-3.5 text-left transition-colors hover:bg-white/[0.07]"
            >
              <div className="mt-0.5 text-[#F87171]">
                <MessageSquareWarning className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[0.88rem] font-medium text-white">Ray Atwell is going cold</p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-white/60">
                  Invoice 2043 is 18 days overdue. Two automated emails have gone unanswered. I have
                  drafted a direct escalation email for you.
                </p>
              </div>
            </button>
          </div>
        </motion.div>

        {outcomes.length > 0 && (
          <motion.div variants={reduced ? undefined : ITEM}>
            <Sub>Latest simulated receipt</Sub>
            <div className="border border-[rgb(163,230,53)]/20 bg-[rgb(163,230,53)]/[0.045] p-3.5">
              <p className="text-[0.84rem] text-white">{outcomes[0]!.title}</p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-white/55">
                {outcomes[0]!.detail}
              </p>
              <button
                type="button"
                onClick={() => onNavigate("activity")}
                className={`${CITE} mt-2 text-[rgb(190,242,100)] underline underline-offset-4`}
              >
                Inspect receipt
              </button>
            </div>
          </motion.div>
        )}

        {/* Schedule */}
        <motion.div variants={reduced ? undefined : ITEM}>
          <Sub>Schedule & Briefings</Sub>
          <div className="space-y-3">
            <div className="flex items-start gap-4 border-b border-white/5 pb-3">
              <div className={`${MONO} w-16 shrink-0 pt-0.5 text-white/50`}>10:00</div>
              <div className="flex-1">
                <p className="text-[0.85rem] text-white">Halcyon Legal Intake Review</p>
                <p className="mt-0.5 text-[0.78rem] text-white/45">Zoom • 45m</p>
                <div className="mt-2 inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-1 transition-colors hover:bg-white/10">
                  <FileText className="h-3 w-3 text-[rgb(163,230,53)]" />
                  <span className="text-[0.75rem] text-white/70">Pre-call briefing ready</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4 border-b border-white/5 pb-3">
              <div className={`${MONO} w-16 shrink-0 pt-0.5 text-white/50`}>14:30</div>
              <div className="flex-1">
                <p className="text-[0.85rem] text-white">Brightwater Site Walkthrough</p>
                <p className="mt-0.5 text-[0.78rem] text-white/45">On-site • 2h</p>
                <p className={`${CITE} mt-1.5 text-white/35`}>
                  <span className="text-[rgb(163,230,53)]">✦</span> Voice notes will automatically
                  sync to CRM upon completion.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── approvals ─────────────────────────────────────────────────────────── */

function Approvals({
  approved,
  setApproved,
  setPending,
  onOutcome,
}: {
  approved: number;
  setApproved: (fn: (n: number) => number) => void;
  setPending: (n: number) => void;
  onOutcome: (outcome: DemoOutcome) => void;
}) {
  const [queue, setQueue] = useDemoSessionState<DemoAction[]>("approval-queue", DEMO_ACTIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"detail" | "feedback">("detail");
  const [taught, setTaught] = useDemoSessionState("approval-taught", 0);
  const [bodies, setBodies] = useDemoSessionState<Record<string, string>>("approval-bodies", {});
  const [edited, setEdited] = useDemoSessionState<string[]>("approval-edited", []);
  const [last, setLast] = useDemoSessionState<string | null>("approval-last", null);
  const reduced = useDemoReducedMotion();

  useEffect(() => setPending(queue.length), [queue.length, setPending]);

  const resolve = (item: DemoAction, how: "approved" | "skipped") => {
    setQueue((q) => q.filter((x) => x.id !== item.id));
    setOpenId(null);
    setMode("detail");
    setLast(`${how === "approved" ? "Approved" : "Skipped"}: ${item.title}`);
    if (how === "approved") {
      setApproved((n) => n + 1);
      onOutcome({
        key: `approved:${item.id}`,
        title: `Approved: ${item.title}`,
        detail:
          item.id === "act-3"
            ? "Northwind moved to Proposal Sent using the buyer signal attached to the recommendation."
            : "The proposed work was approved in this fictional workspace. No external message, calendar change, or live record was touched.",
        source: item.source,
        at: "09:14",
      });
    }
  };

  const approveRoutine = () => {
    const routine = queue.filter((q) => q.routine);
    if (routine.length === 0) return;
    setQueue((q) => q.filter((x) => !x.routine));
    setApproved((n) => n + routine.length);
    setLast(`Approved ${routine.length} routine items in one go`);
    routine.forEach((item) =>
      onOutcome({
        key: `approved:${item.id}`,
        title: `Approved routine work: ${item.title}`,
        detail:
          "The action was accepted in this fictional workspace and is visible as a simulated receipt.",
        source: item.source,
        at: "09:16",
      }),
    );
  };

  const routineLeft = queue.filter((q) => q.routine).length;

  return (
    <div className="flex h-full flex-col">
      <Head
        title={queue.length > 0 ? `${queue.length} waiting on you` : "Queue clear"}
        sub={
          queue.length > 0
            ? "Approve sends it. Edit changes it first. Skip throws it away."
            : "This is what the end of a morning is supposed to look like."
        }
        right={
          taught > 0 ? `Approved ${approved} / taught it ${taught}` : `Approved today ${approved}`
        }
      />

      {/* what it did overnight without asking anyone */}
      <motion.ul
        variants={reduced ? undefined : ITEM}
        className="grid grid-cols-2 gap-px border-b border-white/10 bg-white/[0.06] sm:grid-cols-4"
      >
        {OVERNIGHT.map((o) => (
          <li key={o.label} className="bg-[#0B0B0B] px-4 py-3">
            <p className="font-display text-[1.05rem] font-semibold leading-none text-white">
              {o.n}
            </p>
            <p className={`${CITE} mt-1.5 text-white/35`}>{o.label}</p>
          </li>
        ))}
      </motion.ul>

      {routineLeft > 1 && (
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-5"
        >
          <button
            type="button"
            onClick={approveRoutine}
            className="border border-white/25 bg-white/[0.08] px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/20"
          >
            Approve {routineLeft} routine
          </button>
          <span className={`${CITE} text-white/35`}>
            The kind that graduates out of this queue first.
          </span>
        </motion.div>
      )}

      <div className="flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          {queue.map((item) => {
            const k = ACTION_KIND[item.kind];
            return (
              <motion.div
                key={item.id}
                layout={!reduced}
                variants={reduced ? undefined : ITEM}
                initial={reduced ? false : "hidden"}
                animate="show"
                exit={
                  reduced
                    ? undefined
                    : { opacity: 0, x: 26, transition: { duration: 0.24, ease: EASE } }
                }
                className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5"
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
                  <span
                    className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center font-mono text-[0.7rem]"
                    style={{ color: `rgb(${k.rgb})`, background: `rgba(${k.rgb},0.14)` }}
                    aria-hidden="true"
                  >
                    {k.glyph}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("detail");
                      setOpenId(item.id);
                    }}
                    aria-label={`Open details for ${item.title}`}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[0.9rem] leading-snug text-white underline-offset-4 hover:underline">
                      {item.title}
                      {edited.includes(item.id) && (
                        <span className={`${MONO} ml-2 align-middle text-white/40`}>edited</span>
                      )}
                    </p>
                    <p className="mt-1 text-[0.78rem] leading-snug text-white/45">{item.because}</p>
                    <p className={`${CITE} mt-2 text-white/30`}>{item.source}</p>
                  </button>

                  <div className="flex w-full gap-1.5 pl-[34px] sm:w-auto sm:shrink-0 sm:pl-0">
                    <Btn tone="solid" icon={Check} onClick={() => resolve(item, "approved")}>
                      Approve
                    </Btn>
                    <Btn
                      icon={Pencil}
                      onClick={() => {
                        setMode("detail");
                        setOpenId(item.id);
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn
                      icon={MessageSquareWarning}
                      onClick={() => {
                        setMode("feedback");
                        setOpenId(item.id);
                      }}
                    >
                      Feedback
                    </Btn>
                    <Btn icon={X} onClick={() => resolve(item, "skipped")}>
                      Skip
                    </Btn>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {queue.length === 0 && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
            className="px-5 py-16 text-center"
          >
            <p className="text-[0.95rem] text-white/80">Nothing left waiting.</p>
            <p className="mx-auto mt-2 max-w-sm text-[0.82rem] leading-relaxed text-white/45">
              It keeps working while the queue is empty. The next batch builds itself out of your
              calls and email as they happen.
            </p>
            <button
              type="button"
              onClick={() => {
                setQueue(DEMO_ACTIONS);
                setEdited([]);
                setBodies({});
                setLast(null);
                setOpenId(null);
              }}
              className="mt-5 border border-white/20 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              Refill the demo queue
            </button>
          </motion.div>
        )}
      </div>

      <ActionModal
        action={queue.find((q) => q.id === openId) ?? null}
        body={openId ? (bodies[openId] ?? queue.find((q) => q.id === openId)?.draft ?? "") : ""}
        edited={openId ? edited.includes(openId) : false}
        onBody={(v) => {
          if (!openId) return;
          setBodies((b) => ({ ...b, [openId]: v }));
          setEdited((e) => (e.includes(openId) ? e : [...e, openId]));
        }}
        onApprove={() => {
          const it = queue.find((q) => q.id === openId);
          if (it) resolve(it, "approved");
        }}
        onSkip={() => {
          const it = queue.find((q) => q.id === openId);
          if (it) resolve(it, "skipped");
        }}
        mode={mode}
        onFeedback={(reasonLabel, learned) => {
          const it = queue.find((q) => q.id === openId);
          setQueue((q) => q.filter((x) => x.id !== openId));
          setOpenId(null);
          setMode("detail");
          setTaught((n) => n + 1);
          setLast(`Rejected: ${it?.title ?? ""} (${reasonLabel}). ${learned}`);
        }}
        onClose={() => {
          setOpenId(null);
          setMode("detail");
        }}
      />

      <AnimatePresence>
        {last && (
          <motion.p
            key={last}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={`${CITE} border-t border-white/10 px-4 py-3 text-white/45 sm:px-5`}
          >
            {last}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── people ────────────────────────────────────────────────────────────── */

const TEMP: Record<string, { label: string; rgb: string }> = {
  warm: { label: "Warm", rgb: "163,230,53" },
  cooling: { label: "Cooling", rgb: "251,191,36" },
  cold: { label: "Cold", rgb: "248,113,113" },
};

const TL_ICON: Record<string, string> = {
  "email-in": "←",
  "email-out": "→",
  meeting: "◆",
  note: "★",
  ai: "✦",
};

function People({ outcomes }: { outcomes: DemoOutcome[] }) {
  const [sel, setSel] = useDemoSessionState("selected-person", DEMO_PEOPLE[0]!.id);
  const person = DEMO_PEOPLE.find((p) => p.id === sel)!;
  const reduced = useDemoReducedMotion();

  return (
    <div>
      <Head title="People" sub="Everything the business knows about someone, in one place." />
      <div className="grid sm:grid-cols-[196px_1fr]">
        <ul className="relative border-b border-white/10 sm:border-b-0 sm:border-r">
          {DEMO_PEOPLE.map((p) => {
            const on = p.id === sel;
            const t = TEMP[p.temp]!;
            return (
              <li key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSel(p.id)}
                  className="relative w-full border-b border-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/5"
                >
                  {on && (
                    <motion.span
                      layoutId={reduced ? undefined : "cc-person-marker"}
                      className="absolute inset-0 bg-white/10"
                      transition={{ duration: 0.3, ease: EASE }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: `rgb(${t.rgb})` }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[0.84rem] text-white">{p.name}</span>
                  </span>
                  <span className={`${CITE} relative mt-1 block truncate text-white/35`}>
                    {p.last}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={person.id}
            variants={reduced ? undefined : VIEW}
            initial="hidden"
            animate="show"
            exit="exit"
            className="min-w-0 p-4 sm:p-5"
          >
            <motion.div
              variants={reduced ? undefined : ITEM}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            >
              <h4 className="font-display text-[1.15rem] font-semibold text-white">
                {person.name}
              </h4>
              <span className="text-[0.8rem] text-white/45">
                {person.role}, {person.company}
              </span>
              <span
                className={`${MONO} ml-auto px-2 py-1`}
                style={{
                  color: `rgb(${TEMP[person.temp]!.rgb})`,
                  background: `rgba(${TEMP[person.temp]!.rgb},0.12)`,
                }}
              >
                {TEMP[person.temp]!.label}
              </span>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>What it has learned</Sub>
              <dl className="space-y-2">
                {person.facts.map((f) => (
                  <div key={f.k} className="grid gap-1 sm:grid-cols-[136px_1fr] sm:gap-3">
                    <dt className={`${CITE} pt-0.5 text-white/35`}>{f.k}</dt>
                    <dd className="text-[0.82rem] leading-snug text-white/75">{f.v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>Open questions</Sub>
              <ul className="space-y-1.5">
                {person.open.map((q) => (
                  <li key={q} className="flex gap-2 text-[0.82rem] leading-snug text-white/75">
                    <span className="text-white/30" aria-hidden="true">
                      ?
                    </span>
                    {q}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>History</Sub>
              <ul className="space-y-2.5">
                {person.id === "p1" &&
                  outcomes
                    .filter((outcome) => outcome.key.startsWith("approved:"))
                    .map((outcome) => (
                      <li key={outcome.key} className="grid grid-cols-[62px_16px_1fr] gap-2">
                        <span className={`${CITE} pt-0.5 text-white/30`}>{outcome.at}</span>
                        <span
                          className="pt-0.5 font-mono text-[0.7rem] text-[rgb(163,230,53)]"
                          aria-hidden="true"
                        >
                          ✦
                        </span>
                        <span className="text-[0.82rem] leading-snug italic text-white/65">
                          {outcome.title}. {outcome.detail}
                        </span>
                      </li>
                    ))}
                {person.timeline.map((e, i) => (
                  <li key={i} className="grid grid-cols-[62px_16px_1fr] gap-2">
                    <span className={`${CITE} pt-0.5 text-white/30`}>{e.when}</span>
                    <span
                      className={`pt-0.5 font-mono text-[0.7rem] ${
                        e.kind === "ai" ? "text-[rgb(163,230,53)]" : "text-white/35"
                      }`}
                      aria-hidden="true"
                    >
                      {TL_ICON[e.kind]}
                    </span>
                    <span
                      className={`text-[0.82rem] leading-snug ${
                        e.kind === "ai" ? "italic text-white/55" : "text-white/80"
                      }`}
                    >
                      {e.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── pipeline ──────────────────────────────────────────────────────────── */

function Pipeline({ outcomes }: { outcomes: DemoOutcome[] }) {
  const reduced = useDemoReducedMotion();
  const northwindMoved = outcomes.some((outcome) => outcome.key === "approved:act-3");
  const columns = DEMO_PIPELINE.map((column) => ({ ...column, deals: [...column.deals] }));
  if (northwindMoved) {
    const source = columns.find((column) => column.stage === "In conversation");
    const destination = columns.find((column) => column.stage === "Proposal sent");
    const moved = source?.deals.find((deal) => deal.id === "d1");
    if (moved && source && destination) {
      source.deals = source.deals.filter((deal) => deal.id !== moved.id);
      destination.deals = [{ ...moved, age: "just moved" }, ...destination.deals];
    }
  }
  return (
    <div>
      <Head
        title="Pipeline"
        sub="Moved by what people actually said, not by you remembering to drag a card."
      />
      <div className="cc-scroll flex gap-3 overflow-x-auto p-4 sm:p-5">
        {columns.map((col) => (
          <motion.div
            key={col.stage}
            variants={reduced ? undefined : ITEM}
            className="w-[214px] shrink-0"
          >
            <p className={`${MONO} mb-2 flex items-center justify-between text-white/40`}>
              {col.stage}
              <span className="text-white/25">{col.deals.length}</span>
            </p>
            <div className="space-y-2">
              {col.deals.map((d) => (
                <motion.div
                  key={d.id}
                  whileHover={reduced ? undefined : { y: -2 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-white/25"
                >
                  <p className="text-[0.84rem] leading-snug text-white">{d.name}</p>
                  <p className="mt-0.5 text-[0.76rem] text-white/45">{d.company}</p>
                  <p className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[0.78rem] text-white">{d.value}</span>
                    <span className={`${CITE} text-white/30`}>{d.age}</span>
                  </p>
                  {d.flag && (
                    <p
                      className={`${MONO} mt-2 inline-block px-1.5 py-0.5`}
                      style={{ color: "rgb(251,191,36)", background: "rgba(251,191,36,0.12)" }}
                    >
                      {d.flag}
                    </p>
                  )}
                  {northwindMoved && d.id === "d1" && (
                    <p className={`${CITE} mt-2 text-[rgb(190,242,100)]`}>
                      ✦ Moved from approved buyer signal
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── ask ───────────────────────────────────────────────────────────────── */

interface Turn {
  role: "you" | "ai";
  text: string;
  sources?: string[];
}

function Ask() {
  const [turns, setTurns] = useDemoSessionState<Turn[]>("ask-turns", []);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const reduced = useDemoReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const send = (q: string) => {
    if (!q.trim() || thinking) return;
    const hit = findDemoAnswer(q);
    setTurns((t) => [...t, { role: "you", text: q.trim() }]);
    setInput("");
    setThinking(true);
    timers.current.push(
      setTimeout(() => {
        setTurns((t) => [
          ...t,
          hit
            ? { role: "ai", text: hit.a, sources: hit.sources }
            : {
                role: "ai",
                text: "In the real thing this reads your own records and answers from them, with a source on every claim. This mock only carries a few canned answers, so try one of the suggestions.",
              },
        ]);
        setThinking(false);
      }, 700),
    );
  };

  return (
    <div className="flex h-full min-h-[380px] flex-col sm:min-h-[600px]">
      <Head
        title="Ask"
        sub="It answers from your records, and shows you where each answer came from."
      />

      <div className="cc-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <AnimatePresence initial={false}>
          {turns.length === 0 && (
            <motion.div
              key="suggestions"
              variants={reduced ? undefined : ITEM}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              {DEMO_ANSWERS.map((a) => (
                <button
                  key={a.q}
                  type="button"
                  onClick={() => send(a.q)}
                  className="border border-white/15 px-3 py-2 text-left text-[0.8rem] text-white/70 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white"
                >
                  {a.q}
                </button>
              ))}
            </motion.div>
          )}

          {turns.map((t, i) =>
            t.role === "you" ? (
              <motion.p
                key={`u${i}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="ml-auto max-w-[85%] bg-white/10 px-3.5 py-2.5 text-[0.85rem] text-white"
              >
                {t.text}
              </motion.p>
            ) : (
              <motion.div
                key={`a${i}`}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-[92%]"
              >
                <Streamed text={t.text} reduced={!!reduced} />
                {t.sources && (
                  <motion.ul
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : 0.5, duration: 0.3, ease: EASE }}
                    className="mt-2.5 space-y-1"
                  >
                    {t.sources.map((s) => (
                      <li key={s} className={`${CITE} flex gap-2 text-white/40`}>
                        <span className="text-[rgb(163,230,53)]" aria-hidden="true">
                          ✦
                        </span>
                        {s}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </motion.div>
            ),
          )}
        </AnimatePresence>

        {thinking && <Thinking reduced={!!reduced} />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your business"
          aria-label="Ask the Command Center"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[0.85rem] text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 border border-white/20 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/45 hover:text-white"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function findDemoAnswer(question: string) {
  const normalized = question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const exact = DEMO_ANSWERS.find(
    (answer) =>
      answer.q
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim() === normalized,
  );
  if (exact) return exact;
  if (
    normalized.includes("northwind") &&
    /(agree|agreed|commit|promise|scope|start)/.test(normalized)
  )
    return DEMO_ANSWERS[0];
  if (/(cold|risk|quiet|at risk|follow up)/.test(normalized)) return DEMO_ANSWERS[1];
  if (normalized.includes("dana") && /(draft|follow|reply|email)/.test(normalized))
    return DEMO_ANSWERS[2];
  return undefined;
}

/** Answers arrive word by word. An answer that appears all at once reads as a
 *  lookup; one that streams reads as something working. */
function Streamed({ text, reduced }: { text: string; reduced: boolean }) {
  const words = text.split(" ");
  if (reduced) return <p className="text-[0.87rem] leading-relaxed text-white/85">{text}</p>;
  return (
    <p className="text-[0.87rem] leading-relaxed text-white/85">
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.018, duration: 0.18 }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </p>
  );
}

function Thinking({ reduced }: { reduced: boolean }) {
  return (
    <p className={`${CITE} flex items-center gap-2 text-white/35`}>
      Reading your records
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-white/50"
            animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </span>
    </p>
  );
}

/* ── meeting extraction ────────────────────────────────────────────────── */

function Meeting({ onOutcome }: { onOutcome: (outcome: DemoOutcome) => void }) {
  const [checked, setChecked] = useDemoSessionState<string[]>(
    "meeting-checked",
    DEMO_EXTRACTED.map((e) => e.id),
  );
  const [applied, setApplied] = useDemoSessionState("meeting-applied", false);
  const reduced = useDemoReducedMotion();

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div>
      <Head
        title="Northwind kickoff call"
        sub="It read the transcript and pulled these out. You decide what gets kept."
        right="42 min, Tue 10:02"
      />
      <div className="grid lg:grid-cols-2">
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r"
        >
          <p className={`${MONO} mb-3 text-white/35`}>Transcript</p>
          <div className="space-y-2.5">
            {DEMO_TRANSCRIPT.map((line, i) => (
              <p key={i} className="text-[0.82rem] leading-relaxed">
                <span className={`${MONO} mr-2 text-white/30`}>{line.who}</span>
                <span className="text-white/70">{line.text}</span>
              </p>
            ))}
          </div>
        </motion.div>

        <motion.div variants={reduced ? undefined : ITEM} className="p-4 sm:p-5">
          <p className={`${MONO} mb-3 text-white/35`}>
            Found {DEMO_EXTRACTED.length}, keeping {checked.length}
          </p>
          <ul className="space-y-2">
            {DEMO_EXTRACTED.map((e) => {
              const on = checked.includes(e.id);
              return (
                <li key={e.id}>
                  <motion.button
                    type="button"
                    onClick={() => !applied && toggle(e.id)}
                    disabled={applied}
                    animate={{ opacity: on ? 1 : 0.45 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className={`flex w-full gap-3 border p-3 text-left transition-colors ${
                      on ? "border-white/20 bg-white/[0.05]" : "border-white/10"
                    } ${applied ? "cursor-default" : "hover:border-white/35"}`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
                        on ? "border-white/50 bg-white/85 text-black" : "border-white/25"
                      }`}
                      aria-hidden="true"
                    >
                      <AnimatePresence>
                        {on && (
                          <motion.span
                            initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={reduced ? undefined : { scale: 0.4, opacity: 0 }}
                            transition={{ duration: 0.18, ease: EASE }}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="min-w-0">
                      <span className={`${MONO} block text-white/35`}>{e.type}</span>
                      <span className="mt-1 block text-[0.84rem] leading-snug text-white">
                        {e.text}
                      </span>
                      <span className="mt-1.5 block border-l border-white/15 pl-2 text-[0.76rem] italic leading-snug text-white/40">
                        {e.quote}
                      </span>
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!applied) {
                  onOutcome({
                    key: "meeting:applied",
                    title: `Applied ${checked.length} reviewed meeting item${checked.length === 1 ? "" : "s"}`,
                    detail:
                      "The selected facts, tasks, dates, and questions are now represented across the fictional workspace. Nothing outside this browser changed.",
                    source: "Northwind kickoff call, Tue 10:02",
                    at: "10:48",
                  });
                }
                setApplied(true);
              }}
              disabled={applied || checked.length === 0}
              className="border border-white/25 bg-white/10 px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white transition-colors hover:border-white/45 disabled:opacity-40"
            >
              {applied ? "Applied" : `Apply ${checked.length} to the records`}
            </button>
            <AnimatePresence>
              {applied && (
                <motion.span
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`${CITE} text-[rgb(163,230,53)]`}
                >
                  Filed. Nothing else was touched.
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── scenario workspaces, receipts, and integration truth ───────────────── */

function TasksWorkspace({
  outcomes,
  onOutcome,
}: {
  outcomes: DemoOutcome[];
  onOutcome: (outcome: DemoOutcome) => void;
}) {
  const [reviewed, setReviewed] = useDemoSessionState<string[]>("task-review", []);
  const meetingApplied = outcomes.some((outcome) => outcome.key === "meeting:applied");
  const tasks = [
    {
      id: "split-reporting",
      title: "Split reporting into its own line",
      source: "Northwind kickoff call",
      due: "Fri",
      evidence: "Marcus personally approves the reporting line.",
    },
    {
      id: "training-week",
      title: "Confirm the training week",
      source: "Northwind kickoff call",
      due: "Fri",
      evidence: "Training day was intentionally left open for confirmation.",
    },
    {
      id: "cedar-photos",
      title: "Send Cedar site photos",
      source: "Brightwater site visit",
      due: "Mon",
      evidence: "Captured during the site walkthrough.",
    },
    ...(meetingApplied
      ? [
          {
            id: "meeting-review",
            title: "Review Northwind kickoff commitments",
            source: "Northwind meeting review",
            due: "Today",
            evidence: "Created from the accepted transcript extraction.",
          },
        ]
      : []),
  ];
  return (
    <div>
      <Head
        title="Tasks"
        sub="Commitments stay linked to the conversation that created them."
        right={`${tasks.length - reviewed.length} open`}
      />
      <div className="divide-y divide-white/[0.07]">
        {tasks.map((task) => {
          const complete = reviewed.includes(task.id);
          return (
            <article
              key={task.id}
              className={`px-4 py-4 transition-colors sm:px-5 ${complete ? "bg-[rgb(163,230,53)]/[0.035]" : "hover:bg-white/[0.025]"}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  aria-pressed={complete}
                  onClick={() => {
                    if (complete) return;
                    setReviewed((current) => [...current, task.id]);
                    onOutcome({
                      key: `task:${task.id}`,
                      title: `Reviewed task: ${task.title}`,
                      detail:
                        "The operator reviewed this fictional commitment without changing a live task or contacting anyone.",
                      source: task.source,
                      at: "11:08",
                    });
                  }}
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,transform] active:scale-[0.96] ${complete ? "border-[rgb(190,242,100)] bg-[rgb(163,230,53)]/20 text-[rgb(220,252,160)]" : "border-white/30 text-transparent hover:border-white/65"}`}
                  aria-label={complete ? `Reviewed ${task.title}` : `Mark ${task.title} reviewed`}
                >
                  {complete ? "✓" : "·"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h5 className="text-[0.86rem] text-white">{task.title}</h5>
                    <span
                      className={`${CITE} tabular-nums ${task.due === "Today" ? "text-amber-200" : "text-white/35"}`}
                    >
                      {task.due}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.79rem] leading-relaxed text-white/52">
                    {task.evidence}
                  </p>
                  <p className={`${CITE} mt-2 text-white/35`}>{task.source}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className={`${CITE} border-t border-white/10 px-4 py-3 text-white/35 sm:px-5`}>
        Tasks are reviewable work, not proof that anything was sent or changed outside this demo.
      </p>
    </div>
  );
}

function DailyBrief({
  outcomes,
  onOutcome,
}: {
  outcomes: DemoOutcome[];
  onOutcome: (outcome: DemoOutcome) => void;
}) {
  const [acknowledged, setAcknowledged] = useDemoSessionState("brief-acknowledged", false);
  const meetingApplied = outcomes.some((outcome) => outcome.key === "meeting:applied");
  const lines = [
    {
      label: "Overnight",
      detail: "14 emails read, 3 meetings written up, 6 actions drafted",
      tone: "text-[rgb(190,242,100)]",
    },
    {
      label: "Owed by you",
      detail: meetingApplied
        ? "Sarah Chen (revised scope and training week), Dana Whitfield (intro)"
        : "Sarah Chen (scope, Friday), Dana Whitfield (intro)",
      tone: "text-white",
    },
    {
      label: "Revenue to protect",
      detail: "Northwind is ready for a reviewed scope; Atwell’s unpaid invoice needs attention.",
      tone: "text-amber-200",
    },
    {
      label: "New from meeting review",
      detail: meetingApplied
        ? "Northwind commitments are now visible in Tasks, Documents, and Activity."
        : "Review the Northwind meeting to decide what should become operating work.",
      tone: meetingApplied ? "text-[rgb(190,242,100)]" : "text-white/65",
    },
  ];
  return (
    <div>
      <Head
        title="Daily brief"
        sub="What changed, what is owed, and what deserves a human decision."
        right={acknowledged ? "Acknowledged" : "Ready"}
      />
      <div className="space-y-3 p-4 sm:p-5">
        {lines.map((line) => (
          <article
            key={line.label}
            className="rounded-[10px] border border-white/[0.09] bg-white/[0.025] p-3.5"
          >
            <p className={`${MONO} ${line.tone}`}>{line.label}</p>
            <p className="mt-2 text-[0.84rem] leading-relaxed text-white/72">{line.detail}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => {
            if (!acknowledged) {
              setAcknowledged(true);
              onOutcome({
                key: "brief:acknowledged",
                title: "Daily brief acknowledged",
                detail:
                  "The operator reviewed the fictional brief. No live reminder, task, or message was created.",
                source: "Daily operating summary",
                at: "11:10",
              });
            }
          }}
          disabled={acknowledged}
          className="min-h-10 rounded-[8px] border border-white/20 bg-white/[0.06] px-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white transition-[border-color,background-color,transform] hover:border-white/45 hover:bg-white/[0.12] active:scale-[0.96] disabled:border-[rgb(163,230,53)]/40 disabled:bg-[rgb(163,230,53)]/10 disabled:text-[rgb(190,242,100)]"
        >
          {acknowledged ? "Saved in this demo" : "Acknowledge brief"}
        </button>
        {acknowledged && (
          <span className={`${CITE} text-[rgb(190,242,100)]`}>Receipt added to Activity</span>
        )}
      </div>
    </div>
  );
}

function ActivityLog({ outcomes }: { outcomes: DemoOutcome[] }) {
  const reduced = useDemoReducedMotion();
  return (
    <div>
      <Head
        title="Activity log"
        sub="Every simulated material decision carries a source and receipt."
        right={`${outcomes.length} new receipt${outcomes.length === 1 ? "" : "s"}`}
      />
      <div className="divide-y divide-white/[0.07]">
        {outcomes.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[0.92rem] text-white/80">No new simulated receipts yet.</p>
            <p className="mx-auto mt-2 max-w-md text-[0.8rem] leading-relaxed text-white/45">
              Approve an action or apply reviewed meeting work to see the resulting operating record
              here.
            </p>
          </div>
        ) : (
          outcomes.map((outcome) => (
            <motion.article
              key={outcome.key}
              variants={reduced ? undefined : ITEM}
              className="px-4 py-4 sm:px-5"
            >
              <div className="flex gap-3">
                <span
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[rgb(163,230,53)]/12 font-mono text-[0.7rem] text-[rgb(190,242,100)]"
                  aria-hidden="true"
                >
                  ✦
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h5 className="text-[0.86rem] text-white">{outcome.title}</h5>
                    <span className={`${CITE} text-white/30`}>{outcome.at}</span>
                  </div>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-white/55">
                    {outcome.detail}
                  </p>
                  <p className={`${CITE} mt-2 text-white/35`}>Source: {outcome.source}</p>
                </div>
              </div>
            </motion.article>
          ))
        )}
      </div>
      <p className={`${CITE} border-t border-white/10 px-4 py-3 text-white/35 sm:px-5`}>
        These are fictional, browser-only receipts that demonstrate the operating trail a real
        implementation retains.
      </p>
    </div>
  );
}

function IntegrationWorkspace({ onOutcome }: { onOutcome: (outcome: DemoOutcome) => void }) {
  const [selected, setSelected] = useDemoSessionState("integration-selected", "google");
  const [inspected, setInspected] = useDemoSessionState<string[]>("integration-inspected", []);
  const provider =
    DEMO_INTEGRATIONS.find((candidate) => candidate.id === selected) ?? DEMO_INTEGRATIONS[0]!;
  const reviewed = inspected.includes(provider.id);
  const labels: Record<string, string> = {
    sample_connected: "Sample connected",
    available: "Available",
    next: "Next",
    planned: "Planned",
  };
  const colors: Record<string, string> = {
    sample_connected: "text-[rgb(190,242,100)] bg-[rgb(163,230,53)]/12",
    available: "text-sky-200 bg-sky-400/10",
    next: "text-amber-200 bg-amber-400/10",
    planned: "text-white/55 bg-white/8",
  };
  return (
    <div>
      <Head
        title="Integrations"
        sub="Capability, provider maturity, and guardrails shown separately from a live connection claim."
        right="Sample workspace"
      />
      <div className="grid border-b border-white/10 lg:grid-cols-[240px_1fr]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          {DEMO_INTEGRATIONS.map((item) => {
            const active = item.id === provider.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                aria-pressed={active}
                className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-[8px] px-3 text-left transition-colors ${active ? "bg-white/10 text-white" : "text-white/52 hover:bg-white/[0.05] hover:text-white"}`}
              >
                <span className="text-[0.8rem]">{item.name}</span>
                <span
                  className={`${CITE} shrink-0 ${active ? "text-[rgb(190,242,100)]" : "text-white/30"}`}
                >
                  {labels[item.state]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-[1rem] font-medium text-white">{provider.name}</h5>
            <span className={`${CITE} rounded-full px-2 py-1 ${colors[provider.state]}`}>
              {labels[provider.state]}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-[0.82rem] leading-relaxed text-white/55">
            {provider.description}
          </p>
          <Sub>What this sample demonstrates</Sub>
          <ul className="grid gap-2 sm:grid-cols-2">
            {provider.capabilities.map((capability) => (
              <li
                key={capability}
                className="rounded-[8px] bg-white/[0.045] px-3 py-2.5 text-[0.8rem] text-white/72"
              >
                {capability}
              </li>
            ))}
          </ul>
          <Sub>Boundary</Sub>
          <p className="text-[0.8rem] leading-relaxed text-white/55">{provider.guardrail}</p>
          <button
            type="button"
            onClick={() => {
              if (reviewed) return;
              setInspected((current) => [...current, provider.id]);
              onOutcome({
                key: `integration:${provider.id}`,
                title: `Inspected ${provider.name} capability boundary`,
                detail:
                  "The fictional workspace recorded the provider's capability, maturity, and guardrail without connecting an account or making a provider request.",
                source: "Integration catalog",
                at: "11:14",
              });
            }}
            disabled={reviewed}
            className="mt-5 inline-flex min-h-10 items-center rounded-[8px] border border-white/20 bg-white/[0.06] px-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white transition-[border-color,background-color,transform] hover:border-white/45 hover:bg-white/[0.12] active:scale-[0.96] disabled:border-[rgb(163,230,53)]/40 disabled:bg-[rgb(163,230,53)]/10 disabled:text-[rgb(190,242,100)]"
          >
            {reviewed ? "Saved in this demo" : "Inspect connection"}
          </button>
        </div>
      </div>
      <p className={`${CITE} px-4 py-3 text-white/35 sm:px-5`}>
        “Sample connected” demonstrates a fictional configured workspace. It is never a claim about
        this visitor’s accounts.
      </p>
    </div>
  );
}

/* ── connected workspace views ─────────────────────────────────────────────
   The rail is deliberately not a collection of decorative links. The focused
   workflows above get purpose-built interaction; every other workspace view
   still lets a visitor inspect a record, see the evidence behind it, and take
   one contextual simulated action. That gives the demo complete coverage
   while keeping the state boundary honest and entirely in this browser. */

function Stub({
  id,
  outcomes,
  onOutcome,
}: {
  id: string;
  outcomes: DemoOutcome[];
  onOutcome: (outcome: DemoOutcome) => void;
}) {
  const v = STUBS[id];
  const reduced = useDemoReducedMotion();
  const [selected, setSelected] = useDemoSessionState<number>(`workspace-${id}-selected`, 0);
  const [reviewed, setReviewed] = useDemoSessionState<number[]>(`workspace-${id}-reviewed`, []);
  if (!v) return null;
  const meetingApplied = outcomes.some((outcome) => outcome.key === "meeting:applied");
  const rows = [
    ...v.rows,
    ...(meetingApplied && id === "tasks"
      ? [
          {
            a: "Review Northwind kickoff commitments",
            b: "Northwind kickoff call",
            c: "Today",
            ai: true,
          },
        ]
      : []),
    ...(meetingApplied && id === "brief"
      ? [
          {
            a: "Meeting review applied",
            b: "Northwind commitments are now tracked as reviewable work",
            ai: true,
          },
        ]
      : []),
    ...(meetingApplied && id === "documents"
      ? [
          {
            a: "Northwind kickoff extraction receipt",
            b: "Northwind Group",
            c: "Just now",
            ai: true,
          },
        ]
      : []),
  ];
  const row = rows[Math.min(selected, rows.length - 1)] ?? rows[0];
  const selectedReviewed = reviewed.includes(selected);
  const action = workspaceAction(id, selectedReviewed);

  return (
    <div>
      <Head title={v.title} sub={v.sub} right={`${reviewed.length} reviewed`} />
      <motion.div variants={reduced ? undefined : ITEM} className="cc-scroll overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {v.head.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`${MONO} border-b border-white/10 px-4 py-2.5 text-left font-normal text-white/30 sm:px-5 ${
                    i === 0 ? "w-[42%]" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSelected = i === selected;
              const isReviewed = reviewed.includes(i);
              return (
                <motion.tr
                  key={i}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: reduced ? 0 : 0.04 * i }}
                  className={`border-b border-white/[0.06] transition-colors ${isSelected ? "bg-white/[0.065]" : "hover:bg-white/[0.03]"}`}
                >
                  <td className="px-4 py-3 align-top text-[0.84rem] leading-snug text-white sm:px-5">
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      className="flex min-h-10 w-full items-start gap-2 rounded-[7px] text-left outline-none transition-[color,transform] focus-visible:ring-2 focus-visible:ring-white/45 active:scale-[0.99]"
                      aria-pressed={isSelected}
                      aria-label={`Open ${r.a}`}
                    >
                      {r.ai && (
                        <span
                          className="mt-[3px] shrink-0 text-[0.7rem] text-[rgb(163,230,53)]"
                          aria-label="Done by the AI"
                        >
                          ✦
                        </span>
                      )}
                      <span className="min-w-0">
                        {r.a}
                        {isReviewed && (
                          <span className="ml-2 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-[rgb(190,242,100)]">
                            reviewed
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top text-[0.8rem] leading-snug text-white/50 sm:px-5">
                    {r.b}
                  </td>
                  <td className={`${CITE} px-4 py-3 align-top text-white/35 sm:px-5`}>
                    {r.c ?? ""}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      {row && (
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="border-t border-white/10 bg-white/[0.025] px-4 py-4 sm:px-5"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className={MONO}>Selected record / fictional data</p>
              <h5 className="mt-1.5 text-[0.95rem] font-medium text-white">{row.a}</h5>
              <p className="mt-1.5 max-w-2xl text-[0.8rem] leading-relaxed text-white/55">
                {row.b}
                {row.c ? ` · ${row.c}` : ""}
              </p>
              <p className={`${CITE} mt-3 text-white/32`}>
                <span className="text-[rgb(163,230,53)]" aria-hidden="true">
                  ✦
                </span>{" "}
                {row.ai
                  ? "This record was prepared by the system and remains reviewable."
                  : "This record is linked to the same fictional operating history shown across the workspace."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!row || selectedReviewed) return;
                setReviewed((current) =>
                  current.includes(selected) ? current : [...current, selected],
                );
                onOutcome({
                  key: `workspace:${id}:${selected}`,
                  title: `${workspaceAction(id, false)}: ${row.a}`,
                  detail:
                    "This contextual action was staged inside the fictional workspace and is available as a simulated receipt.",
                  source: row.c ? `${row.b} · ${row.c}` : row.b,
                  at: "11:02",
                });
              }}
              disabled={selectedReviewed}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/20 bg-white/[0.07] px-3 font-mono text-[0.62rem] uppercase tracking-[0.13em] text-white transition-[border-color,background-color,transform] hover:border-white/45 hover:bg-white/[0.13] active:scale-[0.96] disabled:border-[rgb(163,230,53)]/40 disabled:bg-[rgb(163,230,53)]/10 disabled:text-[rgb(190,242,100)]"
            >
              {action}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function workspaceAction(id: string, reviewed: boolean) {
  if (reviewed) return "Saved in this demo";
  const actions: Record<string, string> = {
    inbox: "Stage a reply",
    companies: "Open company context",
    referrals: "Record follow-up",
    projects: "Open delivery plan",
    tasks: "Mark task reviewed",
    documents: "Open linked document",
    brief: "Acknowledge brief",
    questions: "Mark for next call",
    reports: "Run simulated report",
    activity: "Inspect receipt",
    automations: "Review automation",
    integrations: "Inspect connection",
    settings: "Review setting",
  };
  return actions[id] ?? "Mark reviewed";
}

/* ── shared bits ───────────────────────────────────────────────────────── */

function Head({ title, sub, right }: { title: string; sub: string; right?: string }) {
  const reduced = useDemoReducedMotion();
  return (
    <motion.div
      variants={reduced ? undefined : ITEM}
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3.5 sm:px-5"
    >
      <div className="min-w-0">
        <h4 className="text-[0.95rem] font-medium text-white">{title}</h4>
        <p className="mt-0.5 text-[0.8rem] text-white/45">{sub}</p>
      </div>
      {right && <span className={`${CITE} shrink-0 text-white/35`}>{right}</span>}
    </motion.div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${MONO} mb-2.5 mt-5 border-t border-white/[0.07] pt-4 text-white/35`}>
      {children}
    </p>
  );
}

function Btn({
  children,
  onClick,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "solid";
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 items-center gap-1.5 whitespace-nowrap border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.96] ${
        tone === "solid"
          ? "border-white/35 bg-white/10 text-white hover:bg-white/25"
          : "border-white/12 text-white/50 hover:border-white/35 hover:text-white/90"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </button>
  );
}
