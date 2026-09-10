import { homeProcessContent } from "@/content/site-studio/home";
import type { HomeProcessContent } from "@/lib/site-studio/native-templates";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

export function HowWeWork({ content = homeProcessContent }: { content?: HomeProcessContent }) {
  return (
    <section className="sect ink-panel" id="how">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {content.eyebrow}
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              {content.headingStart}
              <br />
              {content.headingMiddle}
              <br />
              <span className="it">{content.headingEnd}</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              {content.body}
            </Reveal>
          </div>
        </div>

        <div className="steps">
          {/* Each step gets its own <Reveal> — its own scroll trigger — so
              it fades in exactly when THAT step scrolls into view, not on
              a fixed delay measured from when the list's top appeared.
              --d is only a small tie-breaker for a fast scroll that brings
              two steps into view in the same tick. */}
          {content.steps.map((step, i) => (
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
