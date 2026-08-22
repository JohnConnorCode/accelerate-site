"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { industryVisual } from "@/content/industry-visuals";
import type { Vertical } from "@/lib/types";

const H1 = "max-w-[17ch] font-display font-extrabold leading-[1.0] tracking-[-0.04em] text-[clamp(2.5rem,5.6vw,5rem)]";
const H2 = "max-w-[24ch] font-display font-extrabold leading-[1.06] tracking-[-0.03em] text-[clamp(1.9rem,3.6vw,3.1rem)] text-heading";

type RelatedArticle = { slug: string; title: string };
const RELATED_READING: Record<string, RelatedArticle[]> = {
  "home-services": [
    { slug: "home-service-automations-2026", title: "5 Automations Every Home Service Business Needs in 2026" },
    { slug: "ai-for-contractors", title: "AI for Contractors: How Home Service Businesses Win More Jobs" },
    { slug: "servicetitan-vs-housecall-pro-vs-jobber", title: "ServiceTitan vs Housecall Pro vs Jobber, Compared for 2026" },
  ],
  "law-firms": [
    { slug: "ai-for-law-firms", title: "AI for Law Firms: Save 10+ Hours Per Week" },
    { slug: "ai-tools-law-firms-2026", title: "5 AI Tools Every Law Firm Should Be Using in 2026" },
    { slug: "ai-intake-personal-injury-firms", title: "AI Client Intake for Personal Injury Firms: A Complete Guide" },
  ],
  "real-estate": [
    { slug: "ai-for-real-estate-agents", title: "AI for Real Estate Agents: Automate Follow-Up, Win More Listings" },
    { slug: "ai-for-real-estate-teams", title: "AI for Real Estate Teams: Automate Follow-Up, Close More Deals" },
  ],
  "professional-services": [
    { slug: "ai-for-accountants", title: "AI for Accountants and Bookkeepers: Automate Client Onboarding" },
    { slug: "best-crm-small-business-2026", title: "The Best CRM for Small Businesses in 2026" },
  ],
};

