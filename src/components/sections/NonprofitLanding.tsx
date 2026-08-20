"use client";

/**
 * Bespoke landing page for nonprofits.
 *
 * Deliberately not the shared VerticalPage template. The nonprofit buyer reads
 * differently from a contractor: they are numerate, sceptical of vendors, and
 * accountable to a board, so the page is built like a piece of data journalism
 * rather than a services pitch. Hairline rules, sourced figures, serif numerals,
 * and one central visual argument.
 *
 * The argument: 100 first-time donors arrive, 19 ever give again. That cliff is
 * the most expensive fact in the sector and it is a capacity failure, not a
 * generosity failure. Everything below earns the call by proving we understand
 * that specific number.
 */

import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";

/* ── The cohort visual ──────────────────────────────────────────────────────
   100 dots for 100 first-time donors. 19 stay lit. Deterministic scatter so
   the layout never shifts between renders and the figure stays honest. */
const COHORT = Array.from({ length: 100 }, (_, i) => ({ i, kept: (i * 21 + 7) % 100 < 19 }));

function DonorCohort() {
  return (
    <figure className="relative">
      <div className="mx-auto grid max-w-[26rem] grid-cols-10 gap-[clamp(6px,0.9vw,10px)] lg:mx-0">
        {COHORT.map(({ i, kept }) => (
          <span
            key={i}
            aria-hidden="true"
            style={{ animationDelay: `${140 + i * 14}ms` }}
            className={[
              "aspect-square rounded-full opacity-0 [animation-fill-mode:forwards]",
              "motion-safe:animate-[cohortIn_.5s_var(--ease)_forwards] motion-reduce:opacity-100",
              kept
                ? "bg-[var(--fg)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--fg)_25%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--fg)_13%,transparent)]",
            ].join(" ")}
          />
        ))}
      </div>
      <figcaption className="mx-auto mt-7 flex max-w-[26rem] items-start gap-4 lg:mx-0 border-t border-[color-mix(in_srgb,var(--fg)_14%,transparent)] pt-5">
        <span className="mt-[3px] size-2 shrink-0 rounded-full bg-[var(--fg)]" />
        <p className="font-mono text-[0.68rem] uppercase leading-[1.7] tracking-[0.14em] text-white-muted">
          100 first-time donors. 19 give again.
          <br />
          <span className="text-white-muted/70">
            Fundraising Effectiveness Project, 2025
          </span>
        </p>
      </figcaption>
    </figure>
  );
}

/* ── Sourced figures ─────────────────────────────────────────────────────── */
const FIGURES = [
  { value: "18.9%", label: "First-time donors who give a second gift", source: "FEP 2025" },
  { value: "59%", label: "Second-time donors who keep giving after that", source: "FEP 2025" },
  { value: "92%", label: "Nonprofits now using AI somewhere", source: "Nonprofit AI Adoption, 2026" },
  { value: "7%", label: "Nonprofits where AI meaningfully changed output", source: "Nonprofit AI Adoption, 2026" },
];

/* ── What breaks ─────────────────────────────────────────────────────────── */
const BREAKS = [
  {
    n: "01",
    title: "The second gift is never asked for",
    body: "A first gift arrives on a Thursday. The thank-you goes out late, the impact update never gets written, and the second ask waits for a quarter that never has a spare week in it. The donor does not decide to leave. They are simply never spoken to again.",
  },
  {
    n: "02",
    title: "You already bought the AI. Nothing changed.",
    body: "Almost every organization now has a tool with AI in the name. Very few report it changing what their team can actually finish. Software was never the missing piece. Somebody has to design the workflow, wire it to your donor data, and keep it running on the weeks everyone is underwater.",
  },
  {
    n: "03",
    title: "Stewardship loses to whatever has a deadline",
    body: "Grant reports have dates. Board packets have dates. Thanking a donor properly does not, so it is the work that slips first, every single time, on teams that are already carrying more than they have support for.",
  },
  {
    n: "04",
    title: "Nobody trusts the numbers in the board packet",
    body: "Retention gets recalculated by hand from spreadsheets that disagree. The figure in the deck does not match the figure in the database, so the conversation becomes about the data instead of about the strategy.",
  },
];

