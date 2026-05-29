"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion, AnimatePresence, animate,
  useMotionValue, useScroll, useTransform, useReducedMotion,
} from "framer-motion";
import { EASE } from "@/lib/animations";

// The continuous improvement loop — what "we run it, for good" means in practice.
// We measure outcomes, learn from the data, tune the systems, compound the gains —
// then run it again.
const STAGES = [
  { n: "01", t: "Measure", d: "Every outcome tracked: what converts, what stalls." },
  { n: "02", t: "Learn", d: "We surface the patterns hiding in your data." },
  { n: "03", t: "Optimize", d: "We tune the systems to do more of what works." },
  { n: "04", t: "Improve", d: "Sharper results, then the loop runs again." },
] as const;

const SECTOR = 90;
const PLACEMENTS = [
  { top: "11%", left: "50%" }, // 01 top
  { top: "50%", left: "89%" }, // 02 right
  { top: "89%", left: "50%" }, // 03 bottom
  { top: "50%", left: "11%" }, // 04 left
];
const BAR_H = [0.34, 0.48, 0.62, 0.8, 1];

export function OptimizationLoop({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(1);
  const paused = useRef(false);
  // monotonically-increasing rotation so the dot always travels CLOCKWISE along
  // the arc — never straight-lines through the center.
  const rot = useMotionValue(0);

  // scroll-driven parallax: the loop drifts and gently scales as you scroll past
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yDrift = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const scaleIn = useTransform(scrollYProgress, [0, 0.35, 0.7, 1], [0.9, 1, 1, 0.96]);

  // jump to a stage going the short forward (clockwise) way
  const goTo = (i: number, dur = 0.55) => {
    setActive(i);
    const cur = rot.get();
    const curSector = Math.round(cur / SECTOR);
    const forwardSteps = ((i - (curSector % STAGES.length)) % STAGES.length + STAGES.length) % STAGES.length;
    const target = cur + (forwardSteps === 0 ? 0 : forwardSteps) * SECTOR;
    if (target !== cur) animate(rot, target, { duration: dur, ease: EASE });
  };

  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!paused.current) {
        setActive((prev) => {
          const next = (prev + 1) % STAGES.length;
          if (next === 0) setCycle((c) => c + 1);
          animate(rot, rot.get() + SECTOR, { duration: 0.75, ease: EASE });
          return next;
        });
      }
      t = setTimeout(tick, 2100);
    };
    t = setTimeout(tick, 2100);
    return () => clearTimeout(t);
  }, [reduced, rot]);

  const cur = STAGES[active]!;
  const lit = ((cycle - 1) % BAR_H.length) + 1;

  return (
    <motion.div
      ref={ref}
      style={{ y: reduced ? 0 : yDrift, scale: reduced ? 1 : scaleIn }}
      className={`relative mx-auto aspect-square w-full max-w-[440px] ${className ?? ""}`}
    >
      {/* dashed loop track (fades in on enter) */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
        <motion.circle
          cx="50" cy="50" r="39"
          fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="0.5"
          strokeDasharray="1 2.6" strokeLinecap="round"
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ transformOrigin: "50% 50%" }}
        />
      </svg>

      {/* traveling dot — rotating wrapper produces true arc motion (no straight-line shortcut) */}
      {!reduced && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ rotate: rot, transformOrigin: "50% 50%" }}
        >
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: "11%" }}>
            <span
              className="block h-2.5 w-2.5 rounded-full bg-black"
              style={{ boxShadow: "0 0 0 5px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.18)" }}
            />
          </div>
        </motion.div>
      )}

      {/* stage nodes — stagger in on enter, hover snaps the loop to that stage */}
      {STAGES.map((s, i) => {
        const p = PLACEMENTS[i]!;
        const on = i === active;
        return (
          <motion.button
            key={s.n}
            type="button"
            aria-label={`${s.t}: ${s.d}`}
            onMouseEnter={() => {
              paused.current = true;
              goTo(i);
            }}
            onMouseLeave={() => {
              paused.current = false;
            }}
            data-cursor="link"
            className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono"
            style={{
              top: p.top,
              left: p.left,
              background: "#07080A",
              color: on ? "var(--gold-base)" : "rgba(198,255,61,0.65)",
            }}
            initial={{ scale: 0.3, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.22 + i * 0.09, type: "spring", stiffness: 340, damping: 22 }}
            animate={{
              width: on ? 46 : 36,
              height: on ? 46 : 36,
              boxShadow: on
                ? "0 0 0 7px rgba(0,0,0,0.10), 0 12px 28px rgba(0,0,0,0.22)"
                : "0 4px 14px rgba(0,0,0,0.12)",
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-xs font-bold">{s.n}</span>
          </motion.button>
        );
      })}

      {/* center: stage detail (crossfade) + compounding indicator */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center px-[19%] text-center sm:px-[24%]"
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
      >
        <div className="flex min-h-[92px] flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-black/45">{cur.n} · the loop</p>
              <h3 className="mt-1 font-display text-[1.6rem] font-extrabold leading-none tracking-[-0.02em] text-black">
                {cur.t}
              </h3>
              <p className="mx-auto mt-2 max-w-[18ch] text-[0.74rem] leading-snug text-black/65">{cur.d}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* compounding gains — fills another bar each full cycle */}
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <div className="flex h-7 items-end gap-1">
            {BAR_H.map((h, i) => (
              <motion.span
                key={i}
                className="w-1.5 rounded-[2px] bg-black"
                animate={{ height: `${h * 100}%`, opacity: i < lit ? 1 : 0.22 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
              />
            ))}
          </div>
          <p className="font-mono text-[0.5rem] uppercase tracking-[0.22em] text-black/50">sharper every cycle</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
