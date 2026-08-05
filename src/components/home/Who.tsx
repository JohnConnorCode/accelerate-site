import Link from "next/link";
import { Reveal } from "./reveal";

const CREDENTIALS = [
  { org: "Upland", detail: "Drove 15x revenue growth to more than 300,000 monthly active users." },
  { org: "Sparkblox", detail: "Raised over $1M. Partnerships with Chainlink and Algorand." },
  { org: "HelpWith", detail: "Grew a services marketplace to more than 3,000 providers." },
  { org: "Mode Mobile", detail: "Technical product management." },
  { org: "SuperDebate", detail: "Platform and the AI operations system running its research, outreach, and reporting." },
];

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
          <Reveal rv>
            <p className="lead-p">
              Engineers, data scientists, and operators who were putting
              machine learning into production well before it was marketed as
              AI. Knowing where to point it, and what breaks when you do, is
              only learned by having been wrong a few times.
            </p>
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
          <div>
            <Reveal as="ul" className="cred">
              {CREDENTIALS.map((c) => (
                <li key={c.org}>
                  <b>{c.org}</b>
                  <span>{c.detail}</span>
                </li>
              ))}
            </Reveal>
            <p
              style={{
                marginTop: 24,
                fontSize: "12.5px",
                color: "var(--mid)",
                fontFamily: "var(--util)",
                letterSpacing: ".04em",
                lineHeight: 1.7,
              }}
            >
              Selected background · Engagements nationwide
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
