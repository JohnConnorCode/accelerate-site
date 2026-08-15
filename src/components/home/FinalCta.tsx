"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal, useRv } from "./reveal";
import { AmbientField } from "./AmbientField";

export function FinalCta() {
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
          Start here
        </Reveal>
        <h2 ref={headingRef} className="h2 line-h">
          <span className="line">
            <span style={{ "--d": ".05s" } as CSSProperties}>Architect the future</span>
          </span>
          <span className="line">
            <span style={{ "--d": ".16s" } as CSSProperties}>of your operation.</span>
          </span>
        </h2>
        <Reveal rv as="p" className="lede" delay={0.13}>
          A rigorous thirty-minute consultation to analyze your bottlenecks. You receive a comprehensive automation blueprint, yours to keep either way.
        </Reveal>
        <Reveal rv delay={0.19}>
          <Link
            href="/contact"
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "final_cta" })}
            className="btn btn-inv"
          >
            Book a free call <span className="arw" aria-hidden="true">→</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
