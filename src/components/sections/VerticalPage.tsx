"use client";

import { useRef } from "react";
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
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { FinalCTA } from "@/components/sections/FinalCTA";
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
}

export function VerticalPage({ vertical }: VerticalPageProps) {
  const solutionsRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  // GSAP stagger for solution cards
  useGSAP(() => {
    if (!solutionsRef.current || prefersReducedMotion()) return;
    const cards = solutionsRef.current.querySelectorAll("[data-solution-card]");
    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0, duration: 0.5, delay: 0.25, stagger: 0.1, ease: "power2.out",
        scrollTrigger: { trigger: solutionsRef.current, start: "top 80%", toggleActions: "play none none none" },
      }
    );
  }, { scope: solutionsRef });

  // GSAP stagger for metric boxes
  useGSAP(() => {
    if (!metricsRef.current || prefersReducedMotion()) return;
    const items = metricsRef.current.querySelectorAll("[data-metric]");
    gsap.fromTo(items,
      { opacity: 0, scale: 0.9 },
      {
        opacity: 1, scale: 1, duration: 0.4, delay: 0.2, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: metricsRef.current, start: "top 85%", toggleActions: "play none none none" },
      }
    );
  }, { scope: metricsRef });

  // Split solutions: first 2 hero, rest compact
  const heroSolutions = vertical.solutions.slice(0, 2);
  const restSolutions = vertical.solutions.slice(2);

  return (
    <>
      {/* Hero */}
      <section className="relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-base)] to-transparent pointer-events-none z-[5]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20 sm:py-28">
          <ScrollReveal animation="blur-up">
            <p className="section-label">{vertical.name}</p>
            <h1 className="page-heading leading-[1.1] mb-6">
              {vertical.heroHeadlineWhite}{" "}
              <span className="text-gold-gradient">
                {vertical.heroHeadlineGold}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-white-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              {vertical.heroSubheadline}
            </p>
            <MagneticButton>
              <Link href="/contact">
                <Button variant="primary" size="lg" pulse>
                  Book a Free Discovery Call
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </MagneticButton>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* Pain Points — alternating slide animations */}
      <section className="relative pt-16 pb-24 bg-[var(--bg-section-warm)] overflow-hidden">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
        <div className="orb-gold -top-32 -right-32 opacity-60" />

        <div className="page-shell">
          <ScrollReveal animation="blur-up">
            <SectionHeader
              label="Sound Familiar?"
              heading={
                <>
                  The problems costing you{" "}
                  <span className="text-gold-gradient">real money.</span>
                </>
              }
              description={`These are the issues we hear from ${vertical.name.toLowerCase()} businesses every week.`}
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vertical.painPoints.map((painPoint, i) => {
              const Icon = iconMap[painPoint.icon] || Monitor;
              return (
                <ScrollReveal
                  key={painPoint.title}
                  animation={i % 2 === 0 ? "slide-left" : "slide-right"}
                  delay={0.2 + i * 0.08}
                >
                  <GlassCard
                    hover="lift"
                    padding="none"
                    className="overflow-hidden"
                  >
                    <div className="p-6 sm:p-8 flex gap-5">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(var(--accent-rgb),0.08)] flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6 text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-heading mb-2">
                          {painPoint.title}
                        </h3>
                        <p className="text-sm text-white-muted leading-relaxed">
                          {painPoint.description}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Solutions — bento layout with grid-dots-glow background */}
      <section className="relative py-24 bg-[var(--bg-section-deep)] overflow-hidden">
        <div className="absolute inset-0 grid-dots-glow pointer-events-none" />
        <div className="orb-gold -bottom-48 -left-48 opacity-60" />

        <div className="page-shell">
          <ScrollReveal animation="blur-up">
            <SectionHeader
              label="What We Build"
              heading={
                <>
                  Purpose-built systems.{" "}
                  <span className="text-gold-gradient">Real results.</span>
                </>
              }
              description={`Every solution is scoped to ${vertical.name.toLowerCase()} operations — your tools, your workflow, your goals.`}
              className="mb-16"
            />
          </ScrollReveal>

          <div ref={solutionsRef} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {heroSolutions.map((solution) => (
                <GlassCard
                  key={solution.title}
                  data-solution-card
                  hover="shine"
                  padding="none"
                  className="overflow-hidden"
                >
                  <div className="p-6 sm:p-8 md:p-10 flex flex-col h-full">
                    <h3 className="text-xl font-semibold text-heading mb-3">
                      {solution.title}
                    </h3>
                    <p className="text-white-secondary leading-relaxed mb-5">
                      {solution.description}
                    </p>
                    <ul className="space-y-2 mt-auto">
                      {solution.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-white-secondary"
                        >
                          <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>
              ))}
            </div>

            {restSolutions.length > 0 && (
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${restSolutions.length >= 3 ? "lg:grid-cols-3" : ""} gap-4`}>
                {restSolutions.map((solution) => (
                  <GlassCard
                    key={solution.title}
                    data-solution-card
                    hover="shine"
                    padding="lg"
                    className="overflow-hidden"
                  >
                    <h3 className="text-base font-semibold text-heading mb-2">
                      {solution.title}
                    </h3>
                    <p className="text-sm text-white-muted leading-relaxed mb-4">
                      {solution.description}
                    </p>
                    <ul className="space-y-1.5">
                      {solution.features.slice(0, 3).map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-xs text-white-muted"
                        >
                          <Check className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Case Study */}
      <section className="relative py-24 bg-bg-base overflow-hidden">
        <div className="absolute inset-0 dot-grid pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="blur-up">
            <SectionHeader
              label="Case Study"
              heading={
                <>{vertical.caseStudy.title}</>
              }
              className="mb-12"
            />
          </ScrollReveal>

          <ScrollReveal animation="clip-left" delay={0.15}>
            <GlassCard variant="gold" padding="none" className="overflow-hidden">
              <div className="p-8 sm:p-10 md:p-12">
                <p className="text-white-secondary leading-relaxed text-lg mb-10 max-w-3xl">
                  {vertical.caseStudy.description}
                </p>
                <div ref={metricsRef} className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {vertical.caseStudy.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      data-metric
                      className="glass rounded-xl p-5 text-center"
                    >
                      <p className="font-display text-3xl font-bold text-gold-gradient mb-1">
                        {metric.value}
                      </p>
                      <p className="text-xs text-white-muted uppercase tracking-wider">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* Final CTA */}
      <FinalCTA
        heading={
          <>
            Get Your Free{" "}
            <span className="text-gold-gradient">{vertical.name}</span>{" "}
            Growth Plan
          </>
        }
        description="Answer a few questions about your business and get a personalized plan with specific recommendations, pricing, and projected ROI."
        primaryCTA={{ label: "Book a Free Discovery Call", href: "/contact" }}
        secondaryCTA={{ label: "Book a Free Discovery Call", href: "/contact" }}
      />
    </>
  );
}
