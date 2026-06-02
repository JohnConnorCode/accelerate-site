"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight, Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
  Phone, Mail, MessageSquare, Globe, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { serviceOverviewItems } from "@/content/services-overview";
import { EASE } from "@/lib/animations";
import { KineticWord } from "./KineticWord";
import { MaskReveal } from "./MaskReveal";
import { ConsoleChrome } from "./ConsoleChrome";
import { Eyebrow } from "./primitives";

const iconMap: Record<string, LucideIcon> = {
  Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
};

const fx = {
  initial: { opacity: 0, y: 12, filter: "blur(5px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(5px)" },
};

/* ---------- per-module live demos (systems-level, channel-agnostic) ---------- */

function Row({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      className="flex items-center justify-between rounded-lg bg-[var(--glass-default-bg)] px-3.5 py-2.5 text-sm text-white-secondary"
    >
      {children}
    </motion.div>
  );
}

function StrategyDemo() {
  // a prioritized opportunity map — ranked by impact, the way we actually scope
  const ops = [
    { t: "Missed-call recovery", v: 0.94 },
    { t: "Follow-up automation", v: 0.78 },
    { t: "Review engine", v: 0.63 },
    { t: "Intake triage", v: 0.47 },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2.5">
      <div className="flex items-center justify-between font-mono text-[0.56rem] uppercase tracking-[0.18em] text-white-muted">
        <span>Opportunity</span>
        <span>Impact</span>
      </div>
      {ops.map((o, i) => (
        <motion.div
          key={o.t}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
          className="flex items-center gap-3"
        >
          <span className="w-[8.5rem] shrink-0 truncate text-sm text-white-secondary">{o.t}</span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-default-bg)]">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${o.v * 100}%` }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: EASE }}
            />
          </span>
        </motion.div>
      ))}
      <div className="mt-1 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-gold">
        Roadmap prioritized by ROI
      </div>
    </div>
  );
}

