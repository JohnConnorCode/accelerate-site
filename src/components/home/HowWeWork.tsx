import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

const STEPS = [
  {
    n: "01",
    title: "The session",
    tag: "30 min · free",
    body: "We learn how the business works, what the team wants to change, and where time or revenue is being lost.",
  },
  {
    n: "02",
    title: "The plan",
    tag: "yours to keep",
    body: "A written recommendation: where AI fits, the right type of solution, what should happen first, and why.",
  },
  {
    n: "03",
    title: "The delivery",
    tag: "fixed scope",
    body: "We provide the agreed consulting, custom build, integrations, training, or managed execution against a clear scope.",
  },
  {
    n: "04",
    title: "The improvement",
    tag: "ongoing support",
    body: "When ongoing help makes sense, we run the work, support the team, measure what changes, and keep improving it.",
  },
];

export function HowWeWork() {
  return (
    <section className="sect ink-panel" id="how">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            How we work
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              From understanding
              <br />
              the business to
              <br />
              <span className="it">making it better.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              The shape of the engagement follows the problem. The solution may be advice, a focused
              build, training, ongoing execution, or a combination.
            </Reveal>
          </div>
        </div>

        <div className="steps">
          {/* Each step gets its own <Reveal> — its own scroll trigger — so
              it fades in exactly when THAT step scrolls into view, not on
              a fixed delay measured from when the list's top appeared.
              --d is only a small tie-breaker for a fast scroll that brings
              two steps into view in the same tick. */}
          {STEPS.map((step, i) => (
            <Reveal
              key={step.n}
              as="div"
              className="step item-rv"
              style={{ "--d": `${0.06 * i}s` } as CSSProperties}
            >
              <p className="step-n">{step.n}</p>
              <div className="step-t">
                <h3 className="h3">{step.title}</h3>
                <span className="tag">{step.tag}</span>
              </div>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
