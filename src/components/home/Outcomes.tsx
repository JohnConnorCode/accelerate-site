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
            Measured purely
            <br />
            by revenue and
            <br />
            reclaimed hours.
          </Reveal>
        </div>

        <Reveal as="div" className="oc">
          <ScrollParallax speed={-0.18} className="oc-col">
            <Reveal rv>
              <p className="oc-big">
                Accelerated
                <br />
                <span className="it">revenue capture</span>
              </p>
              <p className="body-c">
                Instant inbound response. Flawless follow-up. A compressed timeline from first contact to closed deal. Companies lose more revenue to delay than to competition.
              </p>
            </Reveal>
          </ScrollParallax>
          <ScrollParallax speed={0.18} className="oc-col">
            <Reveal rv delay={0.14}>
              <p className="oc-big">
                Infinite
                <br />
                <span className="it">operational scale</span>
              </p>
              <p className="body-c">
                Routine workflows are absorbed by automation. Your team retains the complex judgment, the high-value relationships, and the nuanced exceptions.
              </p>
            </Reveal>
          </ScrollParallax>
        </Reveal>
      </div>
    </section>
  );
}
