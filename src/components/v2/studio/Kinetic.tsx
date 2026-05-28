"use client";

import type { ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, useVelocity, useReducedMotion } from "framer-motion";

/**
 * Velocity skew — children lean under scroll "G-force" and spring back.
 * The unifying kinetic gesture across the site.
 */
export function Kinetic({
  children,
  className,
  intensity = 1,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 350 });
  const skewY = useTransform(smooth, [-3000, 0, 3000], [5 * intensity, 0, -5 * intensity], { clamp: true });

  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} style={{ skewY, transformOrigin: "left center" }}>
      {children}
    </motion.div>
  );
}
