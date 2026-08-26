"use client";

import { useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

export function MediaParallax({
  children,
  className = "",
  distance = 5,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rawY = useTransform(scrollYProgress, [0, 1], [`-${distance}%`, `${distance}%`]);
  const y = useSpring(rawY, { stiffness: 180, damping: 30, mass: 0.22 });

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`} data-media-parallax>
      <motion.div
        className="absolute inset-x-0 -inset-y-[8%] motion-reduce:inset-0"
        style={!mounted || reduced ? undefined : { y }}
        data-media-parallax-layer
      >
        {children}
      </motion.div>
    </div>
  );
}
