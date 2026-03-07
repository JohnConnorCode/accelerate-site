"use client";

import { useRef, useEffect, useState } from "react";
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
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { PageHero } from "@/components/ui/PageHero";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { heroSlideScale } from "@/lib/animations";
import { trackConversion } from "@/lib/analytics";
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

const serviceCaseStudies: Record<string, { label: string; href: string }> = {
  automation: { label: "See how SparkBlox cut onboarding by 90%", href: "/results/sparkblox" },
  engagement: { label: "See how Farrell Roofing grew inquiries 4x", href: "/results/farrell-roofing" },
  sales: { label: "See how Montoya Capital boosted consultations 40%", href: "/results/montoya-capital" },
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
  const isReversed = index % 2 !== 0;

  return (
    <section id={service.id} className={`py-24 scroll-mt-[104px] ${bgClass}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-10 items-start ${isReversed ? "lg:direction-rtl" : ""}`}>
          {/* Text side — 3 cols */}
          <div className={`lg:col-span-3 ${isReversed ? "lg:order-2" : ""}`}>
            <ScrollReveal animation={isReversed ? "slide-right" : "slide-left"}>
              <div className="mb-10">
                {Icon && (
                  <div className="w-12 h-12 rounded-lg bg-[rgba(var(--accent-rgb),0.08)] flex items-center justify-center mb-4">
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
                <ScrollReveal key={metric.label} animation="fade-up" delay={0.2 + i * 0.1}>
                  <GlassCard padding="sm" hover="none" className="text-center">
                    <p className="font-display text-xl sm:text-2xl font-bold text-gold-gradient">
                      {metric.value}
                    </p>
                    <p className="text-xs text-[var(--white-muted)] mt-1">{metric.label}</p>
                  </GlassCard>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Deliverables card — 2 cols */}
          <div className={`lg:col-span-2 ${isReversed ? "lg:order-1" : ""}`}>
            <ScrollReveal animation={isReversed ? "slide-left" : "slide-right"} delay={0.3}>
              <GlassCard padding="lg">
                <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-5">
                  What you get
                </h3>
                <ul className="space-y-3 mb-8">
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
                  <Link
                    href="/contact"
                    onClick={() => trackConversion("CTA Click", { section: `Service: ${service.name}`, cta_text: "Get Started", href: "/contact" })}
                  >
                    <Button variant="primary" size="md">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
                {(() => {
                  const caseStudy = serviceCaseStudies[service.id];
                  if (!caseStudy) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <Link
                        href={caseStudy.href}
                        className="inline-flex items-center gap-2 text-sm text-[var(--gold-light)] hover:text-[var(--gold-base)] transition-colors"
                      >
                        {caseStudy.label}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })()}
              </GlassCard>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServicesPageContent() {
  const farrellStudy = caseStudies.find((s) => s.id === "farrell-roofing");
  const navRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<string>("");

  // IntersectionObserver for sticky nav gold underline
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    services.forEach((service) => {
      const el = document.getElementById(service.id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setActiveId(service.id);
          }
        },
        { rootMargin: "-50% 0px -50% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Service icon stack for hero visual
  const heroVisual = (
    <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto lg:mx-0">
      {services.map((service, i) => {
        const Icon = iconMap[service.icon];
        return Icon ? (
          <div
            key={service.id}
            className="glass rounded-xl p-4 flex items-center justify-center"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <Icon className="w-6 h-6 text-[var(--gold-base)]" />
          </div>
        ) : null;
      })}
    </div>
  );

  return (
    <>
      {/* Hero */}
      <PageHero
        variant="split"
        label="Our Services"
        title={
          <>
            Six Ways We Make AI{" "}
            <span className="text-gold-gradient">Work for You</span>
          </>
        }
        description="We don't sell software. We build and run AI systems tailored to your business — strategy, automation, engagement, content, and reporting."
        visual={heroVisual}
        itemAnimation={heroSlideScale}
      >
        <div className="flex items-center gap-6 flex-wrap mt-8 text-sm text-[var(--white-muted)]">
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

      {/* Service Quick Nav */}
      <nav
        ref={navRef}
        className="sticky top-[60px] z-[80] bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {services.map((service) => {
              const Icon = iconMap[service.icon];
              const isActive = activeId === service.id;
              return (
                <a
                  key={service.id}
                  href={`#${service.id}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "text-[var(--gold-light)] bg-[rgba(var(--accent-rgb),0.12)] border-b-2 border-[var(--gold-base)]"
                      : "text-[var(--white-muted)] hover:text-[var(--white-primary)] hover:bg-[rgba(var(--accent-rgb),0.08)]"
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {service.name}
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Individual Service Sections */}
      {services.map((service, index) => (
        <div key={service.id}>
          <ServiceSection service={service} index={index} />
          <SectionDivider variant="fade" />
        </div>
      ))}

      {/* Process Timeline */}
      <section className="py-24 bg-[var(--bg-section-warm)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="blur-up" className="mb-16">
            <SectionHeader
              label="Our Process"
              heading={
                <>
                  From Kickoff to Results in{" "}
                  <span className="text-gold-gradient">Weeks, Not Months</span>
                </>
              }
            />
          </ScrollReveal>

          {/* Vertical timeline */}
          <div className="relative max-w-2xl mx-auto">
            {/* Gold line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[rgba(var(--accent-rgb),0.3)] via-[rgba(var(--accent-rgb),0.5)] to-[rgba(var(--accent-rgb),0.3)]" />

            {[
              { num: "01", title: "Discovery Call", desc: "Free. 30 minutes. We learn how your business runs and where AI creates the most value." },
              { num: "02", title: "Strategy & Roadmap", desc: "A tailored plan with exact deliverables, timeline, and projected ROI — before you spend a dollar." },
              { num: "03", title: "Build & Launch", desc: "We handle the technical work. Configuration, integration, testing, training. Live within weeks." },
              { num: "04", title: "Optimize & Grow", desc: "Ongoing monitoring, monthly reporting, and continuous improvement to maximize results." },
            ].map((step, i) => (
              <ScrollReveal key={step.num} animation="clip-left" delay={i * 0.1}>
                <div className="flex gap-6 mb-10 last:mb-0">
                  <div className="w-12 h-12 rounded-full bg-[rgba(var(--accent-rgb),0.15)] border border-[rgba(var(--accent-rgb),0.3)] flex items-center justify-center shrink-0 relative z-10">
                    <span className="font-display text-sm font-bold text-[var(--gold-light)]">
                      {step.num}
                    </span>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-[var(--white-muted)] leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Testimonial Pull-Quote */}
      {farrellStudy?.testimonialQuote && (
        <>
          <section className="py-24 bg-[var(--bg-base)]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <ScrollReveal animation="clip-left">
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

          <SectionDivider variant="fade" />
        </>
      )}

      {/* Bottom CTA */}
      <FinalCTA
        heading={<>Not sure where to start?</>}
        description="Book a free discovery call. We'll learn your business and tell you exactly where AI can help — no pitch, no obligation."
        primaryCTA={{ label: "Book a Free Discovery Call", href: "/contact" }}
        secondaryCTA={{ label: "Get Your Growth Plan", href: "/plan-builder" }}
      />
    </>
  );
}
