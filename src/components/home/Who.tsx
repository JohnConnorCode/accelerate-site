import Link from "next/link";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { CountUp } from "./CountUp";

export function Who() {
  return (
    <section className="sect" id="who" style={{ paddingTop: 0 }}>
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            The firm
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Engineered by
            <br />
            veteran founders
            <br />
            and operators.
          </Reveal>
        </div>
        <div className="who">
          {/* Asymmetric split instead of the symmetric two-column pattern
              Evidence/Outcomes already use — pulls the "fifteen years"
              line (already-approved copy, not a new personal detail) into
              a large editorial numeral so this section has a genuinely
              different composition/rhythm than its neighbors, not just
              more motion on the same template. */}
          <Reveal rv className="who-stat">
            <CountUp target="15" className="who-n" />
            <span className="who-n-label">
              Years deploying machine learning at scale
            </span>
          </Reveal>
          <Reveal rv className="who-copy" delay={0.08}>
            <p className="lead-p">
              We put AI into production long before the hype cycle. Knowing exactly where to deploy automation—and what will break when you do—is expertise earned through a decade of scaling real software companies.
            </p>
            <p>
              We are deliberately selective. You interface directly with the engineers architecting your system, never an account manager. The practice is led by John Connor.
            </p>
            <Link
              href="/about"
              className="body-c"
              style={{ fontSize: "14.5px", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              Read more about the team{" "}<span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
