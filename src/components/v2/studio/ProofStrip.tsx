"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";
import { stats } from "@/content/stats";

/* Compact, generic proof for the money pages (Services / Packages): the numbers
   our systems are built to move. No named clients, no testimonials -- figures are
   illustrative of typical outcomes, single-sourced from stats.ts. */
export function ProofStrip() {
  const reduced = useReducedMotion();
  const rv = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" as const },
          transition: { duration: 0.6, ease: EASE, delay },
        };

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell page-shell--narrow text-center">
        <motion.div {...rv()}>
          <Eyebrow className="mb-6">The numbers</Eyebrow>
          <h2 className="display-3 mx-auto max-w-2xl">What our systems deliver.</h2>
        </motion.div>

        <motion.div
          {...rv(0.1)}
          className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl font-extrabold tracking-[-0.02em] text-heading sm:text-5xl">
                {s.value}
                <span className="text-gold">{s.suffix}</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-white-secondary">{s.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-white-muted">{s.detail}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          {...rv(0.15)}
          className="mt-10 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted"
        >
          Typical results · yours on a live dashboard from day one
        </motion.p>
      </div>
    </section>
  );
}
