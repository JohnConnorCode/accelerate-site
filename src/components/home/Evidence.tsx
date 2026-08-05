import Link from "next/link";
import { Reveal } from "./reveal";
import { CountUp } from "./CountUp";

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
          <Reveal rv as="div" className="ev-c">
            <CountUp target="95%" className="ev-n" />
            <p>Of enterprise AI deployments never reach a measurable return.</p>
            <span className="ev-src">MIT Project NANDA, 2025</span>
          </Reveal>
          <Reveal rv as="div" className="ev-c" delay={0.12}>
            <CountUp target="2×" className="ev-n" />
            <p>The production rate for companies who bring in outside help.</p>
            <span className="ev-src">67% partnered vs 33% internal</span>
          </Reveal>
        </Reveal>

        <Reveal rv delay={0.2} style={{ marginTop: "clamp(24px,3vw,36px)" }}>
          <p className="label" style={{ marginBottom: 14 }}>
            Shows up the same way everywhere we open the books
          </p>
          <div className="cta-cluster">
            {CONSTRAINTS.map((c) => (
              <Link key={c.title} href={c.href} className="tag">
                {c.title}
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
