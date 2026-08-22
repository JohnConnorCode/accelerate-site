import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

/* The transformation beat: two concrete lists instead of abstract outcome
   claims. The numbers live in Evidence; this section shows the shape of the
   week changing, in the customer's own nouns. */

const BEFORE = [
  "Inquiries that go unanswered while the crew is on a job",
  "Estimates that sit until someone has an evening",
  "Follow-up that depends on memory",
  "After-hours inquiries that wait until morning",
];

const AFTER = [
  "Every inquiry answered while it is still warm",
  "Estimates and reminders that send themselves",
  "Evenings stop being the catch-up shift",
  "A whole layer of busywork runs on its own",
];

export function Week() {
  return (
    <section className="sect ink-panel" id="week">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            What changes
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The week,
              <br />
              before <span className="it">and after.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              We absorb intake, follow-up, and scheduling. The same team spends the hours on the work only they can do.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="week">
          <Reveal rv className="week-col">
            <p className="label">This week</p>
            <ul>
              {BEFORE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal rv className="week-col week-col-after" delay={0.1}>
            <p className="label">The week we build toward</p>
            <ul>
              {AFTER.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
