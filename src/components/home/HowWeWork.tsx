import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

const STEPS = [
  {
    n: "01",
    title: "The session",
    tag: "30 min · free",
    body: "We map where your team loses hours and where inquiries go unanswered.",
  },
  {
    n: "02",
    title: "The plan",
    tag: "yours to keep",
    body: "A written plan: what we would build, in what order, and the hours each phase returns.",
  },
  {
    n: "03",
    title: "The build",
    tag: "fixed scope",
    body: "We build the systems and connect them to your existing CRM. Phase one is live in under two weeks.",
  },
  {
    n: "04",
    title: "The run",
    tag: "ongoing support",
    body: "We run the system in production, train your team, and keep tuning it. Month to month, and you own everything.",
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
              Four steps to
              <br />
              a system
              <br />
              that runs.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Everything is built around how your business already works, priced as a fixed scope, and run by the people who built it.
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
