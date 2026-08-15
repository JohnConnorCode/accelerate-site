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
            Every project is measured
            <br />
            on what it earns and
            <br />
            what it frees.
          </Reveal>
        </div>

        <Reveal as="div" className="oc">
          <ScrollParallax speed={-0.18} className="oc-col">
            <Reveal rv>
              <p className="oc-big">
                Revenue you
                <br />
                were <span className="it">already earning</span>
              </p>
              <p className="body-c">
                Faster replies to inbound. Follow-up that does not depend on
                memory. A shorter path from first contact to signed work. Most
                companies lose more to delay than to competition.
              </p>
            </Reveal>
          </ScrollParallax>
          <ScrollParallax speed={0.18} className="oc-col">
            <Reveal rv delay={0.14}>
              <p className="oc-big">
                Capacity you
                <br />
                did not <span className="it">have to hire</span>
              </p>
              <p className="body-c">
                Work that repeats every week moves onto systems that handle it.
                Your team keeps the judgment, the relationships, and the
                exceptions.
              </p>
            </Reveal>
          </ScrollParallax>
        </Reveal>
      </div>
    </section>
  );
}
