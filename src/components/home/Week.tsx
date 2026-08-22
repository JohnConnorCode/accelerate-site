import { Reveal } from "./reveal";
import { CountUp } from "./CountUp";
import { AmbientField } from "./AmbientField";

const BEFORE = [
  "Inquiries that go unanswered while the crew is on a job",
  "Estimates that sit until someone has an evening",
  "Follow-up that depends on memory",
  "After-hours inquiries that wait until morning",
];

const AFTER = [
  "Every inquiry answered while it is still warm",
  "Estimates and reminders that leave on their own",
  "The same people spend the week on jobs, cases, and clients",
  "A whole layer of busywork no longer needs a person",
];

export function Week() {
  return (
    <section className="sect" id="week">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            The week we give back
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Your people are trapped in work
            <br />
            the business should not
            <br />
            need them for.
          </Reveal>
          <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
            We absorb intake, follow-up, and scheduling. The same team spends the hours on the work only they can do.
          </Reveal>
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

        <div className="week-stats">
          <Reveal rv className="week-stat">
            <CountUp target="10" className="week-n" />
            <span className="week-n-label">
              Hours a week per person, typical on the workflows we take on
            </span>
          </Reveal>
          <Reveal rv className="week-stat" delay={0.08}>
            <span className="week-n week-n-word">One role</span>
            <span className="week-n-label">
              Worth of routine work absorbed, so that labor moves to higher-precision work
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
