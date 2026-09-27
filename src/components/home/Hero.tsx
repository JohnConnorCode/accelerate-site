"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";

const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function ScrambleText({ text, play }: { text: string; play: boolean }) {
  // Keep the real words in the HTML and visible before hydration.
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    if (!play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let settled = 0;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        settled += 2;
        setDisplay(text.split("").map((letter, index) =>
          letter === " " || index < settled ? letter : glyphs[Math.floor(Math.random() * glyphs.length)]
        ).join(""));
        if (settled >= text.length) window.clearInterval(interval);
      }, 32);
    }, 250);
    return () => {
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
      setDisplay(text);
    };
  }, [text, play]);
  return (
    <span className="hero-scramble">
      <span className="hero-scramble-measure">{text}</span>
      <span className="hero-scramble-display">{display}</span>
    </span>
  );
}

const diagramNodes = [
  { number: "01", label: "Strategy", position: "strategy" },
  { number: "02", label: "Custom systems", position: "build" },
  { number: "03", label: "Managed execution", position: "run" },
  { number: "04", label: "Team enablement", position: "train" },
];

export function Hero({ content = homeHeroContent }: { content?: HomeHeroContent }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let frame = 0;
    const replay = () => {
      setLoaded(false);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setLoaded(true));
      });
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) replay();
    };
    replay();
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <section className={`hero${loaded ? " loaded" : ""}`} id="hero">
      <div className="hero-field" aria-hidden="true" />
      <div className="wrap hero-layout">
        <div className="hero-top">
          <p className="label hero-eyebrow">{content.eyebrow}</p>
          <h1 className="h1" aria-label={`${content.prefix} ${content.highlighted} ${content.suffix} ${content.finalWord}`}>
            <span className="h1-word-row" aria-hidden="true">
              {content.prefix.split(/\s+/).filter(Boolean).map((word, index) => (
                <span className="word" key={`${index}-${word}`}>
                  <span style={{ "--d": `${index * 0.07}s` } as CSSProperties}>{word}</span>
                </span>
              ))}
              <span className="word hero-highlight">
                <span style={{ "--d": "0.28s" } as CSSProperties}>
                  <ScrambleText text={content.highlighted} play={loaded} />
                </span>
              </span>
              {content.suffix.split(/\s+/).filter(Boolean).map((word, index) => (
                <span className="word" key={`${index}-${word}`}>
                  <span style={{ "--d": `${0.36 + index * 0.07}s` } as CSSProperties}>{word}</span>
                </span>
              ))}
            </span>
            <span className="hero-outcome" aria-hidden="true">
              <span className="strike">{content.replacedWord}</span>
              <span className="hero-profit rev-ul">{content.finalWord}</span>
            </span>
          </h1>
          <p className="hero-support">
            {content.support ?? "We find the right next step, then help put it to work."}
          </p>
          <div className="hero-row-cta">
            <span className="hero-inline-cta">
              <Link href={content.ctaHref} onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "hero" })} className="btn">
                {content.ctaLabel} <span className="arw" aria-hidden="true">→</span>
              </Link>
            </span>
            <span className="hero-cta-note">30 minutes · a clear next step</span>
          </div>
        </div>
        <div className="hero-system" aria-hidden="true">
          <div className="hero-system-heading"><span>01 / 04</span><span>BUILT AROUND YOU</span></div>
          <svg className="hero-system-lines" viewBox="0 0 480 480" preserveAspectRatio="xMidYMid meet">
            <circle cx="240" cy="240" r="154" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 8" />
            <path d="M240 240 L118 118 M240 240 L362 118 M240 240 L118 362 M240 240 L362 362" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="240" cy="240" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          <div className="hero-system-core"><span className="hero-system-core-mark">✳</span><span>YOUR<br />BUSINESS</span></div>
          {diagramNodes.map((node) => (
            <div className={`hero-system-node hero-system-node-${node.position}`} key={node.number}>
              <span>{node.number}</span><strong>{node.label}</strong><i aria-hidden="true" />
            </div>
          ))}
          <div className="hero-system-footer"><span>DIAGNOSE</span><span>DESIGN</span><span>DEPLOY</span><span>IMPROVE</span></div>
        </div>
      </div>
    </section>
  );
}