/* ── The system, as a donor actually experiences it ──────────────────────── */
const JOURNEY = [
  { when: "34 seconds", what: "Thanked", detail: "The gift is matched to the right supporter and a personal thank-you goes out in your voice, not a receipt." },
  { when: "Day 3", what: "Shown the outcome", detail: "One short note about what the money did. No ask attached. This is the message almost nobody sends and it is the one that earns the second gift." },
  { when: "Day 30", what: "Invited back", detail: "A second ask timed to how this donor behaves, referencing the program they already funded." },
  { when: "Day 90", what: "Offered the recurring path", detail: "Donors who have given twice are invited to give monthly, where retention runs in the high seventies." },
  { when: "Always", what: "Escalated when human", detail: "A major gift signal, a complaint, or anything ambiguous stops the automation and goes to a person with the full history attached." },
];

/* ── Client work, described as scope rather than invented outcomes ───────── */
const WORKSHELTER_WORK = [
  {
    title: "A custom command center",
    body: "One place to run the whole operation end to end, instead of the work living across separate tools that never agreed with each other.",
  },
  {
    title: "Automation across the operation",
    body: "The follow-ups, handoffs, and updates that used to depend on somebody remembering now happen on their own, including on the weeks nobody has an evening spare.",
  },
  {
    title: "Design work",
    body: "How the organization presents itself, so the public face matches the seriousness of the work behind it.",
  },
  {
    title: "Operating strategy",
    body: "What to run, in what order, and what to stop doing. The hardest part is rarely the tooling.",
  },
];

/* ── Objections this audience actually has ──────────────────────────────── */
const OBJECTIONS = [
  {
    q: "Will our donors be able to tell?",
    a: "They should not, because the words are yours. Your team sets the voice and approves the templates once. The AI does the remembering, the matching, and the timing. It never invents a fact about your programs, and anything it is unsure about goes to a person instead of being guessed at.",
  },
  {
    q: "Is our donor data safe?",
    a: "Your data stays in your systems. We work alongside the CRM you already have rather than replacing it, every change is logged with who or what made it, and nothing is used to train a public model. Security is the sector's most cited AI concern and it should be.",
  },
  {
    q: "We have no capacity to run another tool.",
    a: "That is the entire point. This is not software we hand over with a login and a training video. We build the system around your operations and then we run it, which is why it keeps working in the weeks your team has nothing left to give it.",
  },
  {
    q: "How is this a defensible use of donor money?",
    a: "Because it is aimed at the cheapest revenue you will ever raise. Keeping a donor you already have costs a fraction of finding a new one, and the second gift is the single conversion that turns a one-time giver into a long-term supporter.",
  },
];

