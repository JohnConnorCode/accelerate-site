"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, type CSSProperties } from "react";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";
import { useRevealLifecycle } from "@/components/motion/useReveal";
import { HeroArtwork } from "./HeroArtwork";

function HeroWords({
  text,
  offset = 320,
  stagger = 0,
}: {
  text: string;
  offset?: number;
  stagger?: number;
}) {
  return text.split(/\s+/).map((word, index) => (
    <span key={`${word}-${index}`}>
      <span
        className="home-hero-word-mask"
        style={
          { "--hero-word-delay": `${offset + Math.min(index, 16) * stagger}ms` } as CSSProperties
        }
      >
        <span className="home-hero-word">{word}</span>
      </span>{" "}
    </span>
  ));
}

export function Hero({ content = homeHeroContent }: { content?: HomeHeroContent }) {
  const sectionRef = useRevealLifecycle<HTMLElement>({ restoreHistory: true });
  const legacy = "prefix" in content;
  // The default service list repeats the artwork controls; distinct owner copy still renders.
  const eyebrow = content.eyebrow === homeHeroContent.eyebrow ? "" : content.eyebrow;
  const heading = legacy
    ? `${content.prefix} ${content.highlighted} ${content.suffix} ${content.replacedWord} and ${content.finalWord.toLowerCase()}.`
    : content.heading;
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const masks = [...section.querySelectorAll<HTMLElement>(".home-hero-word-mask")];
    // Read layout once. Words on the same responsive line share one clock,
    // so a line enters as a readable unit instead of a rapid word cascade.
    const measurements = masks.map((mask) => ({ mask, top: mask.getBoundingClientRect().top }));
    let line = 0;
    let top = measurements[0]?.top ?? 0;
    measurements.forEach(({ mask, top: currentTop }) => {
      if (Math.abs(currentTop - top) > 4) {
        line++;
        top = currentTop;
      }
      mask.style.setProperty("--hero-word-delay", `${320 + line * 200}ms`);
      mask.dataset.heroLine = String(line);
    });
    section.style.setProperty("--hero-support-delay", `${720 + line * 200}ms`);
    section.style.setProperty("--hero-action-delay", `${870 + line * 200}ms`);
  }, [content, sectionRef]);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    section.dataset.heroMounted = "true";
    const activity = () => {
      section.dataset.heroActive = String(visible && !document.hidden && !reduced.matches);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      activity();
    });
    observer.observe(section);
    reduced.addEventListener("change", activity);
    document.addEventListener("visibilitychange", activity);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", activity);
      document.removeEventListener("visibilitychange", activity);
    };
  }, [sectionRef]);

  return (
    <section
      ref={sectionRef}
      className="home-hero"
      id="hero"
      aria-labelledby="home-hero-heading"
      data-hero-active="false"
      data-hero-mounted="false"
      data-motion-role="home-hero"
      data-reveal-state="pending"
    >
      <div className="wrap home-hero-inner">
        {eyebrow && <p className="label home-hero-eyebrow">{eyebrow}</p>}
        <h1 id="home-hero-heading" className="home-hero-heading">
          {legacy ? (
            <HeroWords text={heading} />
          ) : (
            <>
              <span className="home-hero-lead">
                <HeroWords text={heading} />
              </span>{" "}
              <em>
                <HeroWords text={content.emphasis} />
              </em>
            </>
          )}
        </h1>
        <div className="home-hero-bottom">
          <p className="home-hero-support">{content.support}</p>
          <div className="home-hero-actions">
            <Link
              href={content.ctaHref}
              data-booking-cta
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })}
              className="btn home-hero-cta"
            >
              {content.ctaLabel}{" "}
              <span className="arw" aria-hidden="true">
                →
              </span>
            </Link>
            <span className="home-hero-note">30 minutes · a clear next step</span>
          </div>
        </div>
        <HeroArtwork />
      </div>
    </section>
  );
}
