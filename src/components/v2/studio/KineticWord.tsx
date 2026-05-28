"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Dynamic background: an oversized outlined "ghost word" that parallaxes as the
 * section scrolls through view. Editorial + on-brand — not particles.
 */
export function KineticWord({ word, className }: { word: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["10%", "-12%"]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 flex items-center overflow-hidden ${className ?? ""}`}
    >
      <motion.span
        style={{ x }}
        className="text-stroke whitespace-nowrap font-display text-[22vw] font-extrabold leading-none opacity-[0.055]"
      >
        {word}
      </motion.span>
    </div>
  );
}
