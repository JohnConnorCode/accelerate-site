"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";

const contours = Array.from(
  { length: 18 },
  (_, index) =>
    `M-180 ${180 + index * 24} C150 ${-160 + index * 38} 330 ${790 - index * 22} 650 ${410 + index * 8} S1030 ${80 + index * 20} 1370 ${240 + index * 28}`,
);

function HeroWords({ text, offset = 0 }: { text: string; offset?: number }) {
  return text.split(/\s+/).map((word, index) => (
    <span key={`${word}-${index}`}>
      <span
        className="home-hero-word"
        style={{ "--hero-word-delay": `${offset + index * 24}ms` } as CSSProperties}
      >
        {word}
      </span>{" "}
    </span>
  ));
}

export function Hero({ content = homeHeroContent }: { content?: HomeHeroContent }) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    const field = section?.querySelector<HTMLElement>(".home-hero-field");
    const pulse = section?.querySelector<HTMLElement>(".home-hero-pulse");
    if (!section || !field || !pulse) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    let visible = false;
    let frame = 0;
    let response: Animation | undefined;
    const updateActivity = () => {
      section.dataset.heroActive = String(visible && !document.hidden && !reduced.matches);
      if (section.dataset.heroActive === "false") response?.cancel();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      updateActivity();
    });
    observer.observe(section);
    const reset = () => {
      window.cancelAnimationFrame(frame);
      field.style.setProperty("--hero-x", "0px");
      field.style.setProperty("--hero-y", "0px");
    };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches || !visible || event.pointerType !== "mouse") return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect();
        field.style.setProperty(
          "--hero-x",
          `${((event.clientX - bounds.left) / bounds.width - 0.5) * 32}px`,
        );
        field.style.setProperty(
          "--hero-y",
          `${((event.clientY - bounds.top) / bounds.height - 0.5) * 24}px`,
        );
      });
    };
    const tap = (event: PointerEvent) => {
      if (reduced.matches || !visible) return;
      const bounds = section.getBoundingClientRect();
      pulse.style.left = `${event.clientX - bounds.left}px`;
      pulse.style.top = `${event.clientY - bounds.top}px`;
      response?.cancel();
      response = pulse.animate(
        [
          { opacity: 0.32, transform: "translate(-50%, -50%) scale(0.4)" },
          { opacity: 0, transform: "translate(-50%, -50%) scale(1.8)" },
        ],
        { duration: 850, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    };
    const preference = () => {
      reset();
      updateActivity();
    };
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", reset);
    section.addEventListener("pointerdown", tap, { passive: true });
    document.addEventListener("visibilitychange", updateActivity);
    reduced.addEventListener("change", preference);
    fine.addEventListener("change", preference);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      response?.cancel();
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", reset);
      section.removeEventListener("pointerdown", tap);
      document.removeEventListener("visibilitychange", updateActivity);
      reduced.removeEventListener("change", preference);
      fine.removeEventListener("change", preference);
    };
  }, []);
  const legacy = "prefix" in content;
  const heading = legacy
    ? `${content.prefix} ${content.highlighted} ${content.suffix} ${content.replacedWord} and ${content.finalWord.toLowerCase()}.`
    : content.heading;

  return (
    <section
      ref={sectionRef}
      className="home-hero"
      id="hero"
      aria-labelledby="home-hero-heading"
      data-hero-active="false"
    >
      <div className="home-hero-atmosphere" aria-hidden="true" />
      <div className="home-hero-field" aria-hidden="true">
        <svg viewBox="0 0 1200 760" fill="none" className="home-hero-contours">
          <g className="home-hero-contour-lines">
            {contours.map((path) => (
              <path key={path} d={path} />
            ))}
          </g>
          <g className="home-hero-currents">
            {contours
              .filter((_, index) => index % 3 === 0)
              .map((path, index) => (
                <path key={path} d={path} style={{ animationDelay: `${index * -3.2}s` }} />
              ))}
          </g>
        </svg>
      </div>
      <div className="home-hero-pulse" aria-hidden="true" />
      <div className="wrap home-hero-inner">
        <p className="label home-hero-eyebrow">{content.eyebrow}</p>
        <h1 id="home-hero-heading" className="home-hero-heading">
          {legacy ? (
            <HeroWords text={heading} />
          ) : (
            <>
              <span className="home-hero-lead">
                <HeroWords text={heading} />
              </span>{" "}
              <em>
                <HeroWords text={content.emphasis} offset={120} />
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
        <div className="home-hero-index" aria-hidden="true">
          <span>Strategy</span>
          <span>Custom systems</span>
          <span>Ongoing execution</span>
        </div>
      </div>
    </section>
  );
}
