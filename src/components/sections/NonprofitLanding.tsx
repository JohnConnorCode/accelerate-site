"use client";

/**
 * Bespoke landing page for nonprofits.
 *
 * Deliberately not the shared VerticalPage template.
 *
 * HARD RULE FOR THIS FILE: no statistic, percentage, benchmark, dollar figure,
 * duration, or cited source appears anywhere on it. An earlier version carried
 * four sourced-looking figures, a hundred-dot donor cohort chart, and a set of
 * timings, and every one of them was fabricated, including the sources. None of
 * it was measured, we have no benchmark data, and inventing it to sound
 * credible to a numerate buyer is the fastest way to deserve none of their
 * trust.
 *
 * What replaces it is recognition and specificity. A nonprofit operations lead
 * does not need to be told a retention percentage; they need to read a sentence
 * that describes their actual Tuesday and realise somebody understands the job.
 * That is a stronger claim than a number, and it has the advantage of being
 * true.
 *
 * SECOND HARD RULE: no "not X, it's Y" antithesis anywhere. No "it is not the
 * hard part", no "not another platform", no "the donor does not decide to
 * leave". That construction tells the reader what they are or what they think
 * before it makes its point, and it manufactures insight by knocking down a
 * strawman. Say the true thing and let it stand.
 *
 * The photography is real documentary work under the Unsplash License, stored
 * locally rather than hotlinked. The page is about people, so it shows people.
 */

import Image from "next/image";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";

/* ── Where the work actually falls over ───────────────────────────────────
   Described, not measured. Every line here is something an operations lead
   recognises from their own week, which is why none of it needs a citation. */
const BREAKS = [
  {
    n: "01",
    title: "The second gift never gets asked for",
    body: "A first gift arrives on a Thursday. The thank-you goes out late, the note about what it paid for never gets written, and the second ask waits for a quarter with a spare week in it. The supporter simply stops hearing from you.",
  },
  {
    n: "02",
    title: "The platform nobody had time to configure",
    body: "There is a tool in the stack with AI in the name and a login nobody has opened since the demo. Someone has to design the workflow, wire it to your donor data, and keep it running through the weeks your team is underwater.",
  },
  {
    n: "03",
    title: "Stewardship loses to whatever has a deadline",
    body: "Grant reports have dates. Board packets have dates. Thanking a donor properly has none, so it slips first, every time, on teams already carrying more than they have support for.",
  },
  {
    n: "04",
    title: "The board packet gets argued with",
    body: "Figures get rebuilt by hand from spreadsheets that disagree with the database. The meeting turns into a conversation about where the numbers came from.",
  },
];

/* ── What the system does, in the order a supporter experiences it ────────
   Ordering only. An earlier version attached invented timings to these; the
   sequence is the honest part, and it is the part that matters. */
const SEQUENCE = [
  {
    what: "The moment a gift lands",
    detail: "It is matched to the right supporter and thanked in your voice, straight away, while the decision to give is still fresh.",
  },
  {
    what: "Before the next ask",
    detail: "A short note about what the money paid for, with nothing attached to it. This is the message that earns the gift after it.",
  },
  {
    what: "When they are ready to give again",
    detail: "A second ask that references the program they already funded, in language your team approved once.",
  },
  {
    what: "When a one-time gift could become monthly",
    detail: "The recurring path goes to the supporters whose giving pattern suggests they would take it.",
  },
  {
    what: "The moment something needs a person",
    detail: "A major gift signal, a complaint, anything ambiguous: the automation stops and hands it to a human with the full history attached.",
  },
];

/* ── Client work, described as scope rather than invented outcomes ───────── */
const WORKSHELTER_WORK = [
  {
    title: "A custom command center",
    body: "One place to run the whole operation end to end, instead of the work living across separate tools that never agreed with each other.",
  },
  {
    title: "Automation across the operation",
    body: "The follow-ups, handoffs, and updates that used to depend on somebody remembering now happen on their own, including in the weeks nobody has an evening spare.",
  },
  {
    title: "Design work",
    body: "How the organization presents itself, so the public face matches the seriousness of the work behind it.",
  },
  {
    title: "Operating strategy",
    body: "What to run, in what order, and what to stop doing. Most of the difficulty sits in the sequencing.",
  },
];

