"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, MapPin, TrendingUp, Filter,
} from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { cn } from "@/lib/utils";
import { caseStudies } from "@/content/case-studies";
import type { Industry, CaseStudyFull } from "@/lib/types";

const industryLabels: Record<Industry, string> = {
  home_services: "Home Services",
  law_firm: "Law Firms",
  professional_services: "Professional Services",
  real_estate: "Real Estate",
  other: "Other",
};

type FilterOption = "all" | Industry;

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All industries" },
  { value: "home_services", label: "Home Services" },
  { value: "law_firm", label: "Law Firms" },
  { value: "professional_services", label: "Professional Services" },
  { value: "real_estate", label: "Real Estate" },
];

function CaseStudyCard({ study }: { study: CaseStudyFull }) {
  const displayMetrics = study.metrics.slice(0, 3);
  return (
    <Link
      href={`/results/${study.slug}`}
      data-cursor="link"
      className="group flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)] p-6 backdrop-blur-md transition-colors hover:border-border-gold sm:p-7"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gold">
          {industryLabels[study.industry]}
        </p>
        {study.location && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
            <MapPin className="h-3 w-3" />
            {study.location}
          </span>
        )}
      </div>
      <h3 className="mb-3 font-display text-xl font-bold tracking-[-0.02em] text-heading sm:text-2xl">
        {study.businessName}
      </h3>
      <p className="mb-6 line-clamp-3 flex-1 text-sm leading-relaxed text-white-secondary">
        {study.results}
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {displayMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] p-3 text-center"
          >
            <p className="font-display text-sm font-bold text-gold">{metric.improvement}</p>
            <p className="mt-1 text-[10px] leading-tight text-white-muted">{metric.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-border-glass pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-heading">
          <span className="ink-sweep">Read case study</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function ResultsPageContent() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const featuredStudy = caseStudies.find((s) => s.featured);
  const filteredStudies =
    activeFilter === "all"
      ? caseStudies
      : caseStudies.filter((s) => s.industry === activeFilter);

  return (
    <>
      {/* hero — statement left, the featured client story (strongest proof) right */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">client results</Eyebrow></AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Real numbers from real engagements."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Every number below came from an actual client engagement —
                measured, not modeled. No inflated projections, no &ldquo;up
                to&rdquo; disclaimers.
              </p>
            </AnimateOnScroll>
          </div>

          {featuredStudy && (
            <AnimateOnScroll as="div" className="relative overflow-hidden rounded-3xl border border-border-gold/50 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-7 backdrop-blur-md sm:p-8">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
              <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                Featured · {industryLabels[featuredStudy.industry]}
              </p>
              <blockquote className="mb-5 font-display text-xl italic leading-relaxed text-white-primary">
                &ldquo;{featuredStudy.testimonialQuote}&rdquo;
              </blockquote>
              <p className="font-medium text-gold-light">{featuredStudy.testimonialAuthor}</p>
              <p className="text-sm text-white-muted">{featuredStudy.testimonialTitle}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border-glass pt-6">
                {featuredStudy.metrics.slice(0, 4).map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-3 text-center"
                  >
                    <p className="mb-1 font-display text-sm font-bold text-gold">{metric.improvement}</p>
                    <p className="text-[10px] leading-tight text-white-muted">{metric.label}</p>
                  </div>
                ))}
              </div>
              <Link
                href={`/results/${featuredStudy.slug}`}
                data-cursor="link"
                className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-heading"
              >
                <span className="ink-sweep">Read {featuredStudy.businessName}&apos;s story</span>
                <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </AnimateOnScroll>
          )}
        </div>
        </Container>
      </section>

      {/* filter + grid */}
      <Section width="wide" divide>
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white-muted" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white-muted">Filter by industry</span>
        </div>
        <div className="mb-10 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              data-cursor="link"
              onClick={() => setActiveFilter(option.value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeFilter === option.value
                  ? "border border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_12%,transparent)] text-gold"
                  : "border border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-heading"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudies.map((study, i) => (
            <AnimateOnScroll key={study.id} as="div" delay={(i % 3) * 0.06}>
              <CaseStudyCard study={study} />
            </AnimateOnScroll>
          ))}
        </div>

        {filteredStudies.length === 0 && (
          <div className="py-16 text-center">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-white-muted" />
            <p className="text-lg text-white-muted">No case studies in this industry yet. Check back soon.</p>
          </div>
        )}
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Want results like these?
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Every result on this page came from the same playbook we&apos;ll
              build for your business.
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