function WorkflowDemo() {
  const nodes = ["Trigger", "Process", "Route", "Done"];
  return (
    <div className="flex w-full max-w-[330px] items-center justify-between">
      {nodes.map((n, i) => (
        <div key={n} className="flex items-center">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-gold text-gold">
              <span className="h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white-muted">{n}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="relative mx-1 h-px w-8 bg-[var(--border-glass)]">
              <motion.span className="absolute inset-y-0 left-0 w-2 bg-gold" animate={{ x: [0, 24], opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GrowthDemo() {
  const cols = ["New", "Nurturing", "Won"];
  return (
    <div className="grid w-full max-w-[330px] grid-cols-3 gap-2.5">
      {cols.map((c, ci) => (
        <div key={c} className="flex flex-col gap-2">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white-muted">{c}</span>
          {Array.from({ length: ci === 2 ? 2 : 1 }).map((_, i) => (
            <motion.span
              key={i}
              className={`h-7 rounded-md ${ci === 2 ? "bg-gold" : "bg-[var(--glass-default-bg)]"}`}
              animate={ci === 2 ? { opacity: [0.4, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity, repeatType: "mirror", delay: i * 0.3 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function EngageDemo() {
  // channel-agnostic: any communication in → captured & handled
  const channels: { icon: LucideIcon; label: string }[] = [
    { icon: Phone, label: "Call" },
    { icon: MessageSquare, label: "Text" },
    { icon: Mail, label: "Email" },
    { icon: Globe, label: "Web form" },
    { icon: MessageCircle, label: "Chat" },
  ];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2">
      {channels.map((c, i) => (
        <Row key={c.label} delay={i * 0.1}>
          <span className="flex items-center gap-2.5">
            <c.icon className="h-4 w-4 text-gold" />
            {c.label}
          </span>
          <motion.span
            className="flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-gold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}
          >
            <Check className="h-3.5 w-3.5" /> Handled
          </motion.span>
        </Row>
      ))}
    </div>
  );
}

function ContentDemo() {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }).map((_, i) => (
          <motion.span
            key={i}
            className="aspect-square rounded-[3px] bg-[var(--glass-default-bg)]"
            animate={{ backgroundColor: [i % 3 === 0 ? "rgba(var(--accent-rgb),0.5)" : "rgba(255,255,255,0.05)"] }}
            transition={{ duration: 0.5, delay: i * 0.04 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-[var(--glass-default-bg)] px-3.5 py-2.5 font-mono text-sm text-white-secondary">
        <PenTool className="h-4 w-4 text-gold" />
        <span>Drafting this week’s posts</span>
        <motion.span className="inline-flex gap-0.5" >
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="h-1 w-1 rounded-full bg-[var(--white-muted)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </motion.span>
      </div>
    </div>
  );
}

function DataDemo() {
  const bars = [0.38, 0.52, 0.46, 0.68, 0.6, 0.82, 0.95];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-[0.56rem] uppercase tracking-[0.18em] text-white-muted">
        <span>This week</span>
        <span className="flex items-center gap-1 text-gold">
          <TrendingUp className="h-3 w-3" /> trending up
        </span>
      </div>
      <div className="flex h-[120px] items-end justify-center gap-2.5">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <motion.span
              className="w-full rounded-t-md bg-gold"
              style={{ opacity: 0.35 + h * 0.65 }}
              initial={{ height: 0 }}
              animate={{ height: `${h * 92}px` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
            />
            <span className="font-mono text-[0.55rem] text-white-muted">{days[i]}</span>
          </div>
        ))}
      </div>
      <div className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-white-muted">
        Auto-updated · every channel
      </div>
    </div>
  );
}

const DEMOS: Record<string, { demo: () => React.ReactNode; status: string }> = {
  Compass: { demo: StrategyDemo, status: "Strategy · prioritized by ROI" },
  Workflow: { demo: WorkflowDemo, status: "Workflow · running automatically" },
  TrendingUp: { demo: GrowthDemo, status: "Pipeline · nurtured to close" },
  MessageCircle: { demo: EngageDemo, status: "Any channel · captured & handled" },
  PenTool: { demo: ContentDemo, status: "Content · drafted & scheduled" },
  BarChart3: { demo: DataDemo, status: "Reporting · always current" },
};

export function Services() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const items = serviceOverviewItems;
  const current = items[active]!;
  const CurrentIcon = iconMap[current.icon] ?? Compass;
  const Demo = (DEMOS[current.icon] ?? DEMOS.Compass!).demo;
  const status = (DEMOS[current.icon] ?? DEMOS.Compass!).status;

  return (
    <section className="section-y section-divide relative overflow-hidden">
      <div className="page-shell page-shell--narrow mb-12">
        <Eyebrow className="mb-6">What we run</Eyebrow>
        <h2 className="display-2 max-w-3xl">
          <MaskReveal>Find. Win. Keep. Grow.</MaskReveal>
          <MaskReveal delay={0.1}>A system for every stage.</MaskReveal>
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white-muted">
          Six custom systems across the full lifecycle (find, win, keep, grow), built for your operation and run by our team, not handed off as software for you to manage.
        </p>
      </div>

      <div className="page-shell page-shell--narrow relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* left: module menu (desktop) — mobile gets its own enriched list below */}
        <motion.div
          className="relative hidden lg:block"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <KineticWord word="REVENUE" />
          <ul className="border-t border-border-glass">
            {items.map((s, i) => {
              const Icon = iconMap[s.icon] ?? Compass;
              const on = i === active;
              return (
                <li key={s.name}>
                  <Link
                    href="/services"
                    data-cursor="link"
                    data-cursor-label="View"
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group relative block overflow-hidden border-b border-border-glass"
                  >
                    <span className={`absolute inset-0 origin-left bg-gold transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "scale-x-100" : "scale-x-0"}`} />
                    <div className={`relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-3 py-6 transition-colors duration-300 sm:gap-6 ${on ? "text-btn-text" : ""}`}>
                      <span className={`font-mono text-sm transition-colors ${on ? "text-btn-text" : "text-gold opacity-60"}`}>0{i + 1}</span>
                      <h3 className={`flex items-center gap-3.5 font-display text-xl font-bold tracking-[-0.02em] transition-all duration-300 sm:text-3xl ${on ? "text-btn-text" : "text-heading"}`}>
                        <Icon className={`h-5 w-5 shrink-0 transition-colors sm:h-7 sm:w-7 ${on ? "text-btn-text" : "text-gold"}`} strokeWidth={1.75} />
                        {s.name}
                      </h3>
                      <ArrowUpRight className={`h-5 w-5 transition-all duration-300 ${on ? "translate-x-0 text-btn-text opacity-100" : "-translate-x-2 text-gold opacity-0"}`} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>

        {/* right: live preview of the active module (desktop) */}
        <motion.div
          className="hidden lg:block"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        >
          <div className="sticky top-24">
            <ConsoleChrome status={status} contentClassName="relative p-0">
              {/* module tab — grounds the demo as a real screen, not a floating widget */}
              <div className="flex items-center justify-between border-b border-border-glass px-5 py-3">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={active}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-2.5 font-mono text-[0.64rem] uppercase tracking-[0.2em] text-white-secondary"
                  >
                    <CurrentIcon className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                    {current.name}
                  </motion.span>
                </AnimatePresence>
                <span className="font-mono text-[0.6rem] tracking-wide text-white-muted">
                  module {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                </span>
              </div>

              {/* live scanning line — matches the hero feed's language */}
              <div className="relative h-[2px] w-full overflow-hidden bg-[color-mix(in_srgb,var(--white-muted)_18%,transparent)]">
                {!reduced && (
                  <motion.span
                    className="absolute inset-y-0 w-1/4 bg-gold"
                    animate={{ x: ["-110%", "440%"] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>

              {/* demo stage */}
              <div className="dot-grid relative flex h-[268px] items-center justify-center p-6">
                <AnimatePresence mode="wait">
                  <motion.div key={active} {...fx} transition={{ duration: 0.4, ease: EASE }} className="flex w-full items-center justify-center">
                    <Demo />
                  </motion.div>
                </AnimatePresence>
              </div>
            </ConsoleChrome>
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                className="mt-5 max-w-md text-base leading-relaxed text-white-muted"
              >
                {current.description}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* mobile: enriched card list — icon + name + description, no redundancy */}
        <ul className="flex flex-col divide-y divide-border-glass border-y border-border-glass lg:hidden">
          {items.map((s, i) => {
            const Icon = iconMap[s.icon] ?? Compass;
            return (
              <motion.li
                key={s.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
                className="flex items-start gap-4 py-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[0.6rem] tracking-[0.2em] text-gold opacity-70">0{i + 1}</span>
                    <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-heading">{s.name}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-white-muted">{s.description}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
