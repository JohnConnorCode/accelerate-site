"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { homeStatementContent } from "@/content/site-studio/home";
import type { HomeStatementContent } from "@/lib/site-studio/native-templates";

/** The original hero explanation, held for the next scroll beat. */
export function HeroStatement({
  content = homeStatementContent,
}: {
  content?: HomeStatementContent;
}) {
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
          <p className="label">{content.eyebrow}</p>
          <nav aria-label="Explore the homepage" className="home-section-links">
            <Link href={content.systemsHref}>
              {content.systemsLabel} <span aria-hidden="true">↓</span>
            </Link>
            <Link href={content.workHref}>
              {content.workLabel} <span aria-hidden="true">↓</span>
            </Link>
            <Link href={content.productHref}>
              {content.productLabel} <span aria-hidden="true">↓</span>
            </Link>
          </nav>
        </div>
        <div>
          <p className="hero-statement-copy">{content.heading}</p>
          <p className="hero-statement-detail">{content.body}</p>
        </div>
      </div>
    </section>
  );
}
