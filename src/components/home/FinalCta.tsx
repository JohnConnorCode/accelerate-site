"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal, useRv } from "./reveal";
import { AmbientField } from "./AmbientField";

import { homeFinalCtaContent } from "@/content/site-studio/home";
import type { HomeFinalCtaContent } from "@/lib/site-studio/native-templates";

export function FinalCta({ content = homeFinalCtaContent }: { content?: HomeFinalCtaContent }) {
  // The closing headline gets the Hero's own per-line clip-reveal
  // (.line/.line > span) instead of the generic .rv blur-fade — an
  // occasional signature move for the page's one true "arrival" moment,
  // bookending the same treatment the hero opens with. Scroll-triggered
  // via the same IO hook .rv uses, not Hero's mount-time `loaded` state.
  const headingRef = useRv<HTMLHeadingElement>();
  return (
    <section className="ink-panel relative" id="call">
      <AmbientField />
      <div className="wrap fcta">
        <Reveal rv as="p" className="label eyebrow-anim">
          {content.eyebrow}
        </Reveal>
        <h2 ref={headingRef} className="h2 line-h">
          <span className="line">
            <span style={{ "--d": ".05s" } as CSSProperties}>{content.headingStart}</span>
          </span>
          <span className="line">
            <span style={{ "--d": ".16s" } as CSSProperties}>{content.headingEnd}</span>
          </span>
        </h2>
        <Reveal rv as="p" className="lede" delay={0.13}>
          {content.body}
        </Reveal>
        <Reveal rv delay={0.19}>
          <Link
            href={content.ctaHref}
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "final_cta" })}
            className="btn btn-inv"
          >
            {content.ctaLabel}{" "}
            <span className="arw" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
