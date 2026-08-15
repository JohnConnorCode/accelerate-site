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

  // Content fades + lifts out as you scroll past the hero. The backdrop
  // grid drifts the opposite direction at a slower rate — a real parallax
  // separation between foreground text and background instrumentation,
  // off the same scroll progress so there's no second scroll listener.
  // This only ever runs post-scroll, well after the hero has painted, so
  // it can't touch LCP the way the (removed) hero-panel entrance did.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const gridDrift = useTransform(scrollYProgress, [0, 1], [0, 130]);

  useEffect(() => {
    // The timeout id has to live out here. Returning a cleanup from inside the
    // rAF callback does nothing: rAF discards the return value, so the old
    // version cancelled the frame but never the timer.
    let timer: ReturnType<typeof setTimeout> | undefined;
    raf.current = requestAnimationFrame(() => {
      timer = setTimeout(() => setLoaded(true), 90);
    });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <section ref={sectionRef} className={`hero${loaded ? " loaded" : ""}`} id="hero">
      <motion.div
        className="hero-field"
        aria-hidden="true"
        style={reduced ? undefined : { y: gridDrift }}
      >
        <div className="hero-grid-base" />
        <div className="hero-grid-lit" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </motion.div>
      <motion.div className="wrap" style={reduced ? undefined : { opacity: fade, y: lift }}>
        {/* Grouped so mobile can space-between this block and .hero-btm —
            see `.hero-band .hero .wrap` in globals.css. */}
        <div className="hero-top">
          <p className={`label eyebrow-anim rv${loaded ? " in" : ""}`}>
            AI strategy, automation, and implementation
          </p>
          <h1 className="h1">
            {/* One phrase-per-line structure for every breakpoint — an
                earlier attempt regrouped these into fewer, "wider" lines
                specifically for mobile, but on a real phone the merged
                phrases ("We design and implement", "custom AI solutions
                that drive") were too long to fit and wrapped mid-phrase
                anyway, producing ugly orphan words AND no real line-count
                win. Mobile spacing is handled with type size/line-height in
                globals.css (`.hero .h1`) instead — see the mobile media
                query there. */}
            <span className="line">
              <span>We design and implement</span>
            </span>
            <span className="line">
              <span style={{ "--d": ".07s" } as CSSProperties}>custom AI solutions</span>
            </span>
            <span className="line">
              <span style={{ "--d": ".14s" } as CSSProperties}>
                that drive{" "}
                <span className="strike" style={{ "--d": ".21s" } as CSSProperties}>
                  business results
                </span>
              </span>
            </span>
            <span className="line">
              <span className="swap it" style={{ "--d": ".28s" } as CSSProperties}>
                (revenue)
              </span>
            </span>
          </h1>
        </div>

        <div className={`hero-btm st${loaded ? " in" : ""}`}>
          <div style={{ "--d": "1.05s" } as CSSProperties}>
            <p className="lede">
              We find the bottleneck costing you the most and remove it.
              Strategy, automation, integrations, custom builds. Whatever the
              job takes.
            </p>
          </div>
          <div style={{ "--d": "1.18s" } as CSSProperties}>
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
