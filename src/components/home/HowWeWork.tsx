import { homeProcessContent } from "@/content/site-studio/home";
import type { HomeProcessContent } from "@/lib/site-studio/native-templates";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

export function HowWeWork({ content = homeProcessContent }: { content?: HomeProcessContent }) {
  return (
    <section className="sect ink-panel home-process" id="how">
      <AmbientField />
      <div className="wrap">
        <Reveal sequence className="shead">
          <p data-home-step="0" className="label eyebrow-anim">
            {content.eyebrow}
          </p>
          <div>
            <h2 data-home-step="1" className="h2">
              {content.headingStart} {content.headingMiddle}{" "}
              <span className="it">{content.headingEnd}</span>
            </h2>
            <p data-home-step="2" className="lede" style={{ marginTop: 20 }}>
              {content.body}
            </p>
          </div>
        </Reveal>

        <div className="steps">
          {/* Each row starts its number, title and explanation sequence when
              that row enters view, including during a slow scroll. */}
          {content.steps.map((step, i) => (
            <Reveal
              key={step.n}
              as="div"
              sequence
              className="step"
              style={{ "--d": `${0.08 * i}s` } as CSSProperties}
            >
              <p data-home-step="0" className="step-n">
                {step.n}
              </p>
              <div data-home-step="1" className="step-t">
                <h3 className="h3">{step.title}</h3>
                <span className="tag">{step.tag}</span>
              </div>
              <p data-home-step="2">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
