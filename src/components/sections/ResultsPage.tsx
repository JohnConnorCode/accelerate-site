"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  TrendingUp,
  BarChart3,
  Filter,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp, scaleUp } from "@/lib/animations";
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
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Badge variant="gold">{industryLabels[study.industry]}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/40 shrink-0">
            <MapPin className="w-3 h-3" />
            {study.location}
          </div>
        </div>

        {/* Business Name */}
        <h3
          className="text-xl sm:text-2xl font-bold text-white mb-3"
          style={{
            fontFamily:
              "var(--font-space-grotesk), var(--font-inter), sans-serif",
          }}
        >
          {study.businessName}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/60 leading-relaxed mb-6 line-clamp-3 flex-1">
          {study.results}
        </p>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {displayMetrics.map((metric) => (
            <div
              key={metric.label}
              className="glass rounded-lg p-3 text-center"
            >
              <p
                className="text-sm font-bold text-gold-gradient"
                style={{
                  fontFamily:
                    "var(--font-space-grotesk), var(--font-inter), sans-serif",
                }}
              >
                {metric.improvement}
              </p>
              <p className="text-[10px] text-white/45 mt-1 leading-tight">
                {metric.label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-4 border-t border-[var(--border-glass)] mt-auto">
          <Link
            href={`/results/${study.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white link-gold-underline transition-colors"
          >
            Read Case Study
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

export function ResultsPageContent() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const filteredStudies =
    activeFilter === "all"
      ? caseStudies
      : caseStudies.filter((s) => s.industry === activeFilter);

  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb-gold top-[-10%] right-[-5%]" />
          <div className="orb-white bottom-[-15%] left-[-10%]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8">
              <BarChart3 className="w-4 h-4 text-[var(--gold-base)]" />
              <span className="text-sm text-white/65">
                Proven Results from Real Clients
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Real Results for{" "}
              <span className="text-gold-gradient">Real Businesses</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              See how we have helped small businesses capture more leads, save
              time, and grow revenue with AI-powered solutions.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Filter + Grid */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Tabs */}
          <AnimateOnScroll className="mb-12">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/40">Filter by industry</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setActiveFilter(option.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer",
                    activeFilter === option.value
                      ? "bg-[rgba(212,175,55,0.15)] text-[var(--gold-light)] border border-[var(--border-gold)]"
                      : "glass text-white/60 hover:text-white/80 hover:border-[var(--border-glass-hover)]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Results Grid */}
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudies.map((study) => (
              <AnimateOnScroll key={study.id} variants={fadeUp}>
                <CaseStudyCard study={study} />
              </AnimateOnScroll>
            ))}
          </StaggerContainer>

          {filteredStudies.length === 0 && (
            <AnimateOnScroll variants={scaleUp}>
              <div className="text-center py-16">
                <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-lg text-white/50">
                  No case studies in this industry yet. Check back soon.
                </p>
              </div>
            </AnimateOnScroll>
          )}
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA Section */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
                  style={{
                    fontFamily:
                      "var(--font-space-grotesk), var(--font-inter), sans-serif",
                  }}
                >
                  Ready for{" "}
                  <span className="text-gold-gradient">Similar Results?</span>
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Get a free, personalized growth plan tailored to your business.
                  See exactly what we would build, what it costs, and the ROI
                  you can expect.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/#solution-generator">
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
                      Book a Consultation
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
