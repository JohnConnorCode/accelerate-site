import { Reveal } from "./reveal";

export function Outcomes() {
  return (
    <section className="sect ink-panel" id="outcomes" style={{ paddingTop: "clamp(70px,9vw,126px)" }}>
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
          <div className="oc-div" aria-hidden="true" />
          <Reveal rv as="div" className="oc-col">
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
          <Reveal rv as="div" className="oc-col" delay={0.14}>
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
        </Reveal>

        <Reveal rv as="div" className="oc-foot">
          <p>
            We set the measure before the work starts, so the result is
            something you can verify.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
