"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock,
  Quote,
  Target,
  Lightbulb,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";


import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp, scaleUp } from "@/lib/animations";
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

interface CaseStudyDetailProps {
  study: CaseStudyFull;
}

export function CaseStudyDetail({ study }: CaseStudyDetailProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            {/* Back Link */}
            <Link
              href="/results"
              className="inline-flex items-center gap-2 text-sm text-[var(--white-muted)] hover:text-[var(--white-primary)] transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              All Case Studies
            </Link>

            {/* Meta Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">
                {industryLabels[study.industry]}
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--white-muted)]">
                <MapPin className="w-3.5 h-3.5" />
                {study.location}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-[var(--white-muted)]">
                <Clock className="w-3.5 h-3.5" />
                {study.timeline}
              </div>
            </div>

            {/* Business Name */}
            <h1
              className="page-heading leading-[1.1] mb-6"
            >
              {study.businessName}
            </h1>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
              {study.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="glass rounded-lg p-4 text-center"
                >
                  <p
                    className="font-display text-xl sm:text-2xl font-bold text-gold-gradient"
                  >
                    {metric.improvement}
                  </p>
                  <p className="text-xs text-[var(--white-muted)] mt-1">{metric.label}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Challenge Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[rgba(244,63,94,0.1)] flex items-center justify-center">
                  <Target className="w-5 h-5 text-[#F43F5E]" />
                </div>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold text-[var(--heading-color)]"
                >
                  The Challenge
                </h2>
              </div>
              <p className="text-[var(--white-secondary)] leading-relaxed text-lg">
                {study.challenge}
              </p>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Solution Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[rgba(var(--accent-rgb),0.1)] flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-[var(--gold-base)]" />
                </div>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold text-[var(--heading-color)]"
                >
                  Our Solution
                </h2>
              </div>
              <p className="text-[var(--white-secondary)] leading-relaxed text-lg mb-8">
                {study.solution}
              </p>

              {/* Services Used */}
              <div className="pt-6 border-t border-[var(--border-glass)]">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="w-4 h-4 text-[var(--white-muted)]" />
                  <span className="text-sm text-[var(--white-muted)] font-medium">
                    Services Deployed
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {study.services.map((service) => (
                    <span
                      key={service}
                      className="text-xs font-medium text-[var(--gold-light)] bg-[rgba(var(--accent-rgb),0.08)] border border-[rgba(var(--accent-rgb),0.15)] rounded-md px-2.5 py-1"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Results Section - Before/After Metrics */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <TrendingUp className="w-4 h-4 text-[var(--gold-base)]" />
              <span className="text-sm text-[var(--white-secondary)]">Measurable Impact</span>
            </div>
            <h2
              className="section-heading mb-4"
            >
              The <span className="text-gold-gradient">Results</span>
            </h2>
            <p className="text-lg text-[var(--white-secondary)] max-w-2xl mx-auto">
              {study.results}
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {study.metrics.map((metric) => (
              <AnimateOnScroll key={metric.label} variants={fadeUp}>
                <GlassCard variant="prominent" padding="lg" className="h-full">
                  <p className="text-sm text-[var(--white-muted)] font-medium mb-4 uppercase tracking-wide">
                    {metric.label}
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    {/* Before */}
                    <div className="flex-1">
                      <p className="text-xs text-[var(--white-muted)] mb-1">Before</p>
                      <p
                        className="font-display text-xl font-bold text-[var(--white-secondary)]"
                      >
                        {metric.before}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0">
                      <ArrowRight className="w-5 h-5 text-[var(--gold-base)]" />
                    </div>

                    {/* After */}
                    <div className="flex-1 text-right">
                      <p className="text-xs text-[var(--gold-light)] mb-1">
                        After
                      </p>
                      <p
                        className="font-display text-xl font-bold text-gold-gradient"
                      >
                        {metric.after}
                      </p>
                    </div>
                  </div>

                  {/* Improvement Badge */}
                  <div className="pt-3 border-t border-[var(--border-glass)]">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(var(--accent-rgb),0.1)] text-[var(--gold-light)] text-sm font-semibold border border-[rgba(var(--accent-rgb),0.2)]">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {metric.improvement}
                    </span>
                  </div>
                </GlassCard>
              </AnimateOnScroll>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Testimonial */}
      {study.testimonialQuote && (
        <>
          <div className="section-divider" />

          <section className="py-24 bg-[var(--bg-base)]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <AnimateOnScroll variants={scaleUp}>
                <GlassCard variant="gold" padding="lg">
                  <div className="text-center">
                    <Quote className="w-10 h-10 text-[var(--gold-base)] mx-auto mb-6 opacity-50" />
                    <blockquote
                      className="font-display text-xl sm:text-2xl font-medium text-[var(--white-primary)] leading-relaxed mb-8"
                    >
                      &ldquo;{study.testimonialQuote}&rdquo;
                    </blockquote>
                    {study.testimonialAuthor && (
                      <div>
                        <p className="text-[var(--heading-color)] font-semibold">
                          {study.testimonialAuthor}
                        </p>
                        {study.testimonialTitle && (
                          <p className="text-sm text-[var(--white-muted)] mt-1">
                            {study.testimonialTitle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </AnimateOnScroll>
            </div>
          </section>
        </>
      )}

      {/* Industry Cross-Link */}
      {industrySlugs[study.industry] && (
        <>
          <div className="section-divider" />
          <section className="py-12 bg-[var(--bg-base)]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <Link
                href={`/industries/${industrySlugs[study.industry]}`}
                className="inline-flex items-center gap-2 text-[var(--gold-light)] hover:text-[var(--gold-base)] transition-colors text-sm font-medium"
              >
                See more solutions for {industryLabels[study.industry]}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </>
      )}

      <div className="section-divider" />

      {/* CTA Section */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="section-heading mb-4"
                >
                  Want{" "}
                  <span className="text-gold-gradient">Similar Results?</span>
                </h2>
                <p className="text-lg text-[var(--white-secondary)] max-w-xl mx-auto mb-8">
                  Get a free, personalized growth plan and see exactly how we can
                  help your business achieve the same kind of transformation.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/plan-builder">
                    <Button
                      variant="primary"
                      size="lg"
                      pulse
                      className="w-full sm:w-auto"
                    >
                      Get Your Growth Plan
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Book a Free Discovery Call
                    </Button>
                  </Link>
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
