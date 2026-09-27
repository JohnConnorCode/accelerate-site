"use client";

import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { homeHeroContent } from "@/content/site-studio/home";
import type { HomeHeroContent } from "@/lib/site-studio/native-templates";

export function Hero({ content = homeHeroContent }: { content?: HomeHeroContent }) {
  const legacy = "prefix" in content;
  const heading = legacy
    ? `${content.prefix} ${content.highlighted} ${content.suffix} ${content.replacedWord} and ${content.finalWord.toLowerCase()}.`
    : content.heading;

  return (
    <section className="home-hero" id="hero" aria-labelledby="home-hero-heading">
      <div className="wrap home-hero-inner">
        <p className="label home-hero-eyebrow">{content.eyebrow}</p>
        <h1 id="home-hero-heading" className="home-hero-heading">
          {legacy ? (
            heading
          ) : (
            <>
              {heading} <em>{content.emphasis}</em>
            </>
          )}
        </h1>
        <div className="home-hero-bottom">
          <p className="home-hero-support">{content.support}</p>
          <div className="home-hero-actions">
            <Link
              href={content.ctaHref}
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
