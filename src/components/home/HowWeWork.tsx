import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

const STEPS = [
  {
    n: "01",
    title: "Diagnostic Audit",
    tag: "30 min · free",
    body: "We map exactly where your team loses hours and where leads fall through the cracks.",
  },
  {
    n: "02",
    title: "ROI Blueprint",
    tag: "yours to keep",
    body: "A detailed, phased automation roadmap prioritized strictly by the fastest path to positive ROI.",
  },
  {
    n: "03",
    title: "Build & Integrate",
    tag: "fixed scope",
    body: "We engineer and deploy the systems into your existing CRM. Phase one is live in under two weeks.",
  },
  {
    n: "04",
    title: "Train & Scale",
    tag: "ongoing support",
    body: "We train your team and continuously monitor the agents to ensure they exceed human performance baselines.",
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
              Solving constraints,
              <br />
              not selling
              <br />
              software.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              No generic licenses. No hidden upsells. Just custom engineering that directly attacks your operational bottlenecks.
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
