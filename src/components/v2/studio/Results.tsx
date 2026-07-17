"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";
import { stats } from "@/content/stats";

/* Generic, high-level proof: the numbers our systems are built to move. No named
   clients and no testimonials -- figures are illustrative of typical outcomes,
   shown to every client on a live dashboard from day one. */
export function Results() {
  const reduced = useReducedMotion();
  const rv = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" as const },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell">
        <motion.div {...rv()}>
          <Eyebrow className="mb-6">The numbers</Eyebrow>
          <h2 className="display-2 max-w-3xl">We move the numbers that matter.</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white-muted">
            Typical results across the businesses we run systems for. You see
            them on a live dashboard from day one, so you always know exactly
            what you are paying for.
          </p>
        </motion.div>

        <motion.div
          {...rv(0.1)}
          className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-white/10 pt-12 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-5xl font-extrabold tracking-[-0.02em] text-heading sm:text-6xl">
                {s.value}
                <span className="text-gold">{s.suffix}</span>
              </p>
              <p className="mt-3 text-sm font-semibold text-white-secondary">{s.label}</p>
              <p className="mt-1 text-xs text-white-muted">{s.detail}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
