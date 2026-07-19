"use client";

import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";

/* The guarantee, elevated from a footnote to a first-class moment. Every clause
   is a commitment that already exists elsewhere on the site — nothing here is
   new proof, only the honest terms, set like a contract. Deliberately the
   quietest section on the page: a key change between the stats and the lime
   ValueBand. */
const CLAUSES = [
  {
    n: "01",
    title: "A results guarantee on every engagement.",
    detail:
      "Not a promise to try. A commitment to outcomes, made before we start.",
  },
  {
    n: "02",
    title: "Your numbers, live, from day one.",
    detail:
      "Every engagement runs on a live dashboard, so you always know exactly what you are paying for.",
  },
  {
    n: "03",
    title: "A roadmap and ROI projection, yours to keep.",
    detail:
      "You leave the free strategy call with both, even if we never work together.",
  },
  {
    n: "04",
    title: "We run what we build.",
    detail:
      "No handing you software and walking away. When something needs attention, that is our job, not yours.",
  },
];

export function Guarantee() {
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
      <div className="page-shell page-shell--narrow">
        <motion.div {...rv()}>
          <Eyebrow className="mb-6">The deal</Eyebrow>
          <h2 className="display-2 max-w-2xl">
            Our end of <span className="display-italic">the deal.</span>
          </h2>
        </motion.div>

        <div className="mt-12">
          {CLAUSES.map((c, i) => (
            <motion.div
              key={c.n}
              {...rv(0.06 * (i + 1))}
              className="group grid gap-2 border-t border-white/10 py-7 sm:grid-cols-[3.5rem_1fr_1fr] sm:gap-8 sm:py-8"
            >
              <span className="font-mono text-[0.7rem] tracking-[0.18em] text-white-muted transition-colors duration-300 group-hover:text-gold">
                {c.n}
              </span>
              <h3 className="font-display text-lg font-semibold leading-snug tracking-[-0.01em] text-heading sm:text-xl">
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed text-white-secondary sm:pt-0.5">
                {c.detail}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          {...rv(0.3)}
          className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center"
        >
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-white-muted">
            Accelerate · built &amp; run for you
          </span>
          <Link
            href="/contact"
            data-cursor="link"
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "guarantee" })}
            className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            Book a free strategy call →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
