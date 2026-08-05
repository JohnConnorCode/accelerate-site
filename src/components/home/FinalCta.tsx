"use client";

import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="ink-panel" id="call">
      <div className="wrap fcta">
        <Reveal rv as="p" className="label eyebrow-anim">
          Start here
        </Reveal>
        <Reveal rv as="h2" className="h2" delay={0.07}>
          The first conversation usually pays for itself.
        </Reveal>
        <Reveal rv as="p" className="lede" delay={0.13}>
          Thirty minutes on a call, then a written plan. No pitch deck, no
          discovery invoice, no obligation.
        </Reveal>
        <Reveal rv delay={0.19}>
          <Link
            href="/contact"
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "final_cta" })}
            className="btn btn-inv"
          >
            Book a free call <span className="arw">→</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
