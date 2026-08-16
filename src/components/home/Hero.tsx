"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import { trackConversion } from "@/lib/analytics";

// Original scramble effect, restored verbatim from the last version that
// shipped — same 30ms constant cadence, same simple "flip through random
// glyphs until it locks left-to-right" mechanic. Later attempts to make
// this "smoother" (per-letter blur, eased cadence, splitting the phrase
// into two independently-timed words) made it worse, not better; this is
// what was actually working.
function ScrambleText({ text, delay = 0, trigger = true }: { text: string; delay?: number; trigger?: boolean }) {
  const [display, setDisplay] = useState(text.replace(/./g, " ")); // Non-breaking spaces for layout stability
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";

  useEffect(() => {
    if (!trigger) return;

    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let iteration = 0;
      interval = setInterval(() => {
        setDisplay(
          text
            .split("")
            .map((letter, index) => {
              if (index < iteration) {
                return letter;
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(interval);
        }

        iteration += 1;
      }, 30);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, delay, trigger]);

  return <span className="inline-block max-w-full">{display}</span>;
}

export function Hero() {
  const [loaded, setLoaded] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const gridDrift = useTransform(scrollYProgress, [0, 1], [0, 130]);

  // 3D Tilt Values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for the tilt
  const springConfig = { damping: 25, stiffness: 120 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Rotate values based on normalized coordinates (-1 to 1)
  const gridRotateX = useTransform(smoothY, [-1, 1], [4, -4]); 
  const gridRotateY = useTransform(smoothX, [-1, 1], [-4, 4]);

  // Text tilts the opposite way for intense spatial parallax
  const textRotateX = useTransform(smoothY, [-1, 1], [-2, 2]);
  const textRotateY = useTransform(smoothX, [-1, 1], [2, -2]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    raf.current = requestAnimationFrame(() => {
      timer = setTimeout(() => setLoaded(true), 40);
    });

    const el = sectionRef.current;
    if (!el || reduced) return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer) clearTimeout(timer);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Update CSS vars for the flashlight
      el.style.setProperty("--mouse-x", `${x}px`);
      el.style.setProperty("--mouse-y", `${y}px`);

      // Update MotionValues for the 3D tilt
      const normX = (x / rect.width) * 2 - 1;
      const normY = (y / rect.height) * 2 - 1;
      mouseX.set(normX);
      mouseY.set(normY);
    };

    const onPointerLeave = () => {
      mouseX.set(0);
      mouseY.set(0);
    }

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);

    const onPageShow = () => setLoaded(true);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer) clearTimeout(timer);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [reduced, mouseX, mouseY]);

  return (
    <section ref={sectionRef} className={`hero${loaded ? " loaded" : ""}`} id="hero" style={{ perspective: "1200px" }}>
      <motion.div
        className="hero-field"
        aria-hidden="true"
        style={reduced ? undefined : { 
          y: gridDrift,
          rotateX: gridRotateX,
          rotateY: gridRotateY,
          scale: 1.05, // Prevent edges from showing when tilted
          transformStyle: "preserve-3d"
        }}
      >
        <div className="hero-grid-base" />
        <div className="hero-grid-lit interactive" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </motion.div>
      <motion.div 
        className="wrap" 
        style={reduced ? undefined : { 
          opacity: fade, 
          y: lift,
          rotateX: textRotateX,
          rotateY: textRotateY,
          transformStyle: "preserve-3d"
        }}
      >
        <div className="hero-top">
          <p className={`label eyebrow-anim rv${loaded ? " in" : ""}`}>
            AI strategy, automation, and implementation
          </p>
          <h1 className="h1">
            {/* "We architect and deploy intelligent automation to scale
                your productivity" flows as ONE continuous flex-wrap row —
                not split into separate containers per "sentence," which is
                what forced awkward line breaks regardless of how much room
                was actually left (e.g. "deploy" stranded alone with empty
                space beside it). Each word still carries its own --d so
                the reveal cascade reads identically to before; only the
                line-break decision is now the browser's, based on real
                available width. */}
            <span className="h1-word-row">
              {["We", "architect", "and", "deploy"].map((w, i) => (
                <span key={w} className="word">
                  <span style={{ "--d": `${0.20 + i * 0.20}s` } as CSSProperties}>{w}</span>
                </span>
              ))}
              {/* "intelligent automation" — the original single combined
                  scramble (ScrambleText below), restored verbatim. This is
                  the effect and speed that was actually working. */}
              <span className="word">
                <span style={{ "--d": "1.00s" } as CSSProperties}>
                  <ScrambleText text="intelligent automation" delay={1250} trigger={loaded} />
                </span>
              </span>
              {["to", "scale", "your"].map((w, i) => (
                <span key={w} className="word">
                  <span style={{ "--d": `${2.20 + i * 0.20}s` } as CSSProperties}>{w}</span>
                </span>
              ))}
              <span className="word">
                <span style={{ "--d": "2.80s" } as CSSProperties}>
                  <span className="strike">productivity</span>
                </span>
              </span>
            </span>
            {/* PROFIT + CTA are a deliberate second row, always starting
                below the paragraph above regardless of viewport width —
                not part of the natural reflow. PROFIT stays OUT of the
                .word system: plain text, pure opacity/blur fade (.swap),
                no scramble and no slide-up. The CTA gets the same pure
                blur-in treatment and reveals once the underline finishes
                drawing. */}
            <span className="hero-row-cta">
              <span style={{ overflow: "visible", display: "inline-block" }}>
                <span
                  className="swap it rev-ul"
                  style={{ position: "relative", zIndex: 10, display: "inline-block", transform: "translateY(0.12em)", lineHeight: 1.25, paddingTop: "0.1em" } as CSSProperties}
                >
                  PROFIT
                </span>
              </span>
              <span
                className="hero-inline-cta"
                style={{ "--d": "6.10s" } as CSSProperties}
              >
                <Link
                  href="/contact"
                  onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })}
                  className="btn"
                >
                  Book a free strategy session <span className="arw" aria-hidden="true">→</span>
                </Link>
              </span>
            </span>
          </h1>
        </div>

        <div className={`hero-btm st${loaded ? " in" : ""}`}>
          {/* Fades in over a second after the CTA (6.10s), not
              simultaneously with it — a deliberate trailing beat. */}
          <div style={{ "--d": "7.30s" } as CSSProperties}>
            <p className="lede">
              We identify the bottlenecks choking your margins and engineer them out of existence. Seamless CRM integrations, voice-to-text workflows, and fully autonomous lead capture.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
