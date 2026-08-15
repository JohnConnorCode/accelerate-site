import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

const STEPS = [
  {
    n: "STEP 01",
    title: "Operational Audit",
    tag: "30 min · free",
    body: "We map where hours are lost and bottlenecks form. We listen, you talk.",
  },
  {
    n: "STEP 02",
    title: "Blueprint Delivery",
    tag: "free · yours to keep",
    body: "A prioritized roadmap of automation opportunities, ranked by immediate ROI.",
  },
  {
    n: "STEP 03",
    title: "Build & Deploy",
    tag: "fixed price",
    body: "We define the exact scope and success metrics. The first deployment runs within two weeks.",
  },
  {
    n: "STEP 04",
    title: "Handover & Scale",
    tag: "support optional",
    body: "Your team is fully trained. The system is yours, supported by ongoing optimization.",
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
