"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useId, type CSSProperties } from "react";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";
import { useRevealLifecycle } from "@/components/motion/useReveal";

const contours = Array.from(
  { length: 12 },
  (_, index) =>
    `M-180 ${180 + index * 36} C150 ${-160 + index * 57} 330 ${790 - index * 33} 650 ${410 + index * 12} S1030 ${80 + index * 30} 1370 ${240 + index * 42}`,
);

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
  const lightId = useId();
  const legacy = "prefix" in content;
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
    section.style.setProperty("--hero-index-delay", `${1080 + line * 200}ms`);
  }, [content, sectionRef]);
  useEffect(() => {
    const section = sectionRef.current;
    const field = section?.querySelector<HTMLElement>(".home-hero-field");
    const focus = section?.querySelector<HTMLElement>(".home-hero-focus");
    if (!section || !field || !focus) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    let visible = false;
    let frame = 0;
    let illumination: Animation | undefined;
    let release = 0;
    let bounds = section.getBoundingClientRect();
    let lightSize = focus.offsetWidth;
    let x = 0;
    let y = 0;
    const measure = () => {
      bounds = section.getBoundingClientRect();
      lightSize = focus.offsetWidth;
    };
    // Cache geometry at entry/resize. Pointer frames only change compositor
    // transforms, rather than measuring layout or repainting SVG masks.
    const position = () => {
      frame = 0;
      const localX = x - bounds.left;
      const localY = y - bounds.top;
      field.style.transform = `translate3d(${(localX / bounds.width - 0.5) * 12}px, ${(localY / bounds.height - 0.5) * 8}px, 0)`;
      focus.style.transform = `translate3d(${localX - lightSize / 2}px, ${localY - lightSize / 2}px, 0)`;
    };
    const reset = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      window.clearTimeout(release);
      illumination?.cancel();
      section.dataset.heroFocus = "false";
      field.style.transform = "translate3d(0, 0, 0)";
    };
    const updateActivity = () => {
      section.dataset.heroActive = String(visible && !document.hidden && !reduced.matches);
      if (section.dataset.heroActive === "false") reset();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      updateActivity();
    });
    observer.observe(section);
    const move = (event: PointerEvent) => {
      if (section.dataset.heroActive !== "true" || !fine.matches || event.pointerType !== "mouse")
        return;
      x = event.clientX;
      y = event.clientY;
      illumination?.cancel();
      if (section.dataset.heroFocus !== "true") section.dataset.heroFocus = "true";
      if (!frame) frame = window.requestAnimationFrame(position);
    };
    const tap = (event: PointerEvent) => {
      if (
        section.dataset.heroActive !== "true" ||
        event.button !== 0 ||
        (fine.matches && event.pointerType === "mouse") ||
        (event.target instanceof Element && event.target.closest("a, button, input"))
      )
        return;
      const opacity = Number(getComputedStyle(focus).opacity);
      measure();
      x = event.clientX;
      y = event.clientY;
      position();
      window.clearTimeout(release);
      illumination?.cancel();
      illumination = focus.animate([{ opacity }, { opacity: 0.8, offset: 0.25 }, { opacity: 0 }], {
        duration: 1800,
        easing: "cubic-bezier(0.25, 0.5, 0.25, 1)",
      });
      release = window.setTimeout(reset, 1850);
    };
    const preference = () => {
      reset();
      updateActivity();
    };
    const focusIn = (event: FocusEvent) => {
      if (section.dataset.heroActive !== "true" || !(event.target instanceof HTMLElement)) return;
      measure();
      const target = event.target.getBoundingClientRect();
      x = target.left + target.width / 2;
      y = target.top + target.height / 2;
      position();
      illumination?.cancel();
      section.dataset.heroFocus = "true";
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") reset();
    };
    section.addEventListener("pointerenter", measure, { passive: true });
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    section.addEventListener("pointerdown", tap, { passive: true });
    section.addEventListener("focusin", focusIn);
    section.addEventListener("focusout", reset);
    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("resize", measure, { passive: true });
    reduced.addEventListener("change", preference);
    fine.addEventListener("change", preference);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(release);
      illumination?.cancel();
      section.removeEventListener("pointerenter", measure);
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      section.removeEventListener("pointerdown", tap);
      section.removeEventListener("focusin", focusIn);
      section.removeEventListener("focusout", reset);
      document.removeEventListener("visibilitychange", updateActivity);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", preference);
      fine.removeEventListener("change", preference);
    };
  }, [sectionRef]);

  return (
    <section
      ref={sectionRef}
      className="home-hero"
      id="hero"
      aria-labelledby="home-hero-heading"
      data-hero-active="false"
      data-motion-role="home-hero"
      data-reveal-state="pending"
    >
      <div className="home-hero-atmosphere" aria-hidden="true" />
      <div className="home-hero-acceleration" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            className="home-hero-ribbon"
            key={index}
            style={{ "--ribbon-index": index } as CSSProperties}
          >
            <svg viewBox="0 0 600 800" fill="none">
              <path d="M-140 870 C-20 580 230 700 430 400 C560 205 395 75 710-160" />
              <path d="M-110 875 C25 595 265 720 465 425 C605 220 430 85 750-145" />
            </svg>
          </div>
        ))}
      </div>
      <div className="home-hero-field" aria-hidden="true">
        <div className="home-hero-flow">
          <svg viewBox="0 0 1200 760" fill="none" className="home-hero-contours">
            <defs>
              <linearGradient id={`${lightId}-ink`} x1="0" y1="0" x2="1" y2="0">
                <stop stopColor="currentColor" stopOpacity="0" />
                <stop offset="0.5" stopColor="currentColor" stopOpacity="0.1" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.24" />
              </linearGradient>
            </defs>
            <g className="home-hero-contour-lines" stroke={`url(#${lightId}-ink)`}>
              {contours.map((path) => (
                <path key={path} d={path} />
              ))}
            </g>
          </svg>
        </div>
      </div>
      <div className="home-hero-focus home-hero-pulse" aria-hidden="true" />
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
        <div className="home-hero-index" aria-hidden="true">
          <span>Strategy</span>
          <span>Custom systems</span>
          <span>Ongoing execution</span>
        </div>
      </div>
    </section>
  );
}
