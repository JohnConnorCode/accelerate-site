"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";

const bg = (a: number) =>
  `radial-gradient(circle at 35% 35%, rgba(var(--accent-rgb),${a}), rgba(var(--accent-rgb),0.05) 55%, transparent 72%)`;

/**
 * Dynamic "living shapes" — fluid morphing gradient blobs that morph
 * (border-radius), parallax on scroll, AND drift toward the cursor.
 * GPU-only (transform + filter), theme-aware, reduced-motion safe. No particles.
 */
export function LivingBlobs({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yA = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["-16%", "20%"]);
  const yB = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["14%", "-18%"]);
  const yC = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["-8%", "10%"]);

  // pointer drift (spring-smoothed, normalized -1..1)
  const mx = useSpring(0, { stiffness: 40, damping: 20 });
  const my = useSpring(0, { stiffness: 40, damping: 20 });
  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, mx, my]);

  const pxA = useTransform(mx, [-1, 1], ["-4%", "4%"]);
  const pyA = useTransform(my, [-1, 1], ["-4%", "4%"]);
  const pxB = useTransform(mx, [-1, 1], ["3%", "-3%"]);
  const pyB = useTransform(my, [-1, 1], ["3%", "-3%"]);
  const pxC = useTransform(mx, [-1, 1], ["6%", "-6%"]);
  const pyC = useTransform(my, [-1, 1], ["5%", "-5%"]);

  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}>
      <motion.div style={{ y: yA }} className="absolute -left-[14%] top-[0%] h-[48vw] w-[48vw]">
        <motion.div style={{ x: pxA, y: pyA }} className="h-full w-full">
          <div className="living-blob h-full w-full" style={{ background: bg(0.5) }} />
        </motion.div>
      </motion.div>
      <motion.div style={{ y: yB }} className="absolute -right-[12%] bottom-[-12%] h-[42vw] w-[42vw]">
        <motion.div style={{ x: pxB, y: pyB }} className="h-full w-full">
          <div className="living-blob living-blob--alt h-full w-full" style={{ background: bg(0.34) }} />
        </motion.div>
      </motion.div>
      <motion.div style={{ y: yC }} className="absolute left-[42%] top-[34%] h-[26vw] w-[26vw]">
        <motion.div style={{ x: pxC, y: pyC }} className="h-full w-full">
          <div className="living-blob h-full w-full" style={{ background: bg(0.22), animationDelay: "-8s" }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
