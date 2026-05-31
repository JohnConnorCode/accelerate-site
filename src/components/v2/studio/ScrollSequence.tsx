"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import {
  Check, Phone, Calendar, Mail,
  CreditCard, MessageSquare, Cpu, TrendingUp,
} from "lucide-react";
import { EASE } from "@/lib/animations";
import { Eyebrow, useReveal } from "./primitives";

type StepUI = "diagnose" | "architect" | "build" | "operate";
interface Step { n: string; title: string; sub: string; ui: StepUI; status: string }

/* The engagement of a boutique AI consultancy — not a product feature list.
   Each step reframes "what we do" as bespoke, rigorous, results-accountable. */
const STEPS: Step[] = [
  {
    n: "01",
    title: "Diagnose.",
    sub: "We learn your business cold — where it leaks time, where it leaves money on the table, where AI creates the most leverage.",
    ui: "diagnose",
    status: "Diagnose · mapping the opportunity",
  },
  {
    n: "02",
    title: "Architect.",
    sub: "We design a system precise to your operation. No templates, no off-the-shelf software bent to fit.",
    ui: "architect",
    status: "Architect · a custom blueprint",
  },
  {
    n: "03",
    title: "Build.",
    sub: "We engineer it with frontier AI and wire it into the tools you already run on.",
    ui: "build",
    status: "Build · frontier AI, integrated",
  },
  {
    n: "04",
    title: "Run it with you.",
    sub: "We operate it beside you — measured, tuned, accountable. It compounds, week over week.",
    ui: "operate",
    status: "Operate · accountable to results",
  },
];

const stepFx = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -14, filter: "blur(6px)" },
};

function Row({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      className="flex items-center justify-between rounded-lg bg-[var(--glass-default-bg)] px-3.5 py-2.5 text-sm text-white-secondary"
    >
      {children}
    </motion.div>
  );
}

/* ---------- per-step surfaces: a consultancy's engagement, visualized ---------- */

