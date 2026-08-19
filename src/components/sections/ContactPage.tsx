"use client";

import { Mail, Clock, Zap, Check } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { ContactForm } from "@/components/sections/ContactForm";
import { CALENDLY_URL } from "@/lib/booking";

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
    label: "Revenue-leak audit",
    value: "Free · directly with John",
  },
] as const;

const RISK_REVERSAL = [
  "The one constraint costing you the most, named",
  "What it costs to fix, and how long it takes",
  "In writing within two business days, hire us or not",
];

export function ContactPageContent() {
  return (
    <>
      {/* hero — eyebrow + display heading + info cards in dark-glass tiles */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* left: statement */}
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">contact</Eyebrow></AnimateOnScroll>
            <RevealHeading as="h1" className={HERO_HEADING} lead="Let's" accent="talk." delay={0.1} />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-md text-base leading-relaxed text-white-secondary">
                Tell us what is breaking. We reply within one business day. The session is with John.
              </p>
            </AnimateOnScroll>

            {/* info cards */}
            <div className="mt-10 flex flex-col gap-3">
              {INFO_CARDS.map((card, i) => {
                const Icon = card.icon;
                const href = "href" in card ? card.href : undefined;
                const shell =
                  "group flex items-center gap-4 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] p-4 backdrop-blur-sm transition-colors hover:border-border-gold";
                const inner = (
                  <>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
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
                  <AnimateOnScroll as="div" key={card.label} delay={0.45 + i * 0.12}>
                    {href ? (
                      <a href={href} data-cursor="link" className={shell}>{inner}</a>
                    ) : (
                      <div className={shell}>{inner}</div>
                    )}
                  </AnimateOnScroll>
                );
              })}
            </div>
          </div>

          {/* right: the active campaign booking path. Keep the manual form below
              as a fallback for visitors who prefer to send context first. */}
          <AnimateOnScroll as="div" delay={0.3} className="lg:sticky lg:top-32">
            <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-6">
              <p className="mb-1 px-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">
                Start here
              </p>
              <h2 className="mb-2 px-2 font-display text-2xl font-bold tracking-[-0.02em] text-heading">
                Book your free revenue-leak audit
              </h2>
              <p className="mb-5 px-2 text-pretty text-sm leading-6 text-white-secondary">Choose a time directly on John’s calendar.</p>
              <iframe
                src={`${CALENDLY_URL}?hide_gdpr_banner=1&embed_domain=acceleratewith.us&embed_type=Inline`}
                title="Book your free revenue-leak audit with John"
                className="h-[700px] w-full rounded-xl border-0 bg-white"
              />
              <details className="mt-5 rounded-xl border border-border-glass px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-heading">Prefer to send context first?</summary>
                <div className="pt-4"><ContactForm /></div>
              </details>
            </div>
          </AnimateOnScroll>
        </div>
        </Container>
      </section>

      {/* risk reversal — what you walk away with, free */}
      <Section width="wide" divide>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">what you walk away with</Eyebrow>
            <Heading size={2} as="h2" className="max-w-md">
              A free plan, yours to keep.
            </Heading>
          </div>
          <div className="flex flex-col gap-4 lg:mt-3">
            {RISK_REVERSAL.map((item, i) => (
              <AnimateOnScroll
                as="div"
                key={item}
                delay={i * 0.12}
                className="flex items-start gap-3 border-t border-border-glass pt-4 text-base text-white-secondary"
              >
                <Check className="mt-1 h-5 w-5 shrink-0 text-gold" strokeWidth={2.5} />
                <span>{item}</span>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
