"use client";

import { Mail, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { MaskReveal } from "./MaskReveal";
import { Kinetic } from "./Kinetic";
import { Eyebrow, BookCallButton } from "./primitives";

export function ClosingCTA() {
  const reduced = useReducedMotion();

  return (
    <section className="section-y section-divide relative overflow-hidden">
      {/* top fade — keeps the lime→dark seam from the ValueBand above crisp and
          confident; the atmospheric glow resumes below it, not at the edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-40"
        style={{ background: "linear-gradient(to bottom, var(--bg-base), transparent)" }}
      />
      <div className="page-shell mb-8"><Eyebrow>Start</Eyebrow></div>

      <div className="page-shell grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        {/* left: the statement + trust line (fills the column) */}
        <div className="flex flex-col gap-10">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.86 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <Kinetic>
              <h2 className="display-1">
                <MaskReveal>
                  Let&apos;s talk.
                </MaskReveal>
              </h2>
            </Kinetic>
          </motion.div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
            <span>Free</span>
            <span>·</span>
            <span>30 minutes</span>
            <span>·</span>
            <span>No obligation</span>
            <span>·</span>
            <span>Direct to the founder</span>
          </div>
        </div>

        {/* right: the offer + what you walk away with */}
        <motion.div
          className="flex flex-col gap-7"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          <p className="text-lg leading-relaxed text-white-secondary">
            A free 30-minute call. We&apos;ll map exactly where AI-powered systems can
            drive revenue and give you your time back, whether you work with us or not.
          </p>

          {/* risk reversal — what you walk away with, free */}
          <ul className="flex flex-col gap-2.5">
            {[
              "A prioritized roadmap of your biggest wins",
              "ROI projections mapped to your business",
              "Yours to keep, even if we never work together",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-white-secondary">
                <Check className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <BookCallButton location="home_closing" label="Book a free strategy call" />
          <a
            href="mailto:john@acceleratewith.us"
            data-cursor="link"
            className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-heading"
          >
            <Mail className="h-4 w-4 text-gold" />
            <span className="ink-sweep">john@acceleratewith.us</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
