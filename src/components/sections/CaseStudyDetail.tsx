"use client";

import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Clock, Quote,
  Target, Lightbulb, TrendingUp, Wrench,
} from "lucide-react";
import { Section, Container, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import type { CaseStudyFull, Industry } from "@/lib/types";

const industryLabels: Record<Industry, string> = {
  home_services: "Home Services",
  law_firm: "Law Firms",
  professional_services: "Professional Services",
  real_estate: "Real Estate",
  other: "Other",
};

const industrySlugs: Partial<Record<Industry, string>> = {
  home_services: "home-services",
  law_firm: "law-firms",
  professional_services: "professional-services",
  real_estate: "real-estate",
};

const serviceLinks: Record<string, string> = {
  "AI-Powered Website": "/services#strategy",
  "AI Chat Agent": "/services#engagement",
  "Automated Follow-Up": "/services#automation",
  "Workflow Automation": "/services#automation",
};

interface CaseStudyDetailProps {
  study: CaseStudyFull;
}

export function CaseStudyDetail({ study }: CaseStudyDetailProps) {
  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <Container width="wide">
        <div className="max-w-3xl">
          <AnimateOnScroll>
            <Link
              href="/results"
              data-cursor="link"
              className="mb-8 inline-flex items-center gap-2 text-sm text-white-muted transition-colors hover:text-heading"
            >
              <ArrowLeft className="h-4 w-4" />
              All case studies
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted">
              <span className="text-gold">{industryLabels[study.industry]}</span>
              {study.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {study.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {study.timeline}
              </span>
            </div>
          </AnimateOnScroll>

          <RevealHeading as="h1" className={HERO_HEADING} lead={study.businessName} delay={0.1} />
        </div>

        {/* results banner — full-width so the headline outcomes anchor the hero */}
        <AnimateOnScroll as="div" delay={0.3} className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {study.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-5 text-center backdrop-blur-md"
            >
              <p className="mb-1.5 font-display text-2xl font-bold text-gold">{metric.improvement}</p>
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white-muted">{metric.label}</p>
            </div>
          ))}
        </AnimateOnScroll>
        </Container>
      </section>

      {/* challenge */}
      <Section width="text" divide>
        <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-7 backdrop-blur-md sm:p-9">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--error)_8%,transparent)] text-[var(--error)]">
              <Target className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <Eyebrow className="m-0">the challenge</Eyebrow>
          </div>
          <p className="text-lg leading-relaxed text-white-secondary">{study.challenge}</p>
        </div>
      </Section>

      {/* solution */}
      <Section width="text" divide>
        <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-7 backdrop-blur-md sm:p-9">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--gold-base)_10%,transparent)] text-gold">
              <Lightbulb className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <Eyebrow className="m-0">our solution</Eyebrow>
          </div>
          <p className="mb-8 text-lg leading-relaxed text-white-secondary">{study.solution}</p>

          <div className="border-t border-border-glass pt-6">
            <div className="mb-3 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white-muted">
              <Wrench className="h-3.5 w-3.5" />
              Services deployed
            </div>
            <div className="flex flex-wrap gap-2">
              {study.services.map((service) => {
                const href = serviceLinks[service];
                const cls = "rounded-md border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_8%,transparent)] px-2.5 py-1 text-xs font-medium text-gold-light";
                return href ? (
                  <Link key={service} href={href} data-cursor="link" className={`${cls} transition-colors hover:bg-[color-mix(in_srgb,var(--gold-base)_14%,transparent)]`}>
                    {service}
                  </Link>
                ) : (
                  <span key={service} className={cls}>{service}</span>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* results — before / after */}
      <Section width="wide" divide>
        <div className="mb-12 max-w-3xl">
          <Eyebrow className="mb-6">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> the transformation
            </span>
          </Eyebrow>
          <Heading size={2} as="h2" className="mb-4">
            The <span className="display-italic">results.</span>
          </Heading>
          <p className="text-lg leading-relaxed text-white-muted">{study.results}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {study.metrics.map((metric, i) => (
            <AnimateOnScroll
              key={metric.label}
              as="div"
              delay={i * 0.06}
              className="flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-6 backdrop-blur-md sm:p-7"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white-muted">
                  {metric.label}
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-gold">
                  {metric.improvement}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white-muted">Before</p>
                  <p className="text-sm leading-relaxed text-white-secondary">{metric.before}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border-glass" />
                  <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
                  <span className="h-px flex-1 bg-border-glass" />
                </div>
                <div>
                  <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold">After</p>
                  <p className="text-sm font-medium leading-relaxed text-white-primary">{metric.after}</p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </Section>

      {/* testimonial */}
      {study.testimonialQuote && (
        <Section width="text" divide>
          <div className="rounded-2xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_4%,var(--bg-elevated))] p-8 text-center backdrop-blur-md sm:p-12">
            <Quote className="mx-auto mb-6 h-10 w-10 text-gold opacity-50" />
            <blockquote className="mb-8 font-display text-xl font-medium leading-relaxed text-white-primary sm:text-2xl">
              &ldquo;{study.testimonialQuote}&rdquo;
            </blockquote>
            {study.testimonialAuthor && (
              <div>
                <p className="font-semibold text-heading">{study.testimonialAuthor}</p>
                {study.testimonialTitle && (
                  <p className="mt-1 text-sm text-white-muted">{study.testimonialTitle}</p>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* industry cross-link */}
      {industrySlugs[study.industry] && (
        <Section width="text" divide>
          <Link
            href={`/industries/${industrySlugs[study.industry]}`}
            data-cursor="link"
            className="group inline-flex items-center gap-2 text-sm font-medium text-heading"
          >
            <span className="ink-sweep">
              See more solutions for {industryLabels[study.industry]}
            </span>
            <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </Section>
      )}

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Want <span className="display-italic">similar results?</span>
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free discovery call. We&apos;ll learn your business and tell
              you exactly where AI can drive the same kind of transformation.
            </p>
            <BookCallButton />
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
              <span>Free</span><span>·</span>
              <span>30 minutes</span><span>·</span>
              <span>No obligation</span><span>·</span>
              <span>Direct to the founder</span>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
