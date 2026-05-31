"use client";

import { useEffect, useRef } from "react";
import {
  motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion,
} from "framer-motion";
import { KineticWord } from "./KineticWord";
import { ScrollClock } from "./ScrollClock";
import { Eyebrow } from "./primitives";

// Manifesto text broken into styled segments; we then split each segment into
// individual words and bind each word's opacity to scroll progress, so the
// reader's scroll creates a visible "reading light" that moves through the text.
const SEGMENTS: { text: string; cls?: string }[] = [
  { text: "Most owners don't have a growth problem. They have a " },
  { text: "time", cls: "text-heading" },
  { text: " problem. So we build systems that handle the repetitive work, turn every inquiry into revenue, and quietly hand your week back." },
];

function buildWords() {
  const out: { w: string; cls?: string; isWord: boolean }[] = [];
  for (const seg of SEGMENTS) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      out.push({ w: part, cls: seg.cls, isWord: part.trim().length > 0 });
    }
  }
  return out;
}

export function Manifesto() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const words = buildWords();
  const wordCount = words.filter((w) => w.isWord).length;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // each word lights up as its slice of scroll progress passes — visible
  // reading wave from dim to bright as the user scrolls through the section.
  const applyReveal = (v: number) => {
    const els = wordRefs.current;
    let wi = 0;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const meta = words[i];
      if (!el || !meta) continue;
      if (!meta.isWord) continue;
      const start = 0.18 + (wi / Math.max(wordCount - 1, 1)) * 0.52;
      const end = start + 0.1;
      const t = Math.min(1, Math.max(0, (v - start) / (end - start)));
      el.style.opacity = String(0.42 + t * 0.58);
      wi++;
    }
  };

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    applyReveal(v);
  });

  useEffect(() => {
    if (reduced) {
      // reduced motion: show everything fully revealed
      wordRefs.current.forEach((el) => { if (el) el.style.opacity = "1"; });
      return;
    }
    applyReveal(scrollYProgress.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // clock parallax — drifts and breathes with scroll progress through the section
  const clockY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const clockScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1.02, 0.94]);
  const clockRot = useTransform(scrollYProgress, [0, 1], [-8, 8]);

  return (
    <section ref={ref} className="section-y section-divide relative overflow-hidden">
      <KineticWord word="TIME" />
      <div className="page-shell page-shell--narrow mb-10"><Eyebrow>the idea</Eyebrow></div>
      <div className="page-shell page-shell--narrow grid items-center gap-12 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16">
        <h2 className="font-display text-[clamp(1.8rem,4.2vw,3.6rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-white-muted">
          {words.map((item, i) => (
            <span
              key={i}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              className={item.cls}
              style={{ opacity: reduced ? 1 : 0.42, transition: reduced ? undefined : "opacity 60ms linear" }}
            >
              {item.w}
            </span>
          ))}
        </h2>

        <motion.div
          className="mx-auto hidden lg:block"
          style={reduced ? undefined : { y: clockY, scale: clockScale, rotate: clockRot }}
        >
          <ScrollClock className="aspect-square w-full max-w-sm" />
        </motion.div>
      </div>
    </section>
  );
}
