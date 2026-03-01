"use client";

import Link from "next/link";
import { Check, ArrowRight, TrendingUp, Clock, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { PageHero } from "@/components/ui/PageHero";
import {
  DashboardMockup,
  AutomationFlowIllustration,
  ChatAgentIllustration,
} from "@/components/ui/Illustrations";
import { fadeUp } from "@/lib/animations";
import { services } from "@/content/services";
import { caseStudies } from "@/content/case-studies";

const illustrationMap: Record<string, React.FC<{ className?: string }>> = {
  DashboardMockup,
  AutomationFlowIllustration,
  ChatAgentIllustration,
};

const anchorMap: Record<string, string> = {
  "ai-websites": "websites",
  automations: "automations",
  "ai-agents": "agents",
};

const sectionHeadings: Record<string, React.ReactNode> = {
  "ai-websites": (
    <>
      A Website That{" "}
      <span className="text-gold-gradient">Works for You</span>
    </>
  ),
  automations: (
    <>
      Stop Doing Work a{" "}
      <span className="text-gold-gradient">Machine Can Do</span>
    </>
  ),
  "ai-agents": (
    <>
      An Employee That Never{" "}
      <span className="text-gold-gradient">Clocks Out</span>
    </>
  ),
};

const ctaLabels: Record<string, string> = {
  "ai-websites": "Build My Website",
  automations: "Automate My Business",
  "ai-agents": "Build My AI Agent",
};

function ServiceSection({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  const anchor = anchorMap[service.id] || service.id;
  const Illustration = illustrationMap[service.illustration];
  const bgClass =
    index % 2 === 1 ? "bg-[var(--bg-section-warm)]" : "bg-[var(--bg-base)]";

  return (
    <section id={anchor} className={`py-24 ${bgClass} relative overflow-hidden`}>
      {/* Illustration as atmospheric background accent */}
      {Illustration && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <Illustration className="w-[700px] h-[500px] opacity-[0.035]" />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <AnimateOnScroll className="text-center mb-14">
          <p className="section-label">{service.name}</p>
          <h2 className="section-heading mb-4">
            {sectionHeadings[service.id]}
          </h2>
          <p className="italic text-white/45 max-w-2xl mx-auto mb-5">
            {service.problemStatement}
          </p>
          <p className="text-white/60 max-w-2xl mx-auto leading-relaxed">
            {service.description}
          </p>
        </AnimateOnScroll>

        {/* Metrics row */}
        <StaggerContainer className="grid grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto mb-14">
          {service.keyMetrics.map((metric) => (
            <AnimateOnScroll key={metric.label} variants={fadeUp}>
              <GlassCard padding="sm" hover="none" className="text-center">
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold-gradient">
                  {metric.value}
                </p>
                <p className="text-xs text-white/50 mt-1">{metric.label}</p>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </StaggerContainer>

        {/* Deliverables + pricing + CTA */}
        <AnimateOnScroll>
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-white mb-5">
              What you get
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {service.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-[var(--gold-base)] shrink-0 mt-0.5" />
                  <span className="text-white/70 text-sm leading-relaxed">
                    {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-white/5">
              <p className="text-lg font-display font-semibold text-white">
                {service.pricingDisplay}
              </p>
              <Link href="/contact">
                <Button variant="primary" size="md">
                  {ctaLabels[service.id] || "Get Started"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </GlassCard>
        </AnimateOnScroll>
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
            Three Systems That{" "}
            <span className="text-gold-gradient">Pay for Themselves</span>
          </>
        }
        description="We don't sell software. We build revenue-generating systems — websites that convert, automations that save hours, and AI agents that never sleep."
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
          <AnimateOnScroll className="text-center mb-16">
            <p className="section-label">Our Process</p>
            <h2 className="section-heading mb-4">
              From Kickoff to Results in{" "}
              <span className="text-gold-gradient">Weeks, Not Months</span>
            </h2>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Gold connecting line (desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-[rgba(212,175,55,0.3)] via-[rgba(212,175,55,0.5)] to-[rgba(212,175,55,0.3)]" />

            {[
              { num: "01", title: "Discovery Call", desc: "We learn your business, your goals, and your pain points in a free 30-minute call." },
              { num: "02", title: "Custom Blueprint", desc: "A detailed plan with exact deliverables, timeline, and projected ROI — before you spend a dollar." },
              { num: "03", title: "Build & Launch", desc: "We design, develop, and deploy your systems in 2-4 weeks with weekly check-ins." },
              { num: "04", title: "Operate & Optimize", desc: "Ongoing monitoring, monthly reporting, and continuous improvement to maximize results." },
            ].map((step) => (
              <AnimateOnScroll key={step.num} variants={fadeUp}>
                <GlassCard padding="lg" className="relative text-center h-full">
                  <div className="w-10 h-10 rounded-full bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center mx-auto mb-4">
                    <span className="font-display text-sm font-bold text-[var(--gold-light)]">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">
                    {step.desc}
                  </p>
                </GlassCard>
              </AnimateOnScroll>
            ))}
          </StaggerContainer>
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
                  <blockquote className="font-display text-xl sm:text-2xl text-white leading-relaxed italic mb-6">
                    &ldquo;{farrellStudy.testimonialQuote}&rdquo;
                  </blockquote>
                  <p className="text-[var(--gold-light)] font-medium">
                    {farrellStudy.testimonialAuthor}
                  </p>
                  <p className="text-sm text-white/50">
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
                  Not sure which service fits?
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Tell us about your business and we will build a custom plan
                  with exactly what you need, what it costs, and the ROI you
                  can expect.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/#solution-generator">
                    <Button
                      variant="primary"
                      size="lg"
                      pulse
                      className="w-full sm:w-auto"
                    >
                      Build My Custom Plan
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Talk to a Human
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
