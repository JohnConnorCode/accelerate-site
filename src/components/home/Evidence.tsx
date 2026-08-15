import type { CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { CountUp } from "./CountUp";
import { ScrollParallax } from "./ScrollParallax";
import { AmbientField } from "./AmbientField";

const CONSTRAINTS = [
  { title: "Sales and pipeline", href: "/services#sales" },
  { title: "Marketing", href: "/services#content" },
  { title: "Customer service", href: "/services#engagement" },
  { title: "Operations", href: "/services#automation" },
];

/**
 * One tight beat: the core claim (time, not growth, is the constraint), the
 * evidence for it, and where it shows up — compressed from what used to be
 * two full sections. This page mostly reaches people after a conversation,
 * not cold, so it confirms rather than re-pitches.
 */
export function Evidence() {
  return (
    <section className="sect" id="evidence">
      <AmbientField />
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(24px,3vw,36px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            The problem
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Most owners don&apos;t have a growth problem.
              <br />
              They have a <span className="it">time</span> problem.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="ev">
          <ScrollParallax speed={-0.15} className="ev-c">
            <Reveal rv>
              <CountUp target="21×" className="ev-n" />
              <p>More likely to qualify an inquiry when you respond within five minutes instead of thirty.</p>
              <span className="ev-src">Lead Response Management Study, MIT</span>
            </Reveal>
          </ScrollParallax>
          <ScrollParallax speed={0.15} className="ev-c">
            <Reveal rv delay={0.12}>
              <CountUp target="2×" className="ev-n" />
              <p>The production rate for companies that bring in outside help.</p>
              <span className="ev-src">67% partnered vs 33% internal</span>
            </Reveal>
          </ScrollParallax>
        </Reveal>

        <div style={{ marginTop: "clamp(24px,3vw,36px)" }}>
          <Reveal rv as="p" delay={0.2} className="label" style={{ marginBottom: 14 }}>
            Shows up the same way everywhere we open the books
          </Reveal>
          <div className="cta-cluster">
            {/* Each tag gets its own <Reveal> — its own scroll trigger — so
                it fades in exactly when THAT tag scrolls into view, not on
                a fixed delay from when the row appeared. --d is only a
                small tie-breaker for a fast scroll that brings two tags
                into view in the same tick. */}
            {CONSTRAINTS.map((c, i) => (
              <Reveal
                key={c.title}
                as={Link}
                href={c.href}
                className="tag item-rv"
                style={{ "--d": `${0.06 * i}s` } as CSSProperties}
              >
                {c.title}
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
