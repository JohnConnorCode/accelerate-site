"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";
import { stats } from "@/content/stats";

/* Real proof, no decoration. Featured engagement + the verbatim Robert Farrell
   testimonial come from the Farrell Roofing case study; aggregate numbers are
   single-sourced from stats.ts; the second quote is verbatim from testimonials.ts. */
const FEATURED = {
  tag: "Home Services · Farrell Roofing",
  from: "10",
  to: "50+",
  unit: "online inquiries / month",
  metrics: [
    { v: "under 2 min", k: "response time, from hours" },
    { v: "+75%", k: "revenue" },
    { v: "4 weeks", k: "kickoff to live" },
  ],
  quote:
    "We were losing jobs because we couldn't respond fast enough from the roof. Accelerate set up an AI system that handles every inquiry instantly, even nights and weekends. We've booked 15 extra jobs a month since going live.",
  who: "Robert Farrell, Owner, Farrell Roofing",
};

const SECOND = {
  quote: "Our consultation rate jumped 40% the first quarter.",
  who: "Mike Montoya, Managing Partner, Montoya Capital",
};

export function Results() {
  const reduced = useReducedMotion();
  const rv = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell">
        <motion.div {...rv()}>
          <Eyebrow className="mb-6">Proof</Eyebrow>
          <h2 className="display-2 max-w-3xl">Real businesses. Real numbers.</h2>
        </motion.div>

        {/* Featured engagement */}
        <motion.div
          {...rv(0.1)}
          className="glass-prominent mt-12 overflow-hidden rounded-[1.75rem] border border-border-glass p-7 sm:p-10"
        >
          <div className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            {FEATURED.tag}
          </div>

          <div className="mt-8 grid gap-9 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            {/* numbers */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-extrabold tracking-[-0.02em] text-white-muted/45 sm:text-6xl">
                  {FEATURED.from}
                </span>
                <span className="text-2xl text-white-muted">→</span>
                <span className="font-display text-6xl font-extrabold tracking-[-0.02em] text-gold sm:text-7xl">
                  {FEATURED.to}
                </span>
              </div>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-white-muted">
                {FEATURED.unit}
              </p>

              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border-glass pt-6">
                {FEATURED.metrics.map((m) => (
                  <div key={m.k}>
                    <p className="font-display text-lg font-bold text-heading sm:text-xl">{m.v}</p>
                    <p className="mt-1 text-xs leading-snug text-white-muted">{m.k}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* quote */}
            <figure className="flex flex-col justify-center border-border-glass lg:border-l lg:pl-14">
              <blockquote className="text-lg leading-relaxed text-white-secondary">
                &ldquo;{FEATURED.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-white-muted">
                {FEATURED.who}
              </figcaption>
            </figure>
          </div>
        </motion.div>

        {/* Aggregate numbers */}
        <motion.div
          {...rv(0.15)}
          className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 rounded-2xl border border-border-glass bg-[var(--glass-default-bg)] p-8 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl font-extrabold tracking-[-0.02em] text-heading">
                {s.value}
                <span className="text-gold">{s.suffix}</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-white-secondary">{s.label}</p>
              <p className="mt-0.5 text-xs text-white-muted">{s.detail}</p>
            </div>
          ))}
        </motion.div>
        <motion.p
          {...rv(0.2)}
          className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted"
        >
          Across every engagement
        </motion.p>

        {/* Second voice */}
        <motion.figure {...rv(0.1)} className="mx-auto mt-14 max-w-2xl text-center">
          <blockquote className="font-display text-2xl font-bold leading-snug tracking-[-0.02em] text-heading sm:text-3xl">
            &ldquo;{SECOND.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-white-muted">
            {SECOND.who}
          </figcaption>
        </motion.figure>

        {/* Guarantee */}
        <motion.p
          {...rv(0.1)}
          className="mx-auto mt-14 max-w-xl text-center text-base leading-relaxed text-white-secondary"
        >
          Every engagement comes with a results guarantee, plus a roadmap and ROI
          projection that&apos;s yours to keep, even if we never work together.
        </motion.p>
      </div>
    </section>
  );
}
