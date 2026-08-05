import Link from "next/link";
import { Reveal } from "./reveal";
import { CountUp } from "./CountUp";

/**
 * Opens with the site's own core claim (time, not growth, is the constraint),
 * then backs it with the MIT Project NANDA finding on why most AI spending
 * fails to move it. Replaces the old Manifesto.tsx word-reveal treatment with
 * a static, calmer layout — same message, no scroll-linked reading light.
 */
export function Evidence() {
  return (
    <section className="sect" id="evidence">
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(30px,4vw,48px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            The problem
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Most owners don&apos;t have a growth problem.
              <br />
              They have a <span className="it">time</span> problem.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Most AI spending produces nothing. The reasons are known, and they
              are rarely the model.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="ev">
          <Reveal rv as="div" className="ev-c">
            <CountUp target="95%" className="ev-n" />
            <p>
              MIT reviewed more than 300 enterprise AI deployments. Almost none
              reached a measurable return. The cause was scoping and
              integration, not the models.
            </p>
            <span className="ev-src">MIT Project NANDA · The GenAI Divide, 2025</span>
          </Reveal>
          <Reveal rv as="div" className="ev-c" delay={0.12}>
            <CountUp target="2×" className="ev-n" />
            <p>
              The same study found companies working with outside partners
              reached production at roughly twice the rate of those building
              alone. Experience with the failure modes is the difference.
            </p>
            <span className="ev-src">67% partnered vs 33% internal</span>
          </Reveal>
        </Reveal>

        <Reveal
          rv
          as="p"
          delay={0.18}
          style={{ marginTop: "clamp(28px,3.4vw,44px)" }}
        >
          <Link href="/learn/category/foundational" className="label" style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>
            More on why AI projects stall →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
