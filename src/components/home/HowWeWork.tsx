import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

const STEPS = [
  {
    n: "01",
    title: "Diagnostic",
    tag: "30 min · free",
    body: "We map where hours disappear: unanswered inquiries, stale follow-up, work that should not need a person.",
  },
  {
    n: "02",
    title: "The plan",
    tag: "yours to keep",
    body: "A phased sequence of what to automate first, so the team gets the week back where it counts.",
  },
  {
    n: "03",
    title: "Build",
    tag: "fixed scope",
    body: "We put the systems into the tools you already use. Phase one is live in under two weeks.",
  },
  {
    n: "04",
    title: "Run",
    tag: "alongside you",
    body: "We train the people who touch it, then keep the machine running so they can stay on the work only they can do.",
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
              We take the work
              <br />
              your people should
              <br />
              not be doing.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              No generic licenses. We diagnose, build, and run the layer that is trapping the team.
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