function DiagnoseCard() {
  // a prioritized opportunity map — ranked by impact, the way we actually scope
  const ops = [
    { t: "Missed-call recovery", v: 0.94 },
    { t: "Quote turnaround", v: 0.81 },
    { t: "Follow-up automation", v: 0.66 },
    { t: "Review engine", v: 0.49 },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-[0.56rem] uppercase tracking-[0.18em] text-white-muted">
        <span>Opportunity</span><span>Impact</span>
      </div>
      {ops.map((o, i) => (
        <motion.div
          key={o.t}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
          className="flex items-center gap-3"
        >
          <span className="w-[8.5rem] shrink-0 truncate text-sm text-white-secondary">{o.t}</span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-default-bg)]">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-gold"
              initial={{ width: 0 }} animate={{ width: `${o.v * 100}%` }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: EASE }}
            />
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function ArchitectCard() {
  // a bespoke system blueprint — a central AI core wired to the business
  const nodes = [
    { icon: Phone, label: "Intake" },
    { icon: Calendar, label: "Scheduling" },
    { icon: MessageSquare, label: "Comms" },
    { icon: TrendingUp, label: "Reporting" },
  ];
  return (
    <div className="flex w-full max-w-[330px] flex-col items-center gap-5">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-center gap-2 rounded-xl border border-border-gold bg-[var(--glow-soft)] px-4 py-2.5"
      >
        <Cpu className="h-4 w-4 text-gold" />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold">Custom AI core</span>
      </motion.div>
      <div className="relative h-5 w-px bg-border-gold" />
      <div className="grid w-full grid-cols-2 gap-2.5">
        {nodes.map((nd, i) => (
          <motion.div
            key={nd.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.1, duration: 0.4, ease: EASE }}
            className="flex items-center gap-2.5 rounded-lg border border-border-glass bg-[var(--glass-default-bg)] px-3 py-2.5"
          >
            <nd.icon className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="truncate text-xs text-white-secondary">{nd.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BuildCard() {
  // wiring frontier AI into the tools the business already runs on
  const tools: { icon: typeof Phone; label: string }[] = [
    { icon: Phone, label: "Phone & SMS" },
    { icon: Calendar, label: "Calendar" },
    { icon: Mail, label: "Email & CRM" },
    { icon: CreditCard, label: "Payments" },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2">
      {tools.map((t, i) => (
        <Row key={t.label} delay={i * 0.16}>
          <span className="flex items-center gap-2.5"><t.icon className="h-4 w-4 text-gold" />{t.label}</span>
          <motion.span
            className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.16 }}
          >
            <Check className="h-3.5 w-3.5" /> Connected
          </motion.span>
        </Row>
      ))}
    </div>
  );
}

function OperateCard() {
  const bars = [0.42, 0.5, 0.47, 0.64, 0.6, 0.78, 0.92];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5">
        {[{ k: "Booked work", v: "+38%" }, { k: "Owner's time back", v: "11 hrs/wk" }].map((m, i) => (
          <motion.div
            key={m.k}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, duration: 0.4 }}
            className="rounded-lg border border-border-glass bg-[var(--glass-default-bg)] p-3 text-center"
          >
            <p className="font-display text-lg font-bold text-gold">{m.v}</p>
            <p className="mt-0.5 font-mono text-[0.52rem] uppercase tracking-[0.12em] text-white-muted">{m.k}</p>
          </motion.div>
        ))}
      </div>
      <div className="flex h-[88px] items-end justify-center gap-2">
        {bars.map((h, i) => (
          <motion.span
            key={i} className="w-5 rounded-t bg-gold" style={{ opacity: 0.4 + h * 0.6 }}
            initial={{ height: 0 }} animate={{ height: `${h * 100}%` }}
            transition={{ delay: 0.25 + i * 0.07, duration: 0.6, ease: EASE }}
          />
        ))}
      </div>
    </div>
  );
}

const UIMAP: Record<StepUI, () => React.ReactNode> = {
  diagnose: DiagnoseCard,
  architect: ArchitectCard,
  build: BuildCard,
  operate: OperateCard,
};

/* ---------- console frame (persistent chrome) ---------- */

function Console({ active }: { active: number }) {
  const step = STEPS[active]!;
  const Surface = UIMAP[step.ui];
  return (
    <div className="glass-prominent relative w-full max-w-[440px] overflow-hidden rounded-[1.75rem]">
      <div className="flex items-center justify-between border-b border-border-glass px-5 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">your engagement</span>
        <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Live
        </span>
      </div>
      <div className="dot-grid relative flex h-[300px] items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div key={active} {...stepFx} transition={{ duration: 0.45, ease: EASE }} className="flex w-full items-center justify-center">
            <Surface />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 border-t border-border-glass px-5 py-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
        <AnimatePresence mode="wait">
          <motion.span key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="truncate font-mono text-[0.65rem] uppercase tracking-[0.14em] text-white-muted">
            {step.status}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- mobile-step block — each phase, its own elegant entrance ---------- */
function MobileStep({ step, index }: { step: Step; index: number }) {
  const ref = useReveal<HTMLDivElement>();
  const bg = index % 2 === 0 ? "bg-bg-base" : "bg-[var(--bg-section-warm)]";
  return (
    <div ref={ref} className={`section-reveal py-12 ${bg}`}>
      <div className="page-shell page-shell--narrow flex flex-col gap-7">
        <div className="flex items-baseline gap-5">
          <span className="font-mono text-base font-bold text-gold opacity-80">{step.n}</span>
          <div className="min-w-0 flex-1">
            <h3 className="display-3">{step.title}</h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white-muted">{step.sub}</p>
          </div>
        </div>
        <div className="self-center">
          <Console active={index} />
        </div>
      </div>
    </div>
  );
}

/* ---------- desktop pin detection (lint-clean, no setState-in-effect) ---------- */
function useDesktopPinned() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => !prefersReducedMotion() && window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

export function ScrollSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const pinned = useDesktopPinned();

  useGSAP(
    () => {
      if (!pinned || !sectionRef.current || !stageRef.current) return;
      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=" + STEPS.length * 80 + "%",
        pin: stageRef.current,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (railRef.current) railRef.current.style.transform = `scaleY(${self.progress})`;
          // step bands align 1:1 with tick positions (tick i sits at i/STEPS.length)
          setActive(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length)));
        },
      });
      ScrollTrigger.refresh();
      return () => st.kill();
    },
    { dependencies: [pinned], scope: sectionRef },
  );

  // Mobile / reduced-motion / SSR fallback
  if (!pinned || reduced) {
    return (
      <section className="section-y">
        <div className="page-shell page-shell--narrow">
          <Eyebrow>How we work</Eyebrow>
          <h2 className="display-3 mt-6">
            We don&apos;t sell software. We engineer outcomes.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white-muted">
            Every engagement is built from scratch for your business —
            diagnosed, designed, built, and run alongside you.
          </p>
        </div>
        <div className="mt-12 flex flex-col">
          {STEPS.map((s, i) => (
            <MobileStep key={s.n} step={s} index={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative">
      <div ref={stageRef} className="flex min-h-screen items-center overflow-hidden">
        <div className="page-shell page-shell--narrow grid w-full items-center gap-14 lg:grid-cols-[1fr_0.92fr] lg:gap-20">
          {/* left: narrative + progress — animates in as the section arrives */}
          <motion.div
            className="flex gap-6"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {/* progress rail — ticks sit at step-band starts so the fill and the
                active step change at the exact same scroll position */}
            <div className="relative hidden w-px shrink-0 self-stretch bg-white/10 sm:block" style={{ minHeight: 240 }}>
              <div ref={railRef} className="absolute inset-x-0 top-0 h-full origin-top bg-gold" style={{ transform: "scaleY(0)" }} />
              {STEPS.map((s, i) => (
                <span
                  key={s.n}
                  className={`absolute -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-bg-base transition-colors duration-300 ${i <= active ? "bg-gold" : "bg-white/25"}`}
                  style={{ top: `calc(${(i / STEPS.length) * 100}% + 4px)` }}
                />
              ))}
            </div>

            <div className="min-w-0">
              <Eyebrow className="mb-5">How we work</Eyebrow>
              {/* small persistent intro — does NOT compete with the step title */}
              <p className="mb-10 max-w-xs text-sm leading-relaxed text-white-muted">
                We don&apos;t sell software. We engineer outcomes — built from
                scratch for your business.
              </p>
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-gold opacity-70">
                {STEPS[active]!.n} / 0{STEPS.length}
              </span>
              <div className="mt-4 min-h-[210px]">
                <AnimatePresence mode="wait">
                  <motion.div key={active} {...stepFx} transition={{ duration: 0.45, ease: EASE }}>
                    <h2 className="display-2">{STEPS[active]!.title}</h2>
                    <p className="mt-5 max-w-sm text-lg leading-relaxed text-white-secondary">{STEPS[active]!.sub}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* right: the engagement, visualized — animates in too */}
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
          >
            <Console active={active} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
