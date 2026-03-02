"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  PhoneMissed,
  Clock,
  UserX,
  Monitor,
  Moon,
  FileText,
  Users,
  CalendarX,
  SearchX,
  Thermometer,
  DollarSign,
  RefreshCw,
  Database,
  Wrench,
  Scale,
  Briefcase,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import type { Vertical } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  PhoneMissed,
  Clock,
  UserX,
  Monitor,
  Moon,
  FileText,
  Users,
  CalendarX,
  SearchX,
  Thermometer,
  DollarSign,
  RefreshCw,
  Database,
  Wrench,
  Scale,
  Briefcase,
  Building2,
};

interface VerticalPageProps {
  vertical: Vertical;
  preSelectedIndustry: string;
}

export function VerticalPage({ vertical, preSelectedIndustry }: VerticalPageProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <p className="text-sm sm:text-base text-[var(--gold-light)] font-medium tracking-wide uppercase mb-6">
              {vertical.name}
            </p>
            <h1
              className="page-heading leading-[1.1] mb-6"
            >
              {vertical.heroHeadlineWhite}{" "}
              <span className="text-gold-gradient">
                {vertical.heroHeadlineGold}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-[var(--white-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
              {vertical.heroSubheadline}
            </p>
            <Link href={`/plan-builder?industry=${preSelectedIndustry}`}>
              <Button variant="primary" size="lg" pulse>
                {vertical.ctaText}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Pain Points */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-16">
            <h2
              className="section-heading mb-4"
            >
              Sound <span className="text-gold-gradient">Familiar?</span>
            </h2>
            <p className="text-lg text-[var(--white-secondary)] max-w-2xl mx-auto">
              These are the problems we hear from {vertical.name.toLowerCase()}{" "}
              businesses every week.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vertical.painPoints.map((painPoint) => {
              const Icon = iconMap[painPoint.icon] || Monitor;
              return (
                <AnimateOnScroll key={painPoint.title} variants={fadeUp}>
                  <GlassCard hover="glow" padding="lg" className="h-full">
                    <Icon className="w-10 h-10 text-[var(--gold-base)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-2">
                      {painPoint.title}
                    </h3>
                    <p className="text-[var(--white-secondary)] leading-relaxed">
                      {painPoint.description}
                    </p>
                  </GlassCard>
                </AnimateOnScroll>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* Solutions */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-16">
            <h2
              className="section-heading mb-4"
            >
              How We <span className="text-gold-gradient">Fix It</span>
            </h2>
            <p className="text-lg text-[var(--white-secondary)] max-w-2xl mx-auto">
              Purpose-built solutions for {vertical.name.toLowerCase()}{" "}
              businesses that deliver real results.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vertical.solutions.map((solution) => (
              <AnimateOnScroll key={solution.title} variants={fadeUp}>
                <GlassCard hover="glow" padding="lg" className="h-full">
                  <h3 className="text-xl font-semibold text-[var(--heading-color)] mb-3">
                    {solution.title}
                  </h3>
                  <p className="text-[var(--white-secondary)] leading-relaxed mb-5">
                    {solution.description}
                  </p>
                  <ul className="space-y-2">
                    {solution.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-[var(--white-secondary)]"
                      >
                        <Check className="w-4 h-4 text-[var(--gold-base)] shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </AnimateOnScroll>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* Case Study */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="lg">
              <p className="text-sm text-[var(--gold-light)] font-medium tracking-wide uppercase mb-4">
                Case Study
              </p>
              <h3
                className="font-display text-2xl sm:text-3xl font-bold text-[var(--heading-color)] mb-4"
              >
                {vertical.caseStudy.title}
              </h3>
              <p className="text-[var(--white-secondary)] leading-relaxed mb-8">
                {vertical.caseStudy.description}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {vertical.caseStudy.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="glass rounded-lg p-4 text-center"
                  >
                    <p
                      className="font-display text-2xl font-bold text-gold-gradient mb-1"
                    >
                      {metric.value}
                    </p>
                    <p className="text-xs text-[var(--white-muted)]">{metric.label}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Final CTA */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="section-heading mb-4"
                >
                  Get Your Free{" "}
                  <span className="text-gold-gradient">{vertical.name}</span>{" "}
                  Growth Plan
                </h2>
                <p className="text-lg text-[var(--white-secondary)] max-w-xl mx-auto mb-8">
                  Answer a few questions about your business and get a
                  personalized plan with specific recommendations, pricing, and
                  projected ROI.
                </p>
                <Link
                  href={`/plan-builder?industry=${preSelectedIndustry}`}
                >
                  <Button variant="primary" size="lg" pulse>
                    Build My Plan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
