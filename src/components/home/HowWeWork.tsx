import type { CSSProperties } from "react";
import { Reveal } from "./reveal";

const STEPS = [
  {
    n: "STEP 01",
    title: "A working session on your operation",
    tag: "30 min · free",
    body: "Where the time goes, what your team redoes by hand, what you would fix first. You do most of the talking.",
  },
  {
    n: "STEP 02",
    title: "A written plan, delivered",
    tag: "free · yours to keep",
    body: "Your opportunities ranked by value against effort, with the reasoning behind the order. Take it to any firm you like.",
  },
  {
    n: "STEP 03",
    title: "Scope agreed, then delivered",
    tag: "fixed price",
    body: "We define what it does, what it deliberately does not, and the measure that says it worked. Something runs inside two weeks.",
  },
  {
    n: "STEP 04",
    title: "Handover, training, review",
    tag: "support optional",
    body: "Everything is yours and your team is trained on it. These systems drift, so a review catches it before your customers do.",
  },
];

export function HowWeWork() {
  return (
    <section className="sect ink-panel" id="how">
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            How we work
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              We start with the
              <br />
              constraint, not with
              <br />
              a product.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Nothing to license and nothing to upsell, so the recommendation
              follows the diagnosis.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="steps">
          {STEPS.map((step, i) => (
            <div key={step.n} className="step" style={{ "--d": `${0.06 * i}s` } as CSSProperties}>
              <p className="step-n">{step.n}</p>
              <div className="step-t">
                <h3 className="h3">{step.title}</h3>
                <span className="tag">{step.tag}</span>
              </div>
              <p>{step.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
