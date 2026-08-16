"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import { trackConversion } from "@/lib/analytics";

function ScrambleText({ text, delay = 0, trigger = true }: { text: string, delay?: number, trigger?: boolean }) {
  const [display, setDisplay] = useState(text.replace(/./g, "\u00A0")); // Non-breaking spaces for layout stability
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  
  useEffect(() => {
    if (!trigger) return;
    
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let iteration = 0;
      interval = setInterval(() => {
        setDisplay(text.split("").map((letter, index) => {
          if (index < iteration) {
            return text[index];
          }
          return chars[Math.floor(Math.random() * chars.length)];
        }).join(""));
        
        if (iteration >= text.length) {
          clearInterval(interval);
        }
        
        iteration += 1; // Faster scramble so it resolves as it slides into view
      }, 30);
    }, delay);
    
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, delay, trigger]);

  return <span className="inline-block min-w-max">{display}</span>;
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
      timer = setTimeout(() => setLoaded(true), 90);
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

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer) clearTimeout(timer);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
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
            <span className="line">
              <span>We architect and deploy</span>
            </span>
            <span className="line">
              <span style={{ "--d": ".07s" } as CSSProperties}>
                <ScrambleText text="intelligent automation" delay={1250} trigger={loaded} />
              </span>
            </span>
            <span className="line">
              <span style={{ "--d": "2.1s" } as CSSProperties}>
                to scale your{" "}
                <span className="strike" style={{ "--d": ".21s" } as CSSProperties}>
                  productivity
                </span>{" "}
                <span className="swap it rev-ul" style={{ "--d": ".28s", position: "relative", zIndex: 10 } as CSSProperties}>
                  <ScrambleText text="PROFIT" delay={4750} trigger={loaded} />
                </span>
              </span>
            </span>
          </h1>
        </div>

        <div className={`hero-btm st${loaded ? " in" : ""}`}>
          <div style={{ "--d": "5.3s" } as CSSProperties}>
            <p className="lede">
              We identify the bottlenecks choking your margins and engineer them out of existence. Seamless CRM integrations, voice-to-text workflows, and fully autonomous lead capture.
            </p>
          </div>
          <div style={{ "--d": "5.5s" } as CSSProperties}>
            <div className="cta-cluster">
              <Link
                href="/contact"
                onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })}
                className="btn"
              >
                Book a free call <span className="arw" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
