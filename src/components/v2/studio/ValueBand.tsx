"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MaskReveal } from "./MaskReveal";
import { OptimizationLoop } from "./OptimizationLoop";
import { BookCallButton } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ValueBand() {
  const reduced = useReducedMotion();
  // staggered entry for the supporting content (the heading masks in on its own)
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  };
  const item = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      };

  return (
    <section
      className="section-y relative overflow-hidden"
      style={{ background: "var(--gold-base)", color: "var(--btn-primary-text)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[8%] -top-[30%] h-[60vw] w-[60vw] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(0,0,0,0.45), transparent 65%)" }}
      />

      <div className="page-shell page-shell--narrow relative grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        {/* left: statement */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.p variants={item} className="mb-7 font-mono text-xs uppercase tracking-[0.3em] opacity-70">the model</motion.p>
          <h2 className="font-display text-[clamp(2.6rem,6vw,6rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            <MaskReveal>We build the systems.</MaskReveal>
            <MaskReveal delay={0.12}>Then we run them.</MaskReveal>
          </h2>
          <motion.p variants={item} className="mt-7 max-w-md text-lg leading-relaxed opacity-80">
            Not another tool to manage. A team that builds your systems, runs them,
            and keeps them sharp, so your growth stops depending on your hours.
          </motion.p>
          <motion.div variants={item}>
            <BookCallButton variant="inverse" location="home_valueband" label="Book a free strategy call" className="mt-9" />
          </motion.div>

          {/* always-on cue — on-brand "it keeps running" indicator */}
          <motion.div variants={item} className="mt-10 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] opacity-70">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-black" />
            </span>
            Always on · runs while you sleep
          </motion.div>
        </motion.div>

        {/* right: the continuous improvement loop — we iterate on the data so it
            keeps getting sharper (interactive: hover a stage to inspect it) */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30, scale: 0.97 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          className="lg:self-center"
        >
          <OptimizationLoop />
        </motion.div>
      </div>
    </section>
  );
}
