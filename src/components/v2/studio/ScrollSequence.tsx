"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Phone, MessageSquare, Mail, Globe, Check, Star, FileText, ArrowRight, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "@/lib/animations";
import { Eyebrow, useReveal } from "./primitives";

type StepUI = "intake" | "triage" | "handled" | "sequence" | "compound";
interface Step { n: string; title: string; sub: string; ui: StepUI; status: string }

const STEPS: Step[] = [
  { n: "01", title: "Capture every inquiry.",    sub: "Call, text, email, or web form, caught the moment it arrives.",        ui: "intake",   status: "Captured · any channel, instantly" },
  { n: "02", title: "Decode the intent.",        sub: "Read, ranked, and routed to the right place in seconds.",              ui: "triage",   status: "Decoded · intent · priority · route" },
  { n: "03", title: "Take the right action.",    sub: "Replied to, quoted, and booked, all on its own.",                      ui: "handled",  status: "Action · taken automatically" },
  { n: "04", title: "Never drop a follow-up.",   sub: "Persistent, on-brand, and multi-channel until it converts.",           ui: "sequence", status: "Sequence · multi-touch · until converted" },
  { n: "05", title: "Compound the win.",         sub: "Reviews, repeat work, and insight that build while you sleep.",        ui: "compound", status: "Compounding · reviews + repeat work" },
];

const stepFx = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -14, filter: "blur(6px)" },
};

