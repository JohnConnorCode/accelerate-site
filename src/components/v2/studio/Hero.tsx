"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { Kinetic } from "./Kinetic";
import { OpsFeed } from "../living/OpsFeed";
import { BookCallButton } from "./primitives";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  // hero content fades + drifts up as you scroll past it
  // (driven by the hero section's own scroll progress, not the page's)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section ref={ref} className="relative flex min-h-screen items-center overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-32">
      <motion.div
        style={reduced ? undefined : { opacity: fade, y: lift }}
        className="page-shell grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
      >
        {/* left — message */}
        <div className="relative">
          <p className="eyebrow hero-fade mb-7" style={{ "--hero-delay": "0.1s" } as React.CSSProperties}>
            Custom AI, built and run for you
          </p>

          <Kinetic intensity={1.1}>
            <h1 className="font-display font-extrabold leading-[1.02] tracking-[-0.035em] text-[clamp(2.4rem,4.6vw,4.75rem)] text-heading">
              {/* pb on each mask span so descenders (y, g) and italic tails aren't clipped */}
              <span className="block overflow-hidden pb-[0.12em]">
                <span className="hero-rise block" style={{ "--hero-delay": "0.12s" } as React.CSSProperties}>Earn more money.</span>
              </span>
              <span className="block overflow-hidden pb-[0.12em]">
                <span className="hero-rise block" style={{ "--hero-delay": "0.22s" } as React.CSSProperties}>Reclaim your time.</span>
              </span>
              <span className="block overflow-hidden pb-[0.2em]">
                <span className="hero-rise block" style={{ "--hero-delay": "0.32s" } as React.CSSProperties}>
                  <span className="display-italic">Scale with ease.</span>
                </span>
              </span>
            </h1>
          </Kinetic>

          <p
            className="hero-fade-up mt-7 max-w-md text-base leading-relaxed text-white-secondary"
            style={{ "--hero-delay": "0.7s" } as React.CSSProperties}
          >
            Not another tool to manage. A custom operation we build and run
            with you, handling the work so you can focus on what grows the business.
          </p>

          <div
            className="hero-fade-up mt-8 flex flex-col items-start gap-4 sm:mt-9 sm:flex-row sm:items-center sm:gap-6"
            style={{ "--hero-delay": "0.85s" } as React.CSSProperties}
          >
            <BookCallButton label="Book a free strategy call" />
            <Link
              href="/services"
              data-cursor="link"
              className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
            >
              See how it works →
            </Link>
          </div>

          <p
            className="hero-fade mt-6 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white-muted"
            style={{ "--hero-delay": "1s" } as React.CSSProperties}
          >
            Free 30-minute call · roadmap + ROI projection, yours to keep
          </p>
        </div>

        {/* right — hero visual: the live operations feed (the product, working).
            Now shown on every breakpoint so mobile visitors see the product, too. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.5 }}
          className="relative mt-2 lg:mt-0"
        >
          <OpsFeed className="w-full shadow-2xl shadow-black/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
