"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useReducedMotion, type MotionValue } from "framer-motion";

/**
 * "Reclaim your time" object — a precision clock whose hands wind as you scroll
 * and a lime arc that draws with scroll progress. Hands rotate about the true
 * dial center (transform-box: view-box). GPU-only, theme-aware, reduced-safe.
 */
const C = 120; // center in viewBox units
const handStyle = (rotate: MotionValue<number>) =>
  ({ rotate, transformBox: "view-box", transformOrigin: `${C}px ${C}px` }) as const;
// Round trig output to fixed precision so SSR + client produce identical strings.
// Without this, Math.cos/sin can drift in the last digit between Node and browser,
// triggering a hydration mismatch on every tick mark.
const r = (n: number) => Math.round(n * 1000) / 1000;

export function ScrollClock({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.001 });
  const minute = useTransform(p, [0, 1], reduced ? [0, 0] : [0, 1080]); // 3 turns
  const hour = useTransform(p, [0, 1], reduced ? [0, 0] : [0, 90]);

  return (
    <div ref={ref} className={className}>
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="A clock whose time advances as you scroll — reclaim your time.">
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const big = i % 5 === 0;
          const r1 = big ? 96 : 100;
          const r2 = 104;
          return (
            <line
              key={i}
              x1={r(C + Math.cos(a) * r1)}
              y1={r(C + Math.sin(a) * r1)}
              x2={r(C + Math.cos(a) * r2)}
              y2={r(C + Math.sin(a) * r2)}
              stroke="var(--gold-base)"
              strokeWidth={big ? 2 : 1}
              strokeLinecap="round"
              opacity={big ? 0.85 : 0.3}
            />
          );
        })}

        {/* base ring + scroll-progress arc */}
        <circle cx={C} cy={C} r="110" fill="none" stroke="var(--border-glass)" strokeWidth="1.5" />
        <motion.circle
          cx={C}
          cy={C}
          r="110"
          fill="none"
          stroke="var(--gold-base)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          style={{ pathLength: p, rotate: -90, transformBox: "view-box", transformOrigin: `${C}px ${C}px` }}
        />

        {/* hands — rotate about true center */}
        <motion.line x1={C} y1={C} x2={C} y2="66" stroke="var(--heading-color)" strokeWidth="5" strokeLinecap="round" style={handStyle(hour)} />
        <motion.line x1={C} y1={C} x2={C} y2="44" stroke="var(--gold-base)" strokeWidth="3" strokeLinecap="round" style={handStyle(minute)} />
        {/* counterweight tail on the minute hand for balance */}
        <motion.line x1={C} y1={C} x2={C} y2={C + 16} stroke="var(--gold-base)" strokeWidth="3" strokeLinecap="round" style={handStyle(minute)} />

        <circle cx={C} cy={C} r="6" fill="var(--bg-base)" stroke="var(--gold-base)" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
