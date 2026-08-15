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
            Operators who&apos;ve done
            <br />
            this since before it
            <br />
            had a name.
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
              Years building and scaling software companies
            </span>
          </Reveal>
          <Reveal rv className="who-copy" delay={0.08}>
            <p className="lead-p">
              Engineers, data scientists, and operators who were putting
              machine learning into production well before it was marketed
              as AI. Knowing where to point it, and what breaks when you do,
              is only learned by having been wrong a few times.
            </p>
            <p>
              We stay selective about what we take on, and bring in the
              specialists a project calls for. You deal directly with the
              people doing the work, not an account manager relaying it. The
              practice is led by John Connor.
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
