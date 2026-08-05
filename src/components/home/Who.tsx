import Link from "next/link";
import { Reveal } from "./reveal";

export function Who() {
  return (
    <section className="sect" id="who" style={{ paddingTop: 0 }}>
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
          <Reveal rv className="who-copy">
            <p className="lead-p">
              Engineers, data scientists, and operators who were putting
              machine learning into production well before it was marketed
              as AI. Knowing where to point it, and what breaks when you do,
              is only learned by having been wrong a few times.
            </p>
          </Reveal>
          <Reveal rv className="who-copy" delay={0.08}>
            <p>
              We stay selective about what we take on, and bring in the
              specialists a project calls for. You deal directly with the
              people doing the work, not an account manager relaying it. The
              practice is led by John Connor, who has spent fifteen years
              building and scaling software companies.
            </p>
            <Link
              href="/about"
              className="body-c"
              style={{ fontSize: "14.5px", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              Read more about the team →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
