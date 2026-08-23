import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

/* The second beat of the page: what we actually build. An editorial index of
   the systems, magazine-style rows on paper, so the answer to "what does
   custom mean" is a list of named machines rather than a statistic. Each row
   is a door into the service that builds it. */

const SYSTEMS = [
  {
    name: "The front desk",
    desc: "Every inquiry answered and qualified. Any channel, any hour.",
    href: "/services#engagement",
  },
  {
    name: "Follow-up",
    desc: "Estimates, renewals, and quiet clients, chased until they answer.",
    href: "/services#sales",
  },
  {
    name: "Quoting",
    desc: "A number in front of the customer while they are still deciding.",
    href: "/services#automation",
  },
  {
    name: "The client record",
    desc: "One clean record per client, kept current by the system.",
    href: "/services#automation",
  },
  {
    name: "Content",
    desc: "Pages, posts, and emails in your voice, on a schedule.",
    href: "/services#content",
  },
  {
    name: "Reporting",
    desc: "Hours and revenue, pulled from your books every month.",
    href: "/services#reporting",
  },
];

export function Systems() {
  return (
    <section className="sect" id="systems">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            What we build
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              An operating layer,
              <br />
              built around <span className="it">your business.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              We have been inside hundreds of businesses, and the pattern repeats: the company runs on judgment that lives in a few heads. We encode yours into systems, run them with you, and you own everything we build.
            </Reveal>
          </div>
        </div>

        <div className="sysidx">
          {/* Each row gets its own <Reveal> — its own scroll trigger — so it
              fades in exactly when THAT row scrolls into view. --d is only a
              tie-breaker for rows entering in the same tick. */}
          {SYSTEMS.map((system, i) => (
            <Reveal
              key={system.name}
              rv
              as="div"
              className="item-rv"
              style={{ "--d": `${0.05 * (i % 3)}s` } as CSSProperties}
            >
              <Link href={system.href} className="sysrow">
                <span className="sysrow-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="sysrow-name">{system.name}</span>
                <span className="sysrow-d">{system.desc}</span>
                <span className="sysrow-arw" aria-hidden="true">
                  →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
