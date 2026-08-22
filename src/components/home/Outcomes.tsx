import { Reveal } from "./reveal";
import { ScrollParallax } from "./ScrollParallax";
import { AmbientField } from "./AmbientField";

export function Outcomes() {
  return (
    <section className="sect ink-panel" id="outcomes" >
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            What you get
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Measured in
            <br />
            revenue and
            <br />
            hours returned.
          </Reveal>
        </div>

        <Reveal as="div" className="oc">
          <ScrollParallax speed={-0.18} className="oc-col">
            <Reveal rv>
              <p className="oc-big">
                Answered
                <br />
                <span className="it">in minutes</span>
              </p>
              <p className="body-c">
                First response while the inquiry is still warm, any hour of the day. Follow-up runs on schedule instead of memory. Quotes go out while the customer is still deciding.
              </p>
            </Reveal>
          </ScrollParallax>
          <ScrollParallax speed={0.18} className="oc-col">
            <Reveal rv delay={0.14}>
              <p className="oc-big">
                One role
                <br />
                <span className="it">absorbed</span>
              </p>
              <p className="body-c">
                The routine work runs without adding headcount. Your team keeps the decisions, the relationships, and the exceptions.
              </p>
            </Reveal>
          </ScrollParallax>
        </Reveal>
      </div>
    </section>
  );
}
