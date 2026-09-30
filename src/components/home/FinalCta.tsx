"use client";

import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

import { homeFinalCtaContent } from "@/content/site-studio/home";
import type { HomeFinalCtaContent } from "@/lib/site-studio/native-templates";

export function FinalCta({ content = homeFinalCtaContent }: { content?: HomeFinalCtaContent }) {
  // One closing sequence owns the eyebrow, clipped headline lines, copy and action.
  return (
    <section className="ink-panel relative" id="call">
      <AmbientField />
      <Reveal sequence className="wrap fcta">
        <p data-home-step="0" className="label eyebrow-anim">
          {content.eyebrow}
        </p>
        <h2 className="h2">
          <span className="line">
            <span data-home-step="1" className="home-close-line">
              {content.headingStart}
            </span>
          </span>
          <span className="line">
            <span data-home-step="2" className="home-close-line">
              {content.headingEnd}
            </span>
          </span>
        </h2>
        <p data-home-step="3" className="lede">
          {content.body}
        </p>
        <div data-home-step="4">
          <Link
            href={content.ctaHref}
            data-booking-cta
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "final_cta" })}
            className="btn btn-inv"
          >
            {content.ctaLabel}{" "}
            <span className="arw" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
