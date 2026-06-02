"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";
import { stats } from "@/content/stats";

/* Compact proof for the money pages (Services / Packages): one real client
   line at the decision point, backed by the aggregate numbers. Verbatim from
   testimonials.ts; stats single-sourced from stats.ts. Lighter than the home
   Results section so it reads as a moment, not a second proof page. */
const QUOTE = {
  text: "We've booked 15 extra jobs a month since going live.",
  who: "Robert Farrell, Owner, Farrell Roofing",
};

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
          <Eyebrow className="mb-7">Proof</Eyebrow>
          <blockquote className="mx-auto max-w-3xl font-display text-3xl font-bold leading-snug tracking-[-0.02em] text-heading sm:text-4xl">
            &ldquo;{QUOTE.text}&rdquo;
          </blockquote>
          <figcaption className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-white-muted">
            {QUOTE.who}
          </figcaption>
        </motion.div>

        <motion.div
          {...rv(0.1)}
          className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-8"
        >
          {stats.slice(0, 3).map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">
                {s.value}
                <span className="text-gold">{s.suffix}</span>
              </p>
              <p className="mt-1.5 text-xs leading-snug text-white-muted sm:text-sm">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
