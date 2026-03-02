"use client";

import Link from "next/link";
import {
  Check,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
  Compass,
  Workflow,
  MessageCircle,
  PenTool,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHero } from "@/components/ui/PageHero";
import { fadeUp } from "@/lib/animations";
import { services } from "@/content/services";
import { caseStudies } from "@/content/case-studies";

const iconMap: Record<string, LucideIcon> = {
  Compass,
  Workflow,
  TrendingUp,
  MessageCircle,
  PenTool,
  BarChart3,
};

function ServiceSection({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  const bgClass =
    index % 2 === 0 ? "bg-[var(--bg-base)]" : "bg-[var(--bg-section-warm)]";
  const Icon = iconMap[service.icon];

  return (
    <section id={service.id} className={`py-24 ${bgClass}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal animation="fade-up">
          <div className="mb-10">
            {Icon && (
              <div className="w-12 h-12 rounded-lg bg-[rgba(212,175,55,0.08)] flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-[var(--gold-base)]" />
              </div>
            )}
            <h2 className="section-heading mb-3">{service.name}</h2>
            <p className="italic text-[var(--white-muted)] max-w-2xl mb-4">
              {service.problemStatement}
            </p>
            <p className="text-[var(--white-secondary)] max-w-2xl leading-relaxed">
              {service.description}
            </p>
          </div>
        </ScrollReveal>

        {/* Metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-lg mb-10">
          {service.keyMetrics.map((metric, i) => (
            <ScrollReveal key={metric.label} animation="fade-up" delay={i * 0.1}>
              <GlassCard padding="sm" hover="none" className="text-center">
                <p className="font-display text-xl sm:text-2xl font-bold text-gold-gradient">
                  {metric.value}
                </p>
                <p className="text-xs text-[var(--white-muted)] mt-1">{metric.label}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>

        {/* Deliverables + pricing + CTA */}
        <ScrollReveal animation="fade-up" delay={0.15}>
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-5">
              What you get
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {service.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-[var(--gold-base)] shrink-0 mt-0.5" />
                  <span className="text-[var(--white-secondary)] text-sm leading-relaxed">
                    {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-white/5">
              <p className="text-lg font-display font-semibold text-[var(--heading-color)]">
                {service.pricingDisplay}
              </p>
              <Link href="/contact">
                <Button variant="primary" size="md">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </GlassCard>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function ServicesPageContent() {
  const farrellStudy = caseStudies.find((s) => s.id === "farrell-roofing");

  return (
    <>
      {/* Hero */}
      <PageHero
        label="Our Services"
        title={
          <>
            Six Ways We Make AI{" "}
            <span className="text-gold-gradient">Work for You</span>
          </>
        }
        description="We don't sell software. We build and run AI systems tailored to your business — strategy, automation, engagement, content, and reporting."
      >
        <div className="flex items-center justify-center gap-6 flex-wrap mt-8 text-sm text-[var(--white-muted)]">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--gold-base)]" />
            +340% avg inquiry increase
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gold-base)]" />
            10+ hours saved/week
          </span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--gold-base)]" />
            94% client retention
          </span>
        </div>
      </PageHero>

      <div className="section-divider" />

      {/* Individual Service Sections */}
      {services.map((service, index) => (
        <div key={service.id}>
          <ServiceSection service={service} index={index} />
          <div className="section-divider" />
        </div>
      ))}

      {/* Process Timeline */}
      <section className="py-24 bg-[var(--bg-section-warm)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="mb-16">
            <SectionHeader
              label="Our Process"
              heading={
                <>
                  From Kickoff to Results in{" "}
                  <span className="text-gold-gradient">Weeks, Not Months</span>
                </>
              }
            />
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Gold connecting line (desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-[rgba(212,175,55,0.3)] via-[rgba(212,175,55,0.5)] to-[rgba(212,175,55,0.3)]" />

            {[
              { num: "01", title: "Discovery Call", desc: "Free. 30 minutes. We learn how your business runs and where AI creates the most value." },
              { num: "02", title: "Strategy & Roadmap", desc: "A tailored plan with exact deliverables, timeline, and projected ROI — before you spend a dollar." },
              { num: "03", title: "Build & Launch", desc: "We handle the technical work. Configuration, integration, testing, training. Live within weeks." },
              { num: "04", title: "Optimize & Grow", desc: "Ongoing monitoring, monthly reporting, and continuous improvement to maximize results." },
            ].map((step, i) => (
              <ScrollReveal key={step.num} animation="fade-up" delay={i * 0.1}>
                <GlassCard padding="lg" className="relative text-center h-full">
                  <div className="w-10 h-10 rounded-full bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center mx-auto mb-4">
                    <span className="font-display text-sm font-bold text-[var(--gold-light)]">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--white-muted)] leading-relaxed">
                    {step.desc}
                  </p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Testimonial Pull-Quote */}
      {farrellStudy?.testimonialQuote && (
        <>
          <section className="py-24 bg-[var(--bg-base)]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <ScrollReveal animation="clip-reveal">
                <div className="border-l-4 border-[var(--gold-base)] pl-8">
                  <blockquote className="font-display text-xl sm:text-2xl text-[var(--white-primary)] leading-relaxed italic mb-6">
                    &ldquo;{farrellStudy.testimonialQuote}&rdquo;
                  </blockquote>
                  <p className="text-[var(--gold-light)] font-medium">
                    {farrellStudy.testimonialAuthor}
                  </p>
                  <p className="text-sm text-[var(--white-muted)]">
                    {farrellStudy.testimonialTitle}
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </section>

          <div className="section-divider" />
        </>
      )}

      {/* Bottom CTA */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2 className="section-heading mb-4">
                  Not sure where to start?
                </h2>
                <p className="text-lg text-[var(--white-secondary)] max-w-xl mx-auto mb-8">
                  Book a free discovery call. We&apos;ll learn your business and
                  tell you exactly where AI can help — no pitch, no obligation.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contact">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Book a Free Discovery Call
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/plan-builder">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Get Your Growth Plan
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
