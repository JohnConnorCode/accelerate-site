import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

/* The second beat of the page: the value map. Six pillars, taken directly
   from the product's own architecture (capture, organize, act, learn,
   connect, govern), each stated as what it is worth to the owner. This is
   deliberately the whole business, not the funnel: the system reads, it
   remembers, it works, it warns, it improves, and nothing moves without
   the founder's yes. Each row is a door into the capability catalog. */

const PILLARS = [
  {
    name: "It sees everything",
    desc: "Email both directions, meetings, calls, voice notes, paperwork. Nothing the business learns gets lost.",
    href: "/command-center#capabilities",
  },
  {
    name: "It remembers everything",
    desc: "One timeline per person, the whole history behind it. Ask what was agreed in March and get the answer.",
    href: "/command-center#capabilities",
  },
  {
    name: "It does the work",
    desc: "Drafts, follow-ups, scheduling, pipeline moves, outreach. Done, and waiting for your approval.",
    href: "/command-center#demo",
  },
  {
    name: "It tells you what matters",
    desc: "A brief every morning. A warning when a client goes quiet. You see the exceptions, not the noise.",
    href: "/command-center#autonomy",
  },
  {
    name: "It gets better every month",
    desc: "Your edits are the training. It tracks whether the work actually worked.",
    href: "/command-center#how",
  },
  {
    name: "Nothing moves without you",
    desc: "Approval queue, full audit log, kill switches, your own database. You own all of it.",
    href: "/command-center#autonomy",
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
              One system that runs
              <br />
              the <span className="it">whole business.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              It reads the email, the meetings, and the history. It keeps one clean record of every person, job, and promise. It drafts the work and waits for your yes. And it gets better every month, because your edits train it.
            </Reveal>
          </div>
        </div>

        <div className="sysidx">
          {/* Each row gets its own <Reveal> — its own scroll trigger — so it
              fades in exactly when THAT row scrolls into view. --d is only a
              tie-breaker for rows entering in the same tick. */}
          {PILLARS.map((pillar, i) => (
            <Reveal
              key={pillar.name}
              rv
              as="div"
              className="item-rv"
              style={{ "--d": `${0.05 * (i % 3)}s` } as CSSProperties}
            >
              <Link href={pillar.href} className="sysrow">
                <span className="sysrow-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="sysrow-name">{pillar.name}</span>
                <span className="sysrow-d">{pillar.desc}</span>
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