function Line({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
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

/* ---------- per-step surfaces: the journey of one inquiry, channel-agnostic ---------- */

function IntakeCard() {
  const chans: { icon: LucideIcon; on?: boolean }[] = [
    { icon: Phone }, { icon: MessageSquare }, { icon: Mail }, { icon: Globe, on: true },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white-muted">From any channel</span>
        <div className="flex items-center gap-1.5">
          {chans.map((c, i) => (
            <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.on ? "bg-gold text-btn-text" : "bg-[var(--glass-default-bg)] text-white-muted"}`}>
              <c.icon className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
        className="rounded-2xl border border-border-gold bg-[var(--glow-soft)] p-4"
      >
        <div className="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.15em]">
          <span className="text-white-muted">New inquiry · web form</span>
          <span className="flex items-center gap-1 text-gold"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> just now</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white-secondary">“Need a quote for a kitchen remodel. When can someone come out?”</p>
      </motion.div>
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-1.5 self-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-gold">
        <Check className="h-3.5 w-3.5" /> Captured
      </motion.span>
    </div>
  );
}

function TriageCard() {
  const tags = [["Intent", "Quote request"], ["Priority", "High"], ["Route", "Sales"]];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-4">
      <div className="rounded-2xl bg-[var(--glass-default-bg)] p-4">
        <p className="text-sm leading-relaxed text-white-secondary">“Need a quote for a kitchen remodel…”</p>
      </div>
      <div className="flex flex-col gap-2">
        {tags.map(([k, v], i) => (
          <motion.div
            key={k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.14, duration: 0.4, ease: EASE }}
            className="flex items-center justify-between rounded-lg border border-border-glass px-3.5 py-2.5"
          >
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white-muted">{k}</span>
            <span className="text-sm font-semibold text-gold">{v}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function HandledCard() {
  const acts: { icon: LucideIcon; label: string }[] = [
    { icon: MessageSquare, label: "Replied in 30 seconds" },
    { icon: FileText, label: "Quote drafted & sent" },
    { icon: Check, label: "Site visit booked for Thu 2:00" },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2">
      {acts.map((a, i) => (
        <Line key={a.label} delay={i * 0.18}>
          <span className="flex items-center gap-2.5"><a.icon className="h-4 w-4 text-gold" />{a.label}</span>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.18, type: "spring", stiffness: 500, damping: 20 }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold text-btn-text"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
          </motion.span>
        </Line>
      ))}
    </div>
  );
}

function SequenceCard() {
  const touches: { icon: LucideIcon; when: string; via: string }[] = [
    { icon: Mail, when: "Day 1", via: "Email" },
    { icon: MessageSquare, when: "Day 3", via: "Text" },
    { icon: Phone, when: "Day 5", via: "Call" },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2.5">
      {touches.map((t, i) => (
        <Line key={t.when} delay={i * 0.16}>
          <span className="flex items-center gap-2.5"><t.icon className="h-4 w-4 text-gold" /><span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-white-muted">{t.when}</span>{t.via} sent</span>
          <Check className="h-4 w-4 text-gold" />
        </Line>
      ))}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.45, ease: EASE }}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-gold px-3.5 py-2.5 text-sm font-bold text-btn-text"
      >
        <ArrowRight className="h-4 w-4" /> Converted to a booked job
      </motion.div>
    </div>
  );
}

function CompoundCard() {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg bg-[var(--glass-default-bg)] px-3.5 py-2.5 text-sm text-white-secondary">
        <span>Review request sent</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 400, damping: 16 }}>
              <Star className="h-4 w-4 fill-[var(--gold-base)] text-gold" />
            </motion.span>
          ))}
        </div>
      </div>
      <Line delay={0.5}>
        <span className="flex items-center gap-2.5"><Repeat className="h-4 w-4 text-gold" />Repeat work secured</span>
        <Check className="h-4 w-4 text-gold" />
      </Line>
      <div className="flex h-16 items-end justify-center gap-2">
        {[0.4, 0.55, 0.5, 0.7, 0.65, 0.85, 0.95].map((h, i) => (
          <motion.span key={i} className="w-5 rounded-t bg-gold" style={{ opacity: 0.4 + h * 0.6 }} initial={{ height: 0 }} animate={{ height: `${h * 100}%` }} transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: EASE }} />
        ))}
      </div>
    </div>
  );
}

const UIMAP: Record<StepUI, () => React.ReactNode> = {
  intake: IntakeCard,
  triage: TriageCard,
  handled: HandledCard,
  sequence: SequenceCard,
  compound: CompoundCard,
};

/* ---------- console frame (persistent chrome) ---------- */

function Console({ active }: { active: number }) {
  const step = STEPS[active]!;
  const Surface = UIMAP[step.ui];
  return (
    <div className="glass-prominent relative w-full max-w-[440px] overflow-hidden rounded-[1.75rem]">
      {/* shifting accent glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -z-10 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(var(--accent-rgb),0.22), transparent 70%)", filter: "blur(20px)" }}
        animate={{ x: ["10%", "60%", "20%"][active % 3], y: ["0%", "40%", "20%"][active % 3] }}
        transition={{ duration: 1.2, ease: EASE }}
      />
      {/* header chrome */}
      <div className="flex items-center justify-between border-b border-border-glass px-5 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">built for you</span>
        <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Live
        </span>
      </div>
      {/* content stage */}
      <div className="dot-grid relative flex h-[300px] items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div key={active} {...stepFx} transition={{ duration: 0.45, ease: EASE }} className="flex w-full items-center justify-center">
            <Surface />
          </motion.div>
        </AnimatePresence>
      </div>
      {/* footer status */}
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

/* ---------- mobile-step block — each step gets its own elegant entrance with
   the actual Console for that step, not a dumbed-down placeholder. */
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
        end: "+=" + STEPS.length * 85 + "%",
        pin: stageRef.current,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // continuous rail (no re-render)
          if (railRef.current) railRef.current.style.transform = `scaleY(${self.progress})`;
          setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(self.progress * STEPS.length))));
        },
      });
      ScrollTrigger.refresh();
      return () => st.kill();
    },
    { dependencies: [pinned], scope: sectionRef },
  );

  // Mobile / reduced-motion / SSR fallback — proper experience: each step
  // shows its own Console + heading + description, revealed as you scroll past.
  // No "watch the desktop version" excuse — it's its own elegant flow.
  if (!pinned || reduced) {
    return (
      <section className="section-y">
        <div className="page-shell page-shell--narrow">
          <Eyebrow>watch it work</Eyebrow>
          <h2 className="display-3 mt-6">
            An inquiry comes in. <span className="display-italic">We handle it.</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white-muted">
            The same lifecycle, every time: captured, understood, handled, followed up,
            and compounding into the next one.
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
      <div ref={stageRef} className="flex h-screen items-center overflow-hidden">
        <div className="page-shell page-shell--narrow grid items-center gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-20">
          {/* left: narrative + progress (rail integrated into content, not orphan margin) */}
          <div className="flex gap-5">
            {/* progress rail with step ticks — heavier, grouped tight to text */}
            <div className="relative hidden w-0.5 shrink-0 rounded-full bg-border-glass sm:block" style={{ height: 280 }}>
              <div ref={railRef} className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-gold" style={{ transform: "scaleY(0)" }} />
              {STEPS.map((s, i) => (
                <span
                  key={s.n}
                  className={`absolute -left-[5px] h-3 w-3 rounded-full ring-2 ring-bg-base transition-colors duration-300 ${i <= active ? "bg-gold" : "bg-white-muted"}`}
                  style={{ top: `calc(${(i / (STEPS.length - 1)) * 100}% - 6px)` }}
                />
              ))}
            </div>

            <div className="min-w-0">
              <Eyebrow className="mb-8">watch it work</Eyebrow>
              <span className="font-mono text-sm text-gold opacity-70">{STEPS[active]!.n} / 0{STEPS.length}</span>
              <div className="min-h-[210px]">
                <AnimatePresence mode="wait">
                  <motion.div key={active} {...stepFx} transition={{ duration: 0.45, ease: EASE }}>
                    <h2 className="mt-3 display-3">{STEPS[active]!.title}</h2>
                    <p className="mt-4 max-w-sm text-lg text-white-muted">{STEPS[active]!.sub}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* right: the product, working */}
          <div className="flex justify-center lg:justify-end">
            <Console active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
