import Link from "next/link";
import { homeWhoContent } from "@/content/site-studio/home";
import type { HomeWhoContent } from "@/lib/site-studio/native-templates";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { CountUp } from "./CountUp";

export function Who({ content = homeWhoContent }: { content?: HomeWhoContent }) {
  return (
    <section className="sect" id="who" style={{ paddingTop: 0 }}>
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {content.eyebrow}
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            {content.headingStart}
            <br />
            {content.headingMiddle}
            <br />
            {content.headingEnd}
          </Reveal>
        </div>
        <div className="who">
          {/* Asymmetric split instead of the symmetric two-column pattern
              the index/steps sections use — pulls the "fifteen years"
              line (already-approved copy, not a new personal detail) into
              a large editorial numeral so this section has a genuinely
              different composition/rhythm than its neighbors, not just
              more motion on the same template. */}
          <Reveal rv className="who-stat">
            <CountUp target={content.years} className="who-n" />
            <span className="who-n-label">{content.yearsLabel}</span>
          </Reveal>
          <Reveal rv className="who-copy" delay={0.08}>
            <p className="lead-p">{content.body}</p>
            <p>{content.detail}</p>
            <Link
              href={content.linkHref}
              className="body-c"
              style={{
                fontSize: "14.5px",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {content.linkLabel} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