export function NonprofitLanding() {
  return (
    <>
      {/* Local keyframes for the cohort reveal. Scoped by name, motion-safe only. */}
      <style>{`@keyframes cohortIn{from{opacity:0;transform:translateY(6px) scale(.82)}to{opacity:1;transform:none}}`}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-[clamp(4rem,8vw,7rem)] pt-[clamp(6rem,11vw,9.5rem)]">
        <Container width="wide">
          <div className="grid items-center gap-[clamp(3rem,6vw,6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            <div className="min-w-0">
              <AnimateOnScroll>
                <Eyebrow className="mb-7">For nonprofits</Eyebrow>
              </AnimateOnScroll>

              <RevealHeading
                as="h1"
                className="font-display font-extrabold leading-[1.02] tracking-[-0.038em] text-[clamp(2.3rem,4.6vw,4.4rem)] text-heading"
                lead="Your donors did not lose interest."
                accent="They never heard from you again."
              />

              <AnimateOnScroll delay={0.15}>
                <p className="mt-8 max-w-[46ch] text-[1.05rem] leading-[1.75] text-white-secondary">
                  Fewer than one in five first-time donors ever gives a second gift.
                  That is rarely about generosity. It is capacity: the thank-you and
                  the second ask land on a team already at its limit. We build custom
                  AI systems that steward every donor on time and in your voice, then
                  run them for you.
                </p>
              </AnimateOnScroll>

              <AnimateOnScroll delay={0.28}>
                <div className="mt-10">
                  <BookCallButton location="nonprofit_hero" label="Book a 20-minute call" />
                </div>
              </AnimateOnScroll>
            </div>

            <AnimateOnScroll delay={0.2} className="min-w-0">
              <DonorCohort />
            </AnimateOnScroll>
          </div>
        </Container>
      </section>

      {/* ── The arithmetic ───────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(3.5rem,6vw,5.5rem)]">
        <Container width="wide">
          <AnimateOnScroll>
            <Eyebrow className="mb-10">the arithmetic</Eyebrow>
          </AnimateOnScroll>
          <dl className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {FIGURES.map((figure, i) => (
              <AnimateOnScroll key={figure.value + figure.label} delay={0.06 * i}>
                <div className="border-t border-[color-mix(in_srgb,var(--fg)_16%,transparent)] pt-6">
                  <dt className="font-serif text-[clamp(2.6rem,4.2vw,3.6rem)] font-medium leading-none tracking-[-0.02em] text-heading">
                    {figure.value}
                  </dt>
                  <dd className="mt-5 max-w-[26ch] text-sm leading-[1.65] text-white-secondary">
                    {figure.label}
                  </dd>
                  <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white-muted/70">
                    {figure.source}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </dl>
          <AnimateOnScroll delay={0.3}>
            <p className="mt-14 max-w-[62ch] border-l border-[color-mix(in_srgb,var(--fg)_25%,transparent)] pl-6 font-serif text-[clamp(1.15rem,1.9vw,1.5rem)] italic leading-[1.55] text-white-secondary">
              Almost everyone has the technology. Almost nobody has the outcome.
              The gap is not the model. It is that no one is running it.
            </p>
          </AnimateOnScroll>
        </Container>
      </section>

      {/* ── Where it breaks ──────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container width="wide">
          <AnimateOnScroll>
            <Eyebrow className="mb-6">where it actually breaks</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            className="mb-16 max-w-3xl font-display font-bold leading-[1.06] tracking-[-0.03em] text-[clamp(1.8rem,3.1vw,2.8rem)] text-heading"
            lead="Four failures, and none of them"
            accent="are about caring less."
          />
          <div className="grid gap-px bg-[color-mix(in_srgb,var(--fg)_12%,transparent)] sm:grid-cols-2">
            {BREAKS.map((item, i) => (
              <AnimateOnScroll key={item.n} delay={0.06 * i}>
                <article className="h-full bg-[var(--bg)] p-[clamp(1.6rem,3vw,2.6rem)]">
                  <p className="font-mono text-[0.68rem] tracking-[0.2em] text-white-muted/60">{item.n}</p>
                  <h3 className="mt-5 max-w-[24ch] font-display text-[1.2rem] font-semibold leading-[1.3] tracking-[-0.015em] text-heading">
                    {item.title}
                  </h3>
                  <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-[1.7] text-white-secondary">
                    {item.body}
                  </p>
                </article>
              </AnimateOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {/* ── The journey we build and run ─────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container width="wide">
          <div className="grid gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <AnimateOnScroll>
                <Eyebrow className="mb-6">what we build and run</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                className="font-display font-bold leading-[1.06] tracking-[-0.03em] text-[clamp(1.8rem,3.1vw,2.8rem)] text-heading"
                lead="One donor, followed"
                accent="all the way through."
              />
              <AnimateOnScroll delay={0.15}>
                <p className="mt-7 max-w-[42ch] text-[0.98rem] leading-[1.75] text-white-secondary">
                  This is the sequence a single first-time donor moves through once
                  the system is live. Your team writes the voice once and approves
                  it. After that it runs whether or not anyone has capacity that week.
                </p>
              </AnimateOnScroll>
            </div>

            <ol className="relative">
              {JOURNEY.map((step, i) => (
                <AnimateOnScroll key={step.when} delay={0.05 * i}>
                  <li className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 pb-14 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <span className="mt-[7px] size-[9px] rounded-full bg-[var(--fg)]" />
                      {i < JOURNEY.length - 1 && (
                        <span className="mt-2 w-px flex-1 bg-[color-mix(in_srgb,var(--fg)_18%,transparent)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-white-muted">
                        {step.when}
                      </p>
                      <h3 className="mt-2 font-display text-[1.35rem] font-semibold leading-[1.25] tracking-[-0.02em] text-heading">
                        {step.what}
                      </h3>
                      <p className="mt-3 max-w-[52ch] text-[0.95rem] leading-[1.7] text-white-secondary">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                </AnimateOnScroll>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* ── Proof ────────────────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container width="wide">
          <AnimateOnScroll>
            <Eyebrow className="mb-6">who we do this for</Eyebrow>
          </AnimateOnScroll>

          <div className="grid gap-[clamp(2.5rem,5vw,4.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="min-w-0">
              <AnimateOnScroll>
                <p className="font-display text-[clamp(2rem,3.6vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-heading">
                  WORK+SHELTER
                </p>
                <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white-muted">
                  Delhi, India
                  <span className="mx-3 text-white-muted/40">/</span>
                  Nonprofit with a manufacturing arm
                  <span className="mx-3 text-white-muted/40">/</span>
                  All-volunteer staff
                </p>
              </AnimateOnScroll>

              <AnimateOnScroll delay={0.12}>
                <p className="mt-9 max-w-[52ch] text-[0.98rem] leading-[1.75] text-white-secondary">
                  WORK+SHELTER employs and trains women in Delhi living in poverty,
                  many of them survivors of domestic abuse. Paid work at fair wages,
                  savings programs and interest-free loans, family counseling, English
                  classes, and computer training. The nonprofit runs on volunteers,
                  alongside a manufacturing business producing apparel, accessories,
                  and reusable packaging.
                </p>
              </AnimateOnScroll>

              <AnimateOnScroll delay={0.2}>
                <p className="mt-7 max-w-[52ch] border-l border-[color-mix(in_srgb,var(--fg)_25%,transparent)] pl-6 font-serif text-[clamp(1.05rem,1.7vw,1.32rem)] italic leading-[1.6] text-white-secondary">
                  Two organizations sharing one operation. Donors and customers,
                  program outcomes and production orders, volunteers and staff, all
                  tracked in different places by people giving their evenings to it.
                </p>
              </AnimateOnScroll>

              <AnimateOnScroll delay={0.28}>
                <a
                  href="https://workshelter.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-9 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-white-muted underline decoration-[color-mix(in_srgb,var(--fg)_30%,transparent)] underline-offset-[6px] transition-colors duration-150 hover:text-heading"
                >
                  workshelter.org
                </a>
              </AnimateOnScroll>
            </div>

            <div className="min-w-0">
              <AnimateOnScroll delay={0.15}>
                <p className="border-b border-[color-mix(in_srgb,var(--fg)_16%,transparent)] pb-4 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-white-muted">
                  What we built and run for them
                </p>
              </AnimateOnScroll>
              <dl>
                {WORKSHELTER_WORK.map((item, i) => (
                  <AnimateOnScroll key={item.title} delay={0.2 + i * 0.06}>
                    <div className="border-b border-[color-mix(in_srgb,var(--fg)_10%,transparent)] py-6">
                      <dt className="font-display text-[1.08rem] font-semibold leading-[1.3] tracking-[-0.015em] text-heading">
                        {item.title}
                      </dt>
                      <dd className="mt-2.5 max-w-[46ch] text-[0.93rem] leading-[1.7] text-white-secondary">
                        {item.body}
                      </dd>
                    </div>
                  </AnimateOnScroll>
                ))}
              </dl>
              <AnimateOnScroll delay={0.5}>
                <p className="mt-7 max-w-[46ch] text-[0.93rem] leading-[1.7] text-white-muted">
                  Built for a team with no spare capacity at all, which is the
                  condition this whole page is really about.
                </p>
              </AnimateOnScroll>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Objections ───────────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container width="wide">
          <AnimateOnScroll>
            <Eyebrow className="mb-6">the fair questions</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            className="mb-16 max-w-3xl font-display font-bold leading-[1.06] tracking-[-0.03em] text-[clamp(1.8rem,3.1vw,2.8rem)] text-heading"
            lead="What a board will ask"
            accent="before they say yes."
          />
          <div className="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-12 lg:grid-cols-2">
            {OBJECTIONS.map((item, i) => (
              <AnimateOnScroll key={item.q} delay={0.06 * i}>
                <div className="border-t border-[color-mix(in_srgb,var(--fg)_16%,transparent)] pt-6">
                  <h3 className="max-w-[30ch] font-serif text-[clamp(1.2rem,2vw,1.55rem)] italic leading-[1.35] text-heading">
                    {item.q}
                  </h3>
                  <p className="mt-5 max-w-[52ch] text-[0.95rem] leading-[1.72] text-white-secondary">
                    {item.a}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(5rem,9vw,8rem)]">
        <Container width="wide">
          <div className="grid gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-2">
            <div>
              <AnimateOnScroll>
                <Eyebrow className="mb-7">start</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                className="font-display font-extrabold leading-[1.0] tracking-[-0.04em] text-[clamp(2.2rem,4.4vw,4.2rem)] text-heading"
                lead="Bring us your"
                accent="retention number."
              />
            </div>
            <div className="flex flex-col gap-7">
              <AnimateOnScroll delay={0.15}>
                <p className="max-w-[48ch] text-lg leading-[1.7] text-white-secondary">
                  Twenty minutes. We look at your own donor file, work out what a
                  first-to-second gift improvement is actually worth to you in a year,
                  and show you the sequence that gets it. You keep the plan whether or
                  not you work with us.
                </p>
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.25}>
                <BookCallButton location="nonprofit_closing" label="Book a 20-minute call" />
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.35}>
                <CallTerms />
              </AnimateOnScroll>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
