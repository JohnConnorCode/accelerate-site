"use client";

import Link from "next/link";
import { useEffect, useId, type CSSProperties } from "react";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";
import { useRevealLifecycle } from "@/components/motion/useReveal";

const contours = Array.from(
  { length: 18 },
  (_, index) =>
    `M-180 ${180 + index * 24} C150 ${-160 + index * 38} 330 ${790 - index * 22} 650 ${410 + index * 8} S1030 ${80 + index * 20} 1370 ${240 + index * 28}`,
);

function HeroWords({
  text,
  offset = 180,
  stagger = 45,
  emphasis = false,
}: {
  text: string;
  offset?: number;
  stagger?: number;
  emphasis?: boolean;
}) {
  return text.split(/\s+/).map((word, index) => (
    <span key={`${word}-${index}`}>
      <span
        className="home-hero-word-mask"
        style={
          { "--hero-word-delay": `${offset + Math.min(index, 16) * stagger}ms` } as CSSProperties
        }
      >
        <span
          className={`home-hero-word${emphasis && /^(money|time)[.!?]?$/.test(word) ? " home-hero-mark" : ""}`}
        >
          {word}
        </span>
      </span>{" "}
    </span>
  ));
}

export function Hero({ content = homeHeroContent }: { content?: HomeHeroContent }) {
  const sectionRef = useRevealLifecycle<HTMLElement>({ restoreHistory: true });
  const lightId = useId();
  useEffect(() => {
    const section = sectionRef.current;
    const field = section?.querySelector<HTMLElement>(".home-hero-field");
    const pulse = section?.querySelector<HTMLElement>(".home-hero-pulse");
    const svg = section?.querySelector<SVGSVGElement>(".home-hero-contours");
    const light = section?.querySelector<SVGRadialGradientElement>(".home-hero-light");
    const focus = section?.querySelector<SVGGElement>(".home-hero-focus");
    if (!section || !field || !pulse || !svg || !light || !focus) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    let visible = false;
    let frame = 0;
    let response: Animation | undefined;
    let illumination: Animation | undefined;
    let release = 0;
    const locateLight = (x: number, y: number) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      light.setAttribute("cx", String(point.x));
      light.setAttribute("cy", String(point.y));
    };
    const reset = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(release);
      illumination?.cancel();
      section.dataset.heroFocus = "false";
      section.style.setProperty("--hero-x", "0px");
      section.style.setProperty("--hero-y", "0px");
    };
    const updateActivity = () => {
      section.dataset.heroActive = String(visible && !document.hidden && !reduced.matches);
      if (section.dataset.heroActive === "false") {
        response?.cancel();
        reset();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      updateActivity();
    });
    observer.observe(section);
    const move = (event: PointerEvent) => {
      if (section.dataset.heroActive !== "true" || !fine.matches || event.pointerType !== "mouse")
        return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect();
        illumination?.cancel();
        locateLight(event.clientX, event.clientY);
        section.dataset.heroFocus = "true";
        section.style.setProperty(
          "--hero-x",
          `${((event.clientX - bounds.left) / bounds.width - 0.5) * 44}px`,
        );
        section.style.setProperty(
          "--hero-y",
          `${((event.clientY - bounds.top) / bounds.height - 0.5) * 32}px`,
        );
      });
    };
    const tap = (event: PointerEvent) => {
      if (section.dataset.heroActive !== "true" || event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest("a, button, input")) return;
      const bounds = section.getBoundingClientRect();
      window.clearTimeout(release);
      section.style.setProperty(
        "--hero-x",
        `${((event.clientX - bounds.left) / bounds.width - 0.5) * 60}px`,
      );
      section.style.setProperty(
        "--hero-y",
        `${((event.clientY - bounds.top) / bounds.height - 0.5) * 44}px`,
      );
      release = window.setTimeout(reset, 900);
      locateLight(event.clientX, event.clientY);
      illumination?.cancel();
      illumination = focus.animate([{ opacity: 0.85 }, { opacity: 0 }], {
        duration: 850,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
      pulse.style.left = `${event.clientX - bounds.left}px`;
      pulse.style.top = `${event.clientY - bounds.top}px`;
      response?.cancel();
      response = pulse.animate(
        [
          { opacity: 0.42, transform: "translate(-50%, -50%) scale(0.12) rotate(-8deg)" },
          { opacity: 0, transform: "translate(-50%, -50%) scale(1.8) rotate(12deg)" },
        ],
        { duration: 850, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    };
    const preference = () => {
      reset();
      updateActivity();
    };
    const focusIn = (event: FocusEvent) => {
      if (section.dataset.heroActive !== "true" || !(event.target instanceof HTMLElement)) return;
      const bounds = event.target.getBoundingClientRect();
      illumination?.cancel();
      locateLight(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      section.dataset.heroFocus = "true";
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") reset();
    };
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    section.addEventListener("pointerdown", tap, { passive: true });
    section.addEventListener("focusin", focusIn);
    section.addEventListener("focusout", reset);
    document.addEventListener("visibilitychange", updateActivity);
    reduced.addEventListener("change", preference);
    fine.addEventListener("change", preference);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(release);
      response?.cancel();
      illumination?.cancel();
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      section.removeEventListener("pointerdown", tap);
      section.removeEventListener("focusin", focusIn);
      section.removeEventListener("focusout", reset);
      document.removeEventListener("visibilitychange", updateActivity);
      reduced.removeEventListener("change", preference);
      fine.removeEventListener("change", preference);
    };
  }, [sectionRef]);
  const legacy = "prefix" in content;
  const heading = legacy
    ? `${content.prefix} ${content.highlighted} ${content.suffix} ${content.replacedWord} and ${content.finalWord.toLowerCase()}.`
    : content.heading;
  const phrases = !legacy ? content.emphasis.match(/^(.*?)\s+(while you)\s+(.*)$/) : null;

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
      <svg className="home-hero-acceleration" viewBox="0 0 600 800" fill="none" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <g key={index} style={{ "--ribbon-index": index } as CSSProperties}>
            <path d="M-140 870 C-20 580 230 700 430 400 C560 205 395 75 710-160" />
            <path d="M-110 875 C25 595 265 720 465 425 C605 220 430 85 750-145" />
          </g>
        ))}
      </svg>
      <div className="home-hero-field" aria-hidden="true">
        <svg viewBox="0 0 1200 760" fill="none" className="home-hero-contours">
          <defs>
            <radialGradient
              id={`${lightId}-light`}
              className="home-hero-light"
              gradientUnits="userSpaceOnUse"
              cx="900"
              cy="350"
              r="260"
            >
              <stop stopColor="white" />
              <stop offset="0.35" stopColor="white" stopOpacity="0.65" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask
              id={`${lightId}-mask`}
              maskUnits="userSpaceOnUse"
              x="-200"
              y="-200"
              width="1800"
              height="1400"
            >
              <rect x="-200" y="-200" width="1800" height="1400" fill={`url(#${lightId}-light)`} />
            </mask>
          </defs>
          <g className="home-hero-contour-lines home-hero-contour-far">
            {contours
              .filter((_, index) => index % 2 === 0)
              .map((path) => (
                <path key={path} d={path} pathLength="1000" />
              ))}
          </g>
          <g className="home-hero-contour-lines home-hero-contour-near">
            {contours
              .filter((_, index) => index % 2 !== 0)
              .map((path) => (
                <path key={path} d={path} pathLength="1000" />
              ))}
          </g>
          <g className="home-hero-currents">
            {contours
              .filter((_, index) => index % 3 === 0)
              .map((path, index) => (
                <path
                  key={path}
                  d={path}
                  pathLength="1000"
                  style={
                    {
                      "--current-duration": `${9 + index * 1.7}s`,
                      "--current-delay": `${index * -2.4}s`,
                      "--current-opacity": 0.28 + (index % 3) * 0.12,
                    } as CSSProperties
                  }
                />
              ))}
          </g>
          <g className="home-hero-focus" mask={`url(#${lightId}-mask)`}>
            {contours.map((path) => (
              <path key={path} d={path} />
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
                {phrases ? (
                  <>
                    <span className="home-hero-phrase">
                      <HeroWords text={phrases[1] ?? ""} offset={420} stagger={60} emphasis />
                    </span>{" "}
                    <span className="home-hero-bridge">
                      <HeroWords text={phrases[2] ?? ""} offset={600} />
                    </span>{" "}
                    <span className="home-hero-phrase">
                      <HeroWords text={phrases[3] ?? ""} offset={720} stagger={60} emphasis />
                    </span>
                  </>
                ) : (
                  <HeroWords text={content.emphasis} offset={420} stagger={60} emphasis />
                )}
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
