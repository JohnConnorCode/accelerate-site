"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Slim page-reading progress bar — ties the whole page together as one guided
 * story. Springs for a smooth, premium feel. Decorative only.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: x }}
      className="fixed inset-x-0 top-0 z-[9997] h-0.5 origin-left bg-[var(--fg)]"
    />
  );
}
