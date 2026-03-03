"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  TrendingUp,
  Filter,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { CountUp } from "@/components/ui/CountUp";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { PageHero } from "@/components/ui/PageHero";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { heroReveal, heroStaggerDramatic, slideFromLeft, slideFromRight, scaleUp } from "@/lib/animations";
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
  { value: "all", label: "All Industries" },
  { value: "home_services", label: "Home Services" },
  { value: "law_firm", label: "Law Firms" },
  { value: "professional_services", label: "Professional Services" },
  { value: "real_estate", label: "Real Estate" },
];

function CaseStudyCard({ study }: { study: CaseStudyFull }) {
  const displayMetrics = study.metrics.slice(0, 3);

  return (
    <GlassCard hover="lift" padding="none" className="h-full flex flex-col">
      <div className="p-6 sm:p-8 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">
            {industryLabels[study.industry]}
          </p>
          {study.location && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--white-muted)] shrink-0">
              <MapPin className="w-3 h-3" />
              {study.location}
            </div>
          )}
        </div>

        <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--heading-color)] mb-3">
          {study.businessName}
        </h3>

        <p className="text-sm text-[var(--white-secondary)] leading-relaxed mb-6 line-clamp-3 flex-1">
          {study.results}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {displayMetrics.map((metric) => (
            <div
              key={metric.label}
              className="glass rounded-lg p-3 text-center"
            >
              <p className="font-display text-sm font-bold text-gold-gradient">
                {metric.improvement}
              </p>
              <p className="text-[10px] text-[var(--white-muted)] mt-1 leading-tight">
                {metric.label}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[var(--border-glass)] mt-auto">
          <Link
            href={`/results/${study.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--white-secondary)] hover:text-[var(--white-primary)] link-gold-underline transition-colors"
          >
            Read Case Study
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

const heroMetrics = [
  { end: 4, suffix: "x", label: "Avg. inquiry increase" },
  { end: 95, suffix: "%+", label: "Response time reduction" },
  { end: 75, prefix: "+", suffix: "%", label: "Avg. revenue lift" },
  { end: 94, suffix: "%", label: "Client retention" },
];

export function ResultsPageContent() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const featuredStudy = caseStudies.find((s) => s.featured);

  const filteredStudies =
    activeFilter === "all"
      ? caseStudies
      : caseStudies.filter((s) => s.industry === activeFilter);

  return (
    <>
      {/* Hero — immersive with metrics folded in */}
      <PageHero
        variant="immersive"
        label="Client Results"
        title={
          <>
            Proof Over Promises,{" "}
            <span className="text-gold-gradient">Real Numbers</span>
          </>
        }
        description="Every metric below came from a real client engagement. No inflated projections. No 'up to' disclaimers. Just what happened."
      >
        {/* Aggregate metrics in hero */}
        <motion.div
          variants={heroStaggerDramatic}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-3xl mx-auto"
        >
          {heroMetrics.map((metric) => (
            <motion.div key={metric.label} variants={heroReveal}>
              <GlassCard padding="sm" hover="none" className="text-center">
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold-gradient">
                  <CountUp
                    end={metric.end}
                    prefix={metric.prefix}
                    suffix={metric.suffix}
                  />
                </p>
                <p className="text-xs text-[var(--white-muted)] mt-1">{metric.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </PageHero>

      <SectionDivider variant="fade" />

      {/* Featured Case Study */}
      {featuredStudy && (
        <>
          <section className="py-24 bg-[var(--bg-base)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <ScrollReveal animation="clip-left">
                <GlassCard variant="gold" padding="lg">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)] mb-4">Featured</p>
                      <blockquote className="font-display text-xl text-[var(--white-primary)] leading-relaxed italic mb-6">
                        &ldquo;{featuredStudy.testimonialQuote}&rdquo;
                      </blockquote>
                      <p className="text-[var(--gold-light)] font-medium">
                        {featuredStudy.testimonialAuthor}
                      </p>
                      <p className="text-sm text-[var(--white-muted)]">
                        {featuredStudy.testimonialTitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {featuredStudy.metrics.map((metric) => (
                        <div
                          key={metric.label}
                          className="glass rounded-lg p-4 text-center"
                        >
                          <p className="font-display text-xl font-bold text-gold-gradient">
                            {metric.improvement}
                          </p>
                          <p className="text-xs text-[var(--white-muted)] mt-1">
                            {metric.label}
                          </p>
                          <p className="text-[10px] text-[var(--white-muted)] mt-0.5">
                            {metric.before} → {metric.after}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </ScrollReveal>
            </div>
          </section>

          <SectionDivider variant="glow" />
        </>
      )}

      {/* Filter + Grid */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 dot-grid pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Filter Tabs */}
          <AnimateOnScroll className="mb-12">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-[var(--white-muted)]" />
              <span className="text-sm text-[var(--white-muted)]">Filter by industry</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setActiveFilter(option.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer",
                    activeFilter === option.value
                      ? "bg-[rgba(var(--accent-rgb),0.15)] text-[var(--gold-light)] border border-[var(--border-gold)]"
                      : "glass text-[var(--white-secondary)] hover:text-[var(--white-primary)] hover:border-[var(--border-glass-hover)]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Results Grid — alternating animations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudies.map((study, i) => (
              <motion.div
                key={study.id}
                variants={i % 2 === 0 ? slideFromLeft : slideFromRight}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.1 }}
              >
                <CaseStudyCard study={study} />
              </motion.div>
            ))}
          </div>

          {filteredStudies.length === 0 && (
            <motion.div
              variants={scaleUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="text-center py-16">
                <TrendingUp className="w-12 h-12 text-[var(--white-muted)] mx-auto mb-4" />
                <p className="text-lg text-[var(--white-muted)]">
                  No case studies in this industry yet. Check back soon.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* CTA Section */}
      <FinalCTA
        heading={
          <>
            Want Results{" "}
            <span className="text-gold-gradient">Like These?</span>
          </>
        }
        description="Every number on this page came from the same playbook we'll build for your business."
        primaryCTA={{ label: "Get Your Growth Plan", href: "/plan-builder" }}
        secondaryCTA={{ label: "Book a Free Discovery Call", href: "/contact" }}
      />
    </>
  );
}
