"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { trackConversion } from "@/lib/analytics";

export function Hero() {
  const [loaded, setLoaded] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // Content fades + lifts out as you scroll past the hero (the background
  // grid/spotlight stays put — only the text and CTA exit).
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -80]);

  useEffect(() => {
    raf.current = requestAnimationFrame(() => {
      const t = setTimeout(() => setLoaded(true), 90);
      return () => clearTimeout(t);
    });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className={`hero${loaded ? " loaded" : ""}`} id="hero">
      <div className="hero-field" aria-hidden="true">
        <div className="hero-grid-base" />
        <div className="hero-grid-lit" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </div>
      <motion.div className="wrap" style={reduced ? undefined : { opacity: fade, y: lift }}>
        <p className="label eyebrow-anim">AI strategy, automation, and implementation</p>
        <h1 className="h1">
          <span className="line">
            <span>We design and</span>
          </span>
          <span className="line">
            <span style={{ "--d": ".07s" } as CSSProperties}>implement custom AI</span>
          </span>
          <span className="line">
            <span style={{ "--d": ".14s" } as CSSProperties}>solutions that drive</span>
          </span>
          <span className="h1-last">
            <span className="line">
              <span className="strike" style={{ "--d": ".21s" } as CSSProperties}>
                business results
              </span>
            </span>
            <span className="line">
              <span className="swap it" style={{ "--d": ".28s" } as CSSProperties}>
                (revenue)
              </span>
            </span>
          </span>
        </h1>

        <div className={`hero-btm st${loaded ? " in" : ""}`}>
          <div style={{ "--d": "2.4s" } as CSSProperties}>
            <p className="lede">
              We find the bottleneck costing you the most and remove it.
              Strategy, automation, integrations, custom builds. Whatever the
              job takes.
            </p>
          </div>
          <div style={{ "--d": "2.53s" } as CSSProperties}>
            <div className="cta-cluster">
              <Link
                href="/contact"
                onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })}
                className="btn"
              >
                Book a free call <span className="arw">→</span>
              </Link>
            </div>
            <p className="cta-note">
              Thirty minutes. You leave with a written plan: your best
              opportunities, what each is worth, and what it takes. Free, and
              yours to keep.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