export function NonprofitLanding() {
  return (
    <>
      {/* ── Hero: full-bleed documentary photograph. The page is about people,
             so the first thing on it is people doing the work. ───────────── */}
      <section className="relative pt-[clamp(5rem,7vw,6.5rem)]">
        {/* The photo starts BELOW the header rather than behind it. The nav takes
            its colour from the theme, not from whatever is under it, so a
            full-bleed dark image behind it renders dark type on a dark
            photograph. Insetting solves that properly instead of fighting it. */}
        <div className="relative min-h-[min(80svh,46rem)] overflow-hidden [&_.display-italic]:!text-white">
          <div className="absolute inset-0">
          <Image
            src="/images/nonprofits/hero.jpg"
            alt="Volunteers sorting donated food into boxes at a community distribution table"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* Two gradients rather than a flat scrim: the image keeps its depth
              on the right, the type keeps its contrast on the left. */}
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,6,6,0.95)_0%,rgba(6,6,6,0.88)_40%,rgba(6,6,6,0.5)_70%,rgba(6,6,6,0.34)_100%)]" />
          </div>

          <Container className="relative flex min-h-[min(80svh,46rem)] items-center py-[clamp(4.5rem,9vw,7rem)]">
          <div className="max-w-[54rem]">
            <AnimateOnScroll>
              <Eyebrow className="mb-7 !text-white/85">For nonprofits</Eyebrow>
            </AnimateOnScroll>

            <RevealHeading
              as="h1"
              className="max-w-[17ch] font-display font-extrabold leading-[1.0] tracking-[-0.04em] text-[clamp(2.5rem,5.6vw,5rem)] text-white"
              lead="Every supporter thanked, followed up,"
              accent="and invited back."
            />

            <AnimateOnScroll delay={0.18}>
              <p className="mt-9 max-w-[46ch] text-[1.08rem] leading-[1.8] text-white/75">
                We build the systems that keep your supporter relationships moving, and
                then we run them alongside your team. Your voice, your data, your
                approvals. The remembering becomes ours.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.3}>
              <div className="mt-10">
                <BookCallButton variant="inverse" location="nonprofit_hero" label="Book a 20-minute call" />
              </div>
            </AnimateOnScroll>
          </div>
          </Container>
        </div>
      </section>

      {/* ── Recognition ─────────────────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <AnimateOnScroll>
            <Eyebrow className="mb-6">where it actually breaks</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            as="h2"
            className="max-w-[24ch] font-display font-extrabold leading-[1.06] tracking-[-0.03em] text-[clamp(1.9rem,3.6vw,3.1rem)] text-heading"
            lead="The work that slips first,"
            accent="every single time."
          />
          <AnimateOnScroll delay={0.12}>
            <p className="mt-7 max-w-[58ch] text-[1.02rem] leading-[1.75] text-white-secondary">
              Every one of these comes down to capacity, and every one of them is
              fixable. Asking a stretched team to try harder fixes none of them.
            </p>
          </AnimateOnScroll>

          <div className="mt-16 grid gap-x-14 gap-y-12 md:grid-cols-2">
            {BREAKS.map((item, i) => (
              <AnimateOnScroll key={item.n} delay={0.06 * i}>
                <div className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-[color-mix(in_srgb,var(--fg)_18%,transparent)] pt-7">
                  <span
                    aria-hidden="true"
                    className="font-serif text-[2.1rem] font-medium leading-none tracking-[-0.02em] text-[color-mix(in_srgb,var(--fg)_28%,transparent)] transition-colors duration-500 group-hover:text-[color-mix(in_srgb,var(--fg)_55%,transparent)]"
                  >
                    {item.n}
                  </span>
                  <div>
                    <h3 className="max-w-[30ch] text-balance font-display text-[1.32rem] font-bold leading-[1.24] tracking-[-0.018em] text-heading">
                      {item.title}
                    </h3>
                    <p className="mt-4 max-w-[44ch] text-[0.97rem] leading-[1.72] text-white-secondary">
                      {item.body}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Photographic interlude: the register the whole page sits in ─── */}
      <section className="relative">
        <div className="grid gap-px bg-[color-mix(in_srgb,var(--fg)_14%,transparent)] sm:grid-cols-3">
          {[
            { src: "/images/nonprofits/packing.jpg", alt: "A volunteer packing food into bags for distribution" },
            { src: "/images/nonprofits/supplies.jpg", alt: "Volunteers in branded shirts serving food under an outdoor canopy" },
            { src: "/images/nonprofits/sorting.jpg", alt: "Volunteers organizing donated fresh produce" },
          ].map((photo, i) => (
            <AnimateOnScroll key={photo.src} delay={0.08 * i}>
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-[1.2s] ease-[var(--ease)] hover:scale-[1.04]"
                />
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ── What we build and run ───────────────────────────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <div className="grid gap-[clamp(3rem,6vw,5.5rem)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <AnimateOnScroll>
                <Eyebrow className="mb-6">what we build and run</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                as="h2"
                className="max-w-[18ch] font-display font-extrabold leading-[1.06] tracking-[-0.03em] text-[clamp(1.9rem,3.6vw,3.1rem)] text-heading"
                lead="What your supporters"
                accent="actually experience."
              />
              <AnimateOnScroll delay={0.14}>
                <p className="mt-7 max-w-[42ch] text-[1.02rem] leading-[1.75] text-white-secondary">
                  Your team writes the voice and approves the templates once. After that,
                  the remembering, the matching, and the timing run on their own. The
                  words stay yours throughout.
                </p>
              </AnimateOnScroll>
            </div>

            <ol className="relative">
              {SEQUENCE.map((step, i) => (
                <AnimateOnScroll key={step.what} delay={0.06 * i}>
                  <li className="relative flex gap-7 pb-12 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <span className="mt-[9px] size-2 shrink-0 rounded-full bg-[var(--fg)] ring-4 ring-[color-mix(in_srgb,var(--fg)_10%,transparent)]" />
                      {i < SEQUENCE.length - 1 && (
                        <span className="mt-2 w-px flex-1 bg-[color-mix(in_srgb,var(--fg)_18%,transparent)]" />
                      )}
                    </div>
                    <div className="pb-1">
                      <h3 className="font-display text-[1.12rem] font-bold leading-[1.3] tracking-[-0.012em] text-heading">
                        {step.what}
                      </h3>
                      <p className="mt-2.5 max-w-[48ch] text-[0.97rem] leading-[1.7] text-white-secondary">
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

      {/* ── WORK+SHELTER: real work, described as scope ─────────────────── */}
      <section className="section-divide relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <div className="grid items-start gap-[clamp(2.5rem,5vw,4.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div>
              <AnimateOnScroll>
                <Eyebrow className="mb-6">work we have done</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                as="h2"
                className="max-w-[20ch] font-display font-extrabold leading-[1.06] tracking-[-0.03em] text-[clamp(1.9rem,3.6vw,3.1rem)] text-heading"
                lead="WORK+SHELTER"
              />
              <AnimateOnScroll delay={0.12}>
                <p className="mt-7 max-w-[46ch] text-[1.02rem] leading-[1.75] text-white-secondary">
                  We built and now run the system that organizes their operations end to
                  end. Below is the scope of that work, described plainly, so you can
                  judge whether it resembles yours.
                </p>
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.2}>
                <a
                  href="https://workshelter.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-white-muted underline-offset-[6px] transition-colors hover:text-heading hover:underline"
                >
                  workshelter.org
                  <span aria-hidden="true">↗</span>
                </a>
              </AnimateOnScroll>

              <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
                {WORKSHELTER_WORK.map((item, i) => (
                  <AnimateOnScroll key={item.title} delay={0.06 * i}>
                    <div className="border-t border-[color-mix(in_srgb,var(--fg)_16%,transparent)] pt-5">
                      <h3 className="font-display text-[1.02rem] font-bold leading-[1.3] tracking-[-0.01em] text-heading">
                        {item.title}
                      </h3>
                      <p className="mt-3 max-w-[38ch] text-[0.93rem] leading-[1.7] text-white-secondary">
                        {item.body}
                      </p>
                    </div>
                  </AnimateOnScroll>
                ))}
              </div>
            </div>

            <AnimateOnScroll delay={0.14}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm lg:sticky lg:top-28">
                <Image
                  src="/images/nonprofits/meal.jpg"
                  alt="A community meal being served to people at a shared table"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
            </AnimateOnScroll>
          </div>
        </Container>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section className="section-divide relative overflow-hidden border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] [&_.display-italic]:!text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/nonprofits/cleanup.jpg"
            alt="A volunteer coordinator leading an outdoor restoration project"
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,6,0.95)_0%,rgba(6,6,6,0.88)_45%,rgba(6,6,6,0.55)_100%)]" />
        </div>

        <Container className="relative py-[clamp(5rem,9vw,8rem)]">
          <div className="max-w-[46rem]">
            <RevealHeading
              as="h2"
              className="max-w-[20ch] font-display font-extrabold leading-[1.05] tracking-[-0.032em] text-[clamp(2rem,4vw,3.4rem)] text-white"
              lead="Twenty minutes, and you will know"
              accent="whether this is worth doing."
            />
            <AnimateOnScroll delay={0.14}>
              <p className="mt-7 max-w-[52ch] text-[1.05rem] leading-[1.75] text-white/80">
                Bring how work reaches you today and where it stalls. You will leave with
                a written plan for what to fix first, in what order, and what to leave
                alone. It is yours to keep and run yourself if you never speak to us
                again.
              </p>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.24}>
              <div className="mt-10">
                <BookCallButton variant="inverse" location="nonprofit_close" label="Book a 20-minute call" />
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.32}>
              <CallTerms className="mt-12 max-w-[40rem] !border-white/20 [&_*]:!text-white/70" />
            </AnimateOnScroll>
          </div>
        </Container>
      </section>
    </>
  );
}
