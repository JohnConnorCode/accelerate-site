"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";

/**
 * Clip-mask reveal: children slide up from behind a mask when scrolled into view.
 * The signature on-brand entrance (matches the hero). Reduced-motion safe.
 *
 * The IntersectionObserver is attached to the OUTER (un-transformed) mask span —
 * not the inner span, which starts displaced 115% down. Observing the displaced
 * child made the trigger unreliable and left headings permanently hidden. A timed
 * fallback guarantees the headline is never stuck behind the mask.
 */
export function MaskReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const [forced, setForced] = useState(false);

  // Safety net: if the observer never flips (Lenis / hydration edge cases),
  // reveal anyway so a headline can never remain invisible.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setForced(true), 1200);
    return () => clearTimeout(t);
  }, [reduced]);

  const revealed = inView || forced;

  return (
    <span ref={ref} className={`block overflow-hidden pb-[0.12em] ${className ?? ""}`}>
      <motion.span
        className="block"
        initial={reduced ? false : { y: "115%" }}
        animate={reduced ? undefined : { y: revealed ? "0%" : "115%" }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}
