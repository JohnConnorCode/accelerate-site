import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

/* The second beat of the page: the value map. Six pillars, taken directly
   from the product's own architecture, each stated as what it is worth to
   the owner, each carrying the product's own glyph-and-color language and a
   mono "moment" line so the section reads as a designed artifact of the
   system rather than bare text. Autonomy is pitched as something the system
   earns and grows into, never as a brake. */

const PILLARS = [
  {
    key: "Capture",
    glyph: "◆",
    rgb: "96,165,250",
    name: "It sees everything",
    desc: "Email both directions, meetings, calls, voice notes, paperwork. Nothing the business learns gets lost.",
    moment: "07:12 · after-hours job request captured",
    href: "/command-center#capabilities",
  },
  {
    key: "Memory",
    glyph: "▤",
    rgb: "167,139,250",
    name: "It remembers everything",
    desc: "One timeline per person, the whole history behind it. Ask what was agreed in March and get the answer.",
    moment: "asked what was agreed in March · answered",
    href: "/command-center#capabilities",
  },
  {
    key: "Action",
    glyph: "✦",
    rgb: "163,230,53",
    name: "It does the work",
    desc: "Drafts, follow-ups, scheduling, pipeline moves, outreach. The routine runs on its own.",
    moment: "08:31 · estimate follow-up drafted and sent",
    href: "/command-center#demo",
  },
  {
    key: "Signal",
    glyph: "◉",
    rgb: "251,191,36",
    name: "It tells you what matters",
    desc: "A brief every morning. A warning when a client goes quiet. You see the exceptions, not the noise.",
    moment: "daily brief · two clients cooling, one invoice overdue",
    href: "/command-center#autonomy",
  },
  {
    key: "Learning",
    glyph: "↻",
    rgb: "34,211,238",
    name: "It gets better every month",
    desc: "Your edits are the training. It tracks whether the work actually worked.",
    moment: "draft edited once · tomorrow's drafts adjust",
    href: "/command-center#how",
  },
  {
    key: "Trust",
    glyph: "✓",
    rgb: "52,211,153",
    name: "It earns more autonomy",
    desc: "Smart approvals learn what you trust. The routine graduates to running itself, and your attention goes only to the exceptions.",
    moment: "routine follow-up · cleared automatically",
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
              It reads the email, the meetings, and the history. It keeps one clean record of every person, job, and promise. It runs the routine work itself, and it takes on more every month as it learns how you run.
            </Reveal>
          </div>
        </div>

        <div className="pillars">
          {/* Each panel gets its own <Reveal> — its own scroll trigger — so it
              fades in exactly when THAT panel scrolls into view. --d is only a
              tie-breaker for panels entering in the same tick. */}
          {PILLARS.map((pillar, i) => (
            <Reveal
              key={pillar.key}
              rv
              as="div"
              className="item-rv h-full"
              style={{ "--d": `${0.06 * (i % 2)}s` } as CSSProperties}
            >
              <Link href={pillar.href} className="pillar">
                <span className="pillar-head">
                  <span className="pillar-glyph" style={{ color: `rgb(${pillar.rgb})` }} aria-hidden="true">
                    {pillar.glyph}
                  </span>
                  <span className="pillar-k">{pillar.key}</span>
                  <span className="pillar-n">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="pillar-name">{pillar.name}</span>
                <span className="pillar-d">{pillar.desc}</span>
                <span className="pillar-eg">
                  <span className="pillar-eg-glyph" style={{ color: `rgb(${pillar.rgb})` }} aria-hidden="true">
                    {pillar.glyph}
                  </span>
                  {pillar.moment}
                  <span className="pillar-arw" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
