"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Scroll-linked parallax wrapper. Framer Motion, not GSAP — the homepage
 * (unlike the legacy src/components/sections/* tree) has zero GSAP in its
 * bundle today, and Framer's useScroll is already loaded for Hero's own
 * scroll-fade, so this adds no new script weight to a page with a
 * documented mobile-LCP history (see commit c7b11cc).
 *
 * `speed` mirrors src/components/ui/ParallaxLayer.tsx's API (-1..1) for a
 * familiar mental model, but each instance drives its own element-scoped
 * scroll progress rather than GSAP ScrollTrigger.
 */
export function ScrollParallax({
  speed = 0.2,
  className,
  children,
}: {
  speed?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // 170px/unit of speed — tuned up from an earlier 56px/unit pass that read
  // as barely-there over a full element scroll-through (~1000-2000px of
  // scroll for a section-height target). This keeps the drift felt without
  // needing per-breakpoint tuning, since useScroll's element-scoped offset
  // already scales the range to each target's own scroll-through distance.
  const distance = 170 * speed;
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div ref={ref} className={className} style={reduced ? undefined : { y }}>
      {children}
    </motion.div>
  );
}
