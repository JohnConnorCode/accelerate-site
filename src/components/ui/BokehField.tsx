"use client";

import { cn } from "@/lib/utils";

/**
 * BokehField — warm ambient bokeh for Tier 3 hero backgrounds.
 * Pure CSS, no canvas. Visually distinct from StarField.
 *
 * 3 layers:
 *   1. Color pools — large soft washes that tint the background warm
 *   2. Bokeh circles — medium glowing orbs (no CSS blur — gradient handles softness)
 *   3. Sparkle dots — small bright gold accents that catch the eye
 */

const pools = [
  { x: "25%", y: "35%", w: 600, h: 500, o: 0.12, dur: 30, delay: 0, drift: 0 },
  { x: "75%", y: "45%", w: 500, h: 400, o: 0.10, dur: 26, delay: -8, drift: 1 },
  { x: "50%", y: "75%", w: 550, h: 350, o: 0.08, dur: 34, delay: -16, drift: 2 },
];

const bokeh = [
  { x: "14%", y: "24%", size: 160, o: 0.14, dur: 22, delay: 0, drift: 0 },
  { x: "70%", y: "28%", size: 130, o: 0.12, dur: 26, delay: -4, drift: 1 },
  { x: "42%", y: "58%", size: 180, o: 0.13, dur: 30, delay: -8, drift: 2 },
  { x: "86%", y: "62%", size: 110, o: 0.11, dur: 20, delay: -12, drift: 0 },
  { x: "25%", y: "72%", size: 140, o: 0.12, dur: 24, delay: -6, drift: 1 },
  { x: "58%", y: "15%", size: 100, o: 0.14, dur: 28, delay: -3, drift: 2 },
];

const sparkles = [
  { x: "32%", y: "22%", size: 6, o: 0.6, dur: 18, delay: -2, drift: 0 },
  { x: "53%", y: "42%", size: 5, o: 0.5, dur: 16, delay: -7, drift: 1 },
  { x: "78%", y: "18%", size: 7, o: 0.55, dur: 20, delay: -5, drift: 2 },
  { x: "18%", y: "52%", size: 5, o: 0.45, dur: 14, delay: -9, drift: 0 },
  { x: "63%", y: "68%", size: 6, o: 0.5, dur: 22, delay: -11, drift: 1 },
  { x: "88%", y: "42%", size: 4, o: 0.4, dur: 17, delay: -3, drift: 2 },
  { x: "43%", y: "78%", size: 5, o: 0.45, dur: 19, delay: -13, drift: 0 },
  { x: "8%", y: "38%", size: 6, o: 0.5, dur: 21, delay: -1, drift: 1 },
];

export function BokehField({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none motion-safe:block motion-reduce:hidden",
        className
      )}
      aria-hidden="true"
    >
      {/* Layer 1: Color pools — visible warm tint */}
      {pools.map((p, i) => (
        <div
          key={`pool-${i}`}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: p.h,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(ellipse, rgba(var(--accent-rgb), ${p.o}) 0%, rgba(var(--accent-rgb), ${p.o * 0.3}) 40%, transparent 70%)`,
            animation: `bokeh-drift-${p.drift} ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Layer 2: Bokeh circles — no CSS blur, gradient handles softness */}
      {bokeh.map((b, i) => (
        <div
          key={`bokeh-${i}`}
          className="absolute rounded-full"
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, rgba(var(--accent-rgb), ${b.o}) 0%, rgba(var(--accent-rgb), ${b.o * 0.4}) 35%, rgba(var(--accent-rgb), ${b.o * 0.1}) 60%, transparent 80%)`,
            animation: `bokeh-drift-${b.drift} ${b.dur}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      {/* Layer 3: Sparkle dots — sharp bright accents */}
      {sparkles.map((s, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute rounded-full"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            transform: "translate(-50%, -50%)",
            backgroundColor: `rgba(var(--accent-rgb), ${s.o})`,
            boxShadow: `0 0 ${s.size * 2}px ${s.size}px rgba(var(--accent-rgb), ${s.o * 0.3})`,
            animation: `bokeh-drift-${s.drift} ${s.dur}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Layer 4: Fine grid for structure */}
      <div className="absolute inset-0 grid-overlay opacity-[0.07]" />
    </div>
  );
}
