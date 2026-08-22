"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import { trackConversion } from "@/lib/analytics";

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
            <span className="h1-word-row">
              {["Your", "team", "should", "be", "doing", "the", "work"].map((w, i) => (
                <span key={`${w}-${i}`} className="word">
                  <span style={{ "--d": `${0.16 + i * 0.1}s` } as CSSProperties}>{w}</span>
                </span>
              ))}
            </span>
            <span className="h1-word-row hero-accent-row">
              {["only", "they", "can", "do."].map((w, i) => (
                <span key={w} className="word">
                  <span className="it" style={{ "--d": `${0.92 + i * 0.1}s` } as CSSProperties}>{w}</span>
                </span>
              ))}
            </span>
          </h1>
          <div
            className="hero-inline-cta"
            style={{ "--d": "1.50s" } as CSSProperties}
          >
            <Link
              href="/contact"
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })}
              className="btn"
            >
              Book a free strategy session <span className="arw" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className={`hero-btm st${loaded ? " in" : ""}`}>
          <div style={{ "--d": "1.90s" } as CSSProperties}>
            <p className="lede">
              We take intake, follow-up, and scheduling off them. Owners typically get something like 10 hours a week per person back. That time goes to the work that actually makes the business.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
