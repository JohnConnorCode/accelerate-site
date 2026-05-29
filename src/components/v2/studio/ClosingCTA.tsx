"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Mail, Check } from "lucide-react";
import {
  motion, useMotionValue, useSpring, useTransform, useReducedMotion,
} from "framer-motion";
import { MaskReveal } from "./MaskReveal";
import { Kinetic } from "./Kinetic";
import { LivingBlobs } from "./LivingBlobs";
import { Eyebrow, BookCallButton } from "./primitives";

export function ClosingCTA() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // cursor parallax on the headline + a cursor-following glow over the whole
  // section — together they make the section *visibly* respond to the visitor.
  const mxAbs = useMotionValue(0); // px from section's top-left, for the glow
  const myAbs = useMotionValue(0);
  const mxN = useMotionValue(0); // normalized -1..1, for headline parallax
  const myN = useMotionValue(0);
  const sx = useSpring(mxN, { stiffness: 90, damping: 16, mass: 0.6 });
  const sy = useSpring(myN, { stiffness: 90, damping: 16, mass: 0.6 });
  const headX = useTransform(sx, [-1, 1], [-40, 40]);
  const headY = useTransform(sy, [-1, 1], [-22, 22]);
  // the glow is rendered as a radial gradient whose center tracks the mouse
  const glowBg = useTransform(
    [mxAbs, myAbs],
    ([x, y]: number[]) =>
      `radial-gradient(360px circle at ${x}px ${y}px, rgba(var(--accent-rgb), 0.22), transparent 70%)`
  );

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduced) return;
    const r = sectionRef.current?.getBoundingClientRect();
    if (!r) return;
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    mxAbs.set(lx);
    myAbs.set(ly);
    mxN.set((lx / r.width) * 2 - 1);
    myN.set((ly / r.height) * 2 - 1);
  };
  const onLeave = () => {
    mxN.set(0);
    myN.set(0);
  };

  // anchor the glow to the section's centre on mount (so touch devices and the
  // moment before the first mouse-move don't see the glow stuck in a corner)
  useEffect(() => {
    const r = sectionRef.current?.getBoundingClientRect();
    if (!r) return;
    mxAbs.set(r.width / 2);
    myAbs.set(r.height * 0.4);
  }, [mxAbs, myAbs]);

  return (
    <section
      ref={sectionRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="section-y section-divide relative overflow-hidden"
    >
      <LivingBlobs />
      {/* cursor-following glow — visible, unmistakable interactivity */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-[5]"
          style={{ background: glowBg }}
        />
      )}
      {/* top fade — keeps the lime→dark seam from the ValueBand above crisp and
          confident; the atmospheric glow resumes below it, not at the edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-40"
        style={{ background: "linear-gradient(to bottom, var(--bg-base), transparent)" }}
      />
      <div className="page-shell mb-8"><Eyebrow>start</Eyebrow></div>

      <div className="page-shell grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        {/* left: the statement + trust line (fills the column) */}
        <div className="flex flex-col gap-10">
          <motion.div
            style={reduced ? undefined : { x: headX, y: headY }}
            initial={reduced ? false : { opacity: 0, scale: 0.86 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <Kinetic>
              <h2 className="display-1">
                <MaskReveal>
                  Let&apos;s <span className="display-italic">talk.</span>
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
        <div className="flex flex-col gap-7">
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

          <BookCallButton />
          <a
            href="mailto:john@acceleratewith.us"
            data-cursor="link"
            className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-heading"
          >
            <Mail className="h-4 w-4 text-gold" />
            <span className="ink-sweep">john@acceleratewith.us</span>
          </a>
        </div>
      </div>
    </section>
  );
}
