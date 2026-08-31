"use client";

import { Mail, Clock, Zap, Check } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { Section, Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { ContactForm } from "@/components/sections/ContactForm";
import { CALENDLY_URL, hasScheduler } from "@/lib/booking";

const INFO_CARDS = [
  {
    icon: Mail,
    label: "Email",
    value: "john@acceleratewith.us",
    href: "mailto:john@acceleratewith.us",
  },
  {
    icon: Clock,
    label: "Response time",
    value: "Within 1 business day",
  },
  {
    icon: Zap,
    label: "AI strategy session",
    value: "Free · directly with John",
  },
] as const;

const RISK_REVERSAL = [
  "Where AI or automation may be useful",
  "Whether the right next step is advice, a build, training, or execution",
  "A written recommendation you can use either way",
];

export function ContactPageContent() {
  return (
    <>
      {/* hero — eyebrow + display heading + info cards in dark-glass tiles */}
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-24">
        <Container width="wide">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* left: statement */}
          <div className="min-w-0">
            <HeroEntranceItem step={1}><Eyebrow className="mb-7">contact</Eyebrow></HeroEntranceItem>
            <HeroEntranceItem step={2}><RevealHeading as="h1" className={HERO_HEADING} lead="Let's" accent="talk." entrance="parent" /></HeroEntranceItem>
            <HeroEntranceItem step={3}>
              <p className="mt-7 max-w-md text-base leading-relaxed text-white-secondary">
                Tell us what is breaking. We reply within one business day. The session is with John.
              </p>
            </HeroEntranceItem>

            {/* info cards */}
            <div className="mt-10 flex flex-col gap-3">
              {INFO_CARDS.map((card) => {
                const Icon = card.icon;
                const href = "href" in card ? card.href : undefined;
                const shell =
                  "group flex items-center gap-4 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-4";
                const inner = (
                  <>
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-[color-mix(in_srgb,var(--fg)_14%,transparent)]">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
                        {card.label}
                      </span>
                      <span className="text-sm font-medium text-heading">{card.value}</span>
                    </span>
                  </>
                );
                return (
                  <HeroEntranceItem step={4} key={card.label}>
                    {href ? (
                      <a href={href} data-cursor="link" className={shell}>{inner}</a>
                    ) : (
                      <div className={shell}>{inner}</div>
                    )}
                  </HeroEntranceItem>
                );
              })}
            </div>
          </div>

          {/* right: the active campaign booking path. Keep the manual form below
              as a fallback for visitors who prefer to send context first. */}
          <HeroEntranceItem step={3} className="lg:sticky lg:top-32">
            <div className="border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-4 sm:p-6">
              <p className="mb-1 px-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">
                Start here
              </p>
              <h2 className="mb-2 px-2 font-display text-2xl font-bold tracking-[-0.02em] text-heading">
                Book your free AI strategy session
              </h2>
              {hasScheduler() ? (
                <>
                  <p className="mb-5 px-2 text-pretty text-sm leading-6 text-white-secondary">Choose a time directly on John’s calendar.</p>
                  <iframe
                    src={`${CALENDLY_URL}?hide_gdpr_banner=1&embed_domain=acceleratewith.us&embed_type=Inline`}
                    title="Book your free AI strategy session with John"
                    className="h-[700px] w-full rounded-xl border-0 bg-white"
                  />
                  <details className="mt-5 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-heading">Prefer to send context first?</summary>
                    <div className="pt-4"><ContactForm /></div>
                  </details>
                </>
              ) : (
                <>
                  <p className="mb-5 px-2 text-pretty text-sm leading-6 text-white-secondary">
                    Tell us what is going on and John comes back with times that work, usually the same day.
                  </p>
                  <div className="px-2 pb-2"><ContactForm /></div>
                </>
              )}
            </div>
          </HeroEntranceItem>
        </div>
        </Container>
      </PublicHeroEntrance>

      {/* risk reversal — what you walk away with, free */}
      <Section width="wide" divide>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">what you walk away with</Eyebrow>
            <Heading size={2} as="h2" className="max-w-md">
              A useful next step, in writing.
            </Heading>
          </div>
          <div className="flex flex-col gap-4 lg:mt-3">
            {RISK_REVERSAL.map((item, i) => (
              <AnimateOnScroll
                as="div"
                key={item}
                delay={i * 0.12}
                className="flex items-start gap-3 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] pt-4 text-base text-white-secondary"
              >
                <Check className="mt-1 h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>{item}</span>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
