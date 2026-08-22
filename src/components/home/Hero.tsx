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
  const entranceRaf = useRef<number | undefined>(undefined);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

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

  // 3D transforms are a desktop detail, not a mobile requirement. Touch
  // retains the responsive spotlight below without paying to composite a
  // tilted full-screen grid while the user scrolls.
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let spotlightRaf: number | undefined;
    entranceRaf.current = requestAnimationFrame(() => {
      timer = setTimeout(() => setLoaded(true), 40);
    });

    const el = sectionRef.current;
    if (!el || reduced) return () => {
      if (entranceRaf.current) cancelAnimationFrame(entranceRaf.current);
      if (timer) clearTimeout(timer);
    };

    // The lit grid has one continuous position rather than separate idle and
    // hover animations. At rest it follows a slow, asymmetric orbit. A fine
    // pointer temporarily becomes the target; on leave, the same damped
    // position catches up with wherever the orbit has progressed instead of
    // restarting or snapping to a canned keyframe.
    let pointerHasControl = false;
    let currentX = 50;
    let currentY = 48;
    let targetX = currentX;
    let targetY = currentY;
    let previousTime = performance.now();
    let touchReleaseTimer: ReturnType<typeof setTimeout> | undefined;
    let heroIsVisible = true;

    const idlePosition = (time: number) => {
      const seconds = time / 1000;
      return {
        x: 50 + Math.sin(seconds * 0.13) * 24 + Math.sin(seconds * 0.043 + 0.8) * 6,
        y: 48 + Math.sin(seconds * 0.103 + 1.2) * 18 + Math.cos(seconds * 0.057) * 6,
      };
    };

    const animateSpotlight = (time: number) => {
      const delta = Math.min(time - previousTime, 64);
      previousTime = time;

      if (!pointerHasControl) {
        const idle = idlePosition(time);
        targetX = idle.x;
        targetY = idle.y;
      }

      // Hover should feel connected; the idle return is intentionally more
      // languid so the handoff disappears into the ambient motion.
      const response = pointerHasControl ? 85 : 1400;
      const blend = 1 - Math.exp(-delta / response);
      currentX += (targetX - currentX) * blend;
      currentY += (targetY - currentY) * blend;

      el.style.setProperty("--spotlight-x", `${currentX.toFixed(3)}%`);
      el.style.setProperty("--spotlight-y", `${currentY.toFixed(3)}%`);
      spotlightRaf = requestAnimationFrame(animateSpotlight);
    };

    const startSpotlight = () => {
      if (spotlightRaf !== undefined) return;
      previousTime = performance.now();
      spotlightRaf = requestAnimationFrame(animateSpotlight);
    };

    const stopSpotlight = () => {
      if (spotlightRaf === undefined) return;
      cancelAnimationFrame(spotlightRaf);
      spotlightRaf = undefined;
    };

    const pointSpotlightAt = (clientX: number, clientY: number, tilt: boolean) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      pointerHasControl = true;
      targetX = Math.max(0, Math.min(100, (x / rect.width) * 100));
      targetY = Math.max(0, Math.min(100, (y / rect.height) * 100));

      if (tilt) {
        const normX = (x / rect.width) * 2 - 1;
        const normY = (y / rect.height) * 2 - 1;
        mouseX.set(normX);
        mouseY.set(normY);
      }
    };

    const releasePointerControl = () => {
      pointerHasControl = false;
      mouseX.set(0);
      mouseY.set(0);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointSpotlightAt(e.clientX, e.clientY, true);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (touchReleaseTimer) clearTimeout(touchReleaseTimer);

      // A tap becomes the mobile equivalent of hover. It does not prevent the
      // native gesture, capture the pointer, or alter focus, so links and
      // vertical scrolling remain fully native.
      pointSpotlightAt(e.clientX, e.clientY, false);
      touchReleaseTimer = setTimeout(releasePointerControl, 1050);
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      releasePointerControl();
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave);

    // Do not spend animation frames on a hero that is several sections above
    // the viewport. The orbit is time-based, so it still resumes at the point
    // it would have reached rather than visibly starting over.
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        heroIsVisible = Boolean(entry?.isIntersecting);
        if (heroIsVisible && !document.hidden) startSpotlight();
        else stopSpotlight();
      },
      { rootMargin: "120px 0px" }
    );
    visibilityObserver.observe(el);

    const onVisibilityChange = () => {
      if (document.hidden || !heroIsVisible) stopSpotlight();
      else startSpotlight();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) startSpotlight();

    const onPageShow = () => setLoaded(true);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (entranceRaf.current) cancelAnimationFrame(entranceRaf.current);
      stopSpotlight();
      if (timer) clearTimeout(timer);
      if (touchReleaseTimer) clearTimeout(touchReleaseTimer);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [reduced, mouseX, mouseY]);

  const spatialMotion = !reduced && finePointer;

  return (
    <section ref={sectionRef} className={`hero${loaded ? " loaded" : ""}`} id="hero" style={spatialMotion ? { perspective: "1200px" } : undefined}>
      <motion.div
        className="hero-field"
        aria-hidden="true"
        style={spatialMotion ? {
          y: gridDrift,
          rotateX: gridRotateX,
          rotateY: gridRotateY,
          scale: 1.05, // Prevent edges from showing when tilted
          transformStyle: "preserve-3d"
        } : undefined}
      >
        <div className="hero-grid-base" />
        <div className="hero-grid-lit interactive" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </motion.div>
      <motion.div 
        className="wrap" 
        style={spatialMotion ? {
          opacity: fade, 
          y: lift,
          rotateX: textRotateX,
          rotateY: textRotateY,
          transformStyle: "preserve-3d"
        } : undefined}
      >
        <div className="hero-top">
          <p className={`label eyebrow-anim rv${loaded ? " in" : ""}`}>
            AI systems, built and run for operators
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
              <span className="hero-profit-slot" style={{ overflow: "visible", display: "inline-block" }}>
                <span
                  className="swap it rev-ul hero-profit"
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