export function VerticalPage({ vertical }: { vertical: Vertical }) {
  const visual = industryVisual(vertical.slug);
  const relatedReading = RELATED_READING[vertical.slug] ?? [];
  const stills = visual ? [visual.hero, ...visual.stills].slice(0, 3) : [];

  return (
    <>
      <section className={visual ? "page-offset relative" : "page-offset-roomy relative"}>
        {visual ? (
          <div className="photo-hero relative overflow-hidden [&_.display-italic]:!text-white">
            <div className="absolute inset-0">
              <Image
                src={visual.hero.src}
                alt={visual.hero.alt}
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,6,0.4)_0%,rgba(6,6,6,0.18)_36%,rgba(6,6,6,0.82)_100%)] lg:bg-[linear-gradient(100deg,rgba(6,6,6,0.95)_0%,rgba(6,6,6,0.88)_40%,rgba(6,6,6,0.5)_70%,rgba(6,6,6,0.34)_100%)]" />
            </div>
            <Container className="photo-hero-inner relative">
              <div className="max-w-[54rem]">
                <AnimateOnScroll>
                  <Eyebrow className="mb-7 !text-white/85">{vertical.name}</Eyebrow>
                </AnimateOnScroll>
                <RevealHeading
                  as="h1"
                  className={`${H1} text-white`}
                  lead={vertical.heroHeadlineWhite}
                  accent={vertical.heroHeadlineGold}
                  delay={0.12}
                />
                <AnimateOnScroll delay={0.22}>
                  <p className="mt-6 max-w-[46ch] text-[1.02rem] leading-[1.7] text-white/75 lg:mt-9 lg:text-[1.08rem] lg:leading-[1.8]">
                    {vertical.heroSubheadline}
                  </p>
                </AnimateOnScroll>
                <AnimateOnScroll delay={0.32}>
                  <div className="mt-8 lg:mt-10">
                    <BookCallButton variant="inverse" location="industry_hero" />
                  </div>
                </AnimateOnScroll>
              </div>
            </Container>
          </div>
        ) : (
          <Container className="py-[clamp(3.5rem,8vw,7rem)]">
            <AnimateOnScroll>
              <Eyebrow className="mb-7">{vertical.name}</Eyebrow>
            </AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={`${H1} text-heading`}
              lead={vertical.heroHeadlineWhite}
              accent={vertical.heroHeadlineGold}
              delay={0.12}
            />
            <AnimateOnScroll delay={0.22}>
              <p className="mt-9 max-w-[46ch] text-[1.08rem] leading-[1.8] text-white-secondary">
                {vertical.heroSubheadline}
              </p>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.32}>
              <div className="mt-10">
                <BookCallButton location="industry_hero" />
              </div>
            </AnimateOnScroll>
          </Container>
        )}
      </section>

      <section className="relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <AnimateOnScroll>
            <Eyebrow className="mb-6">the Tuesday</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            as="h2"
            className={H2}
            lead="The work that traps the team,"
            accent="every single week."
          />
          <AnimateOnScroll delay={0.12}>
            <p className="mt-7 max-w-[58ch] text-[1.02rem] leading-[1.75] text-white-secondary">
              These are capacity problems. Asking the same people to try harder does not fix them.
            </p>
          </AnimateOnScroll>
          <div className="mt-16 grid gap-x-14 gap-y-12 md:grid-cols-2">
            {vertical.painPoints.map((pain, i) => (
              <AnimateOnScroll key={pain.title} delay={0.06 * i}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-[color-mix(in_srgb,var(--fg)_18%,transparent)] pt-7">
                  <span
                    aria-hidden="true"
                    className="font-serif text-[2.1rem] font-medium leading-none tracking-[-0.02em] text-[color-mix(in_srgb,var(--fg)_28%,transparent)]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="max-w-[30ch] text-balance font-display text-[1.32rem] font-bold leading-[1.24] tracking-[-0.018em] text-heading">
                      {pain.title}
                    </h3>
                    <p className="mt-4 max-w-[44ch] text-[0.97rem] leading-[1.72] text-white-secondary">
                      {pain.description}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {stills.length >= 2 && (
        <section className="relative">
          <div className={`grid gap-px bg-[color-mix(in_srgb,var(--fg)_14%,transparent)] ${stills.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {stills.map((photo, i) => (
              <AnimateOnScroll key={photo.src} delay={0.08 * i}>
                <div className="group relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.03]"
                  />
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </section>
      )}

      <section className="relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <div className="grid gap-[clamp(3rem,6vw,5.5rem)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <AnimateOnScroll>
                <Eyebrow className="mb-6">what we take off them</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                as="h2"
                className={H2}
                lead="The layer that should"
                accent="not need a person."
              />
              <AnimateOnScroll delay={0.14}>
                <p className="mt-7 max-w-[42ch] text-[1.02rem] leading-[1.75] text-white-secondary">
                  Your team keeps the judgment. Intake, follow-up, and scheduling run in the background, in your voice, with your approvals.
                </p>
              </AnimateOnScroll>
            </div>
            <ol>
              {vertical.solutions.map((solution, i) => (
                <AnimateOnScroll key={solution.title} delay={0.06 * i}>
                  <li className="relative flex gap-7 pb-12 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <span className="mt-[9px] size-2 shrink-0 rounded-full bg-[var(--fg)] ring-4 ring-[color-mix(in_srgb,var(--fg)_10%,transparent)]" />
                      {i < vertical.solutions.length - 1 && (
                        <span className="mt-2 w-px flex-1 bg-[color-mix(in_srgb,var(--fg)_18%,transparent)]" />
                      )}
                    </div>
                    <div className="pb-1">
                      <h3 className="font-display text-[1.12rem] font-bold leading-[1.3] tracking-[-0.012em] text-heading">
                        {solution.title}
                      </h3>
                      <p className="mt-2.5 max-w-[48ch] text-[0.97rem] leading-[1.7] text-white-secondary">
                        {solution.description}
                      </p>
                    </div>
                  </li>
                </AnimateOnScroll>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {relatedReading.length > 0 && (
        <section className="relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
          <Container>
            <AnimateOnScroll>
              <Eyebrow className="mb-6">go deeper</Eyebrow>
            </AnimateOnScroll>
            <RevealHeading
              as="h2"
              className={H2}
              lead="Related reading for"
              accent={`${vertical.name.toLowerCase()}.`}
            />
            <div className="mt-12">
              {relatedReading.map((article) => (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="group flex items-baseline justify-between gap-6 border-t border-[color-mix(in_srgb,var(--fg)_14%,transparent)] py-6 last:border-b"
                >
                  <span className="font-display text-[1.15rem] font-semibold leading-snug tracking-[-0.02em] text-heading">
                    {article.title}
                  </span>
                  <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white-muted">
                    Read
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/services"
              className="mt-10 inline-block font-display text-[15.5px] text-[var(--fg)] ink-sweep"
            >
              See everything we build and run <span aria-hidden="true">→</span>
            </Link>
          </Container>
        </section>
      )}

      <section className="ink-panel relative">
        <Container className="py-[clamp(4.5rem,8vw,7rem)]">
          <Eyebrow className="mb-7 !text-[var(--panel-fg)]">start here</Eyebrow>
          <h2 className="h2" style={{ color: "var(--panel-fg)" }}>
            A plan built for
            <br />
            <span className="it">{vertical.name.toLowerCase()}.</span>
          </h2>
          <p className="lede mt-7 max-w-[46ch]" style={{ color: "var(--soft)" }}>
            Thirty minutes. We look at where the hours go. You leave with a plan, yours to keep either way.
          </p>
          <div className="mt-10">
            <BookCallButton variant="inverse" location="industry_closing" />
          </div>
          <CallTerms className="mt-8 !border-[color-mix(in_srgb,var(--paper)_18%,transparent)] !text-[var(--soft)]" />
        </Container>
      </section>
    </>
  );
}
