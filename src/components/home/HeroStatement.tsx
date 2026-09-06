"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** The original hero explanation, held for the next scroll beat. */
export function HeroStatement() {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -16%", threshold: 0.18 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={`hero-statement${revealed ? " is-revealed" : ""}`}>
      <div className="wrap hero-statement-layout">
        <div className="hero-statement-aside">
          <p className="label">Built around your business</p>
          <nav aria-label="Explore the homepage" className="home-section-links">
            <Link href="#systems">
              How we help <span aria-hidden="true">↓</span>
            </Link>
            <Link href="#selected-work">
              See our work <span aria-hidden="true">↓</span>
            </Link>
            <Link href="#command-center">
              Explore Command Center <span aria-hidden="true">↓</span>
            </Link>
          </nav>
        </div>
        <div>
          <p className="hero-statement-copy">We start with the work your team does every day.</p>
          <p className="hero-statement-detail">
            We identify where work is slow or revenue is missed, then build and improve the smallest
            useful system. That can include CRM connections, voice-to-text workflows, or better
            inquiry capture.
          </p>
        </div>
      </div>
    </section>
  );
}
